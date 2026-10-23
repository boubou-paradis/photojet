'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  RotateCcw,
  X,
  RefreshCw,
  Loader2,
  Sparkles,
  Printer,
  Lock,
  Delete,
  Frame,
  ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session } from '@/types/database'
import { compressImage } from '@/lib/image-utils'
import { useBorneFrame, type LoadedFrame } from '@/components/animabooth/useBorneFrame'
import { composeFramedPhoto, fitStage, zoneOnScreen } from '@/lib/borne-templates/compose'
import { WELCOME_DEFAULT_MESSAGE, WELCOME_IDLE_MS } from '@/lib/borne-templates/constants'

type BorneState = 'loading' | 'error' | 'welcome' | 'camera' | 'countdown' | 'preview' | 'compressing' | 'uploading' | 'success' | 'printing'

// Rocket Button Component with takeoff animation
function RocketButton({ onClick, disabled, isLaunching }: { onClick: () => void; disabled?: boolean; isLaunching?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className="group relative w-28 h-28 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F4D03F] flex items-center justify-center shadow-2xl disabled:opacity-50"
      whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(212, 175, 55, 0.6)' }}
      whileTap={{ scale: 0.95 }}
      animate={isLaunching ? { y: -500, opacity: 0 } : { y: 0, opacity: 1 }}
      transition={isLaunching ? { duration: 0.8, ease: 'easeIn' } : { type: 'spring', stiffness: 400 }}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-full bg-[#D4AF37] opacity-0 group-hover:opacity-30 blur-xl transition-opacity" />

      {/* Rocket trail when launching */}
      {isLaunching && (
        <motion.div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-32 rounded-full"
          style={{
            background: 'linear-gradient(to top, transparent, rgba(244, 208, 63, 0.8), rgba(212, 175, 55, 0.4))',
          }}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: [0, 1, 0], scaleY: [0, 1, 2] }}
          transition={{ duration: 0.8 }}
        />
      )}

      {/* Rocket SVG */}
      <motion.svg
        width={50}
        height={60}
        viewBox="0 0 40 50"
        fill="none"
        className="relative z-10"
        animate={!isLaunching ? { y: [0, -3, 0], rotate: [0, -2, 2, 0] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path
          d="M20 0 C20 0, 8 15, 8 28 L8 38 L32 38 L32 28 C32 15, 20 0, 20 0Z"
          fill="#1A1A1E"
        />
        <rect x="8" y="38" width="24" height="6" fill="#1A1A1E" />
        <path d="M8 32 L0 48 L8 44 Z" fill="#1A1A1E" />
        <path d="M32 32 L40 48 L32 44 Z" fill="#1A1A1E" />
        <circle cx="20" cy="26" r="5" fill="#D4AF37" />
        <circle cx="20" cy="26" r="3" fill="#1A1A1E" opacity="0.3" />
        <path
          d="M12 44 L14 50 L20 46 L26 50 L28 44 Z"
          fill="#F4D03F"
          opacity="0.8"
        />
      </motion.svg>
    </motion.button>
  )
}

export default function BornePage() {
  const params = useParams()
  const borneCode = params.code as string

  const [session, setSession] = useState<Session | null>(null)
  const [state, setState] = useState<BorneState>('loading')
  const [countdown, setCountdown] = useState(3)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string>('')
  const [isRocketLaunching, setIsRocketLaunching] = useState(false)
  const [lastUploadModerated, setLastUploadModerated] = useState(false)
  const [lastActionWasPrint, setLastActionWasPrint] = useState(false)

  // Lock modal state
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [enteredCode, setEnteredCode] = useState('')
  const [lockError, setLockError] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const capturedImageUrlRef = useRef<string | null>(null)
  const captureRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const printReturnTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sessionRef = useRef(session)
  // Orientation de l'écran, et orientation au moment où le flux caméra a été ouvert
  const [isLandscape, setIsLandscape] = useState<boolean | null>(null)
  const streamLandscapeRef = useRef<boolean | null>(null)
  // Cadre AnimaBooth : relu à chaque retour caméra ; choix de l'invité ; cadre figé
  // au lancement du compte à rebours (un changement de dernière seconde ne compte pas)
  const [frameRefresh, setFrameRefresh] = useState(0)
  const [withFrame, setWithFrame] = useState(true)
  const [lockedFrame, setLockedFrame] = useState<LoadedFrame | null>(null)
  const [capturedFramed, setCapturedFramed] = useState(false)
  const lockedFrameRef = useRef<LoadedFrame | null>(null)
  const [view, setView] = useState({ w: 0, h: 0 })
  // Écran d'accueil (optionnel) : dernière activité sur l'écran caméra
  const lastActivityRef = useRef(0)
  const supabase = createClient()

  useEffect(() => { sessionRef.current = session }, [session])

  const frame = useBorneFrame(session ? borneCode : undefined, frameRefresh)

  // Taille de l'écran, pour placer le cadre
  useEffect(() => {
    const update = () => setView({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Generate or retrieve device ID
  useEffect(() => {
    let id = localStorage.getItem('animajet-device-id')
    if (!id) {
      id = `device-${Date.now()}-${Math.random().toString(36).substring(7)}`
      localStorage.setItem('animajet-device-id', id)
    }
    setDeviceId(id)
  }, [])

  // Fetch session by borne_qr_code
  useEffect(() => {
    async function fetchSession() {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('borne_qr_code', borneCode)
          .eq('is_active', true)
          .eq('borne_enabled', true)
          .single()

        if (error || !data) {
          setError('Borne non trouvée ou désactivée')
          setState('error')
          return
        }

        setSession(data)
        setFacingMode(data.borne_default_camera === 'front' ? 'user' : 'environment')
        setState(data.borne_welcome_enabled ? 'welcome' : 'camera')
      } catch {
        setError('Erreur de connexion')
        setState('error')
      }
    }

    if (borneCode) {
      fetchSession()
    }
  }, [borneCode, supabase])

  // Register borne connection and send heartbeat
  useEffect(() => {
    if (!session || !deviceId) return

    async function registerConnection() {
      if (!session) return

      const deviceType = /iPad|Macintosh/i.test(navigator.userAgent)
        ? 'ipad'
        : /Android/i.test(navigator.userAgent)
        ? 'android_tablet'
        : 'other'

      try {
        await supabase.from('borne_connections').upsert(
          {
            session_id: session.id,
            device_id: deviceId,
            device_type: deviceType,
            is_online: true,
            last_seen: new Date().toISOString(),
          },
          { onConflict: 'session_id,device_id' }
        )
      } catch (err) {
        console.error('Error registering connection:', err)
      }
    }

    registerConnection()

    // Heartbeat every 10 seconds
    const heartbeat = setInterval(async () => {
      try {
        await supabase
          .from('borne_connections')
          .update({ is_online: true, last_seen: new Date().toISOString() })
          .eq('session_id', session.id)
          .eq('device_id', deviceId)
      } catch (err) {
        console.error('Heartbeat error:', err)
      }
    }, 10000)

    // Mark offline on unmount
    return () => {
      clearInterval(heartbeat)
      supabase
        .from('borne_connections')
        .update({ is_online: false })
        .eq('session_id', session.id)
        .eq('device_id', deviceId)
    }
  }, [session, deviceId, supabase])

  // Initialize camera
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      streamRef.current = stream
      streamLandscapeRef.current = window.matchMedia('(orientation: landscape)').matches
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('Camera error:', err)
      setError('Impossible d\'accéder à la caméra')
      setState('error')
    }
  }, [facingMode])

  useEffect(() => {
    // Start camera for both camera and countdown states (et l'accueil : caméra prête au toucher)
    if ((state === 'camera' || state === 'countdown' || state === 'welcome') && session) {
      // Check if stream exists and is still active
      const streamActive = streamRef.current &&
        streamRef.current.getTracks().some(track => track.readyState === 'live')

      // Check if video is connected to stream
      const videoConnected = videoRef.current && videoRef.current.srcObject === streamRef.current

      if (!streamActive || !videoConnected) {
        startCamera()
      }
    }
  }, [state, session, startCamera])

  // Suivre la rotation de la tablette (vertical ↔ horizontal)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    const update = () => setIsLandscape(mq.matches)
    update()
    if (mq.addEventListener) {
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    }
    // Safari < 14
    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])

  // Après une rotation : si le navigateur n'a pas fait pivoter le flux caméra lui-même,
  // on le relance. Uniquement sur l'écran caméra (jamais pendant le compte à rebours) ;
  // une rotation faite pendant le décompte / l'aperçu / le résultat est traitée au retour caméra.
  useEffect(() => {
    if (state !== 'camera' || isLandscape === null) return
    if (streamLandscapeRef.current === null || streamLandscapeRef.current === isLandscape) return

    const timer = setTimeout(() => {
      const video = videoRef.current
      const stream = streamRef.current
      if (!video || !stream || !stream.getTracks().some((track) => track.readyState === 'live')) return

      if (video.videoWidth > 0 && (video.videoWidth > video.videoHeight) === isLandscape) {
        // Flux déjà dans le bon sens
        streamLandscapeRef.current = isLandscape
      } else {
        startCamera()
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [state, isLandscape, startCamera])

  // Cleanup au unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop())
      if (capturedImageUrlRef.current) URL.revokeObjectURL(capturedImageUrlRef.current)
      if (captureRetryTimeoutRef.current) clearTimeout(captureRetryTimeoutRef.current)
      if (printReturnTimeoutRef.current) clearTimeout(printReturnTimeoutRef.current)
    }
  }, [])

  // Reset to camera state
  const resetToCamera = useCallback(() => {
    if (captureRetryTimeoutRef.current) { clearTimeout(captureRetryTimeoutRef.current); captureRetryTimeoutRef.current = null }
    if (printReturnTimeoutRef.current) { clearTimeout(printReturnTimeoutRef.current); printReturnTimeoutRef.current = null }
    if (capturedImageUrlRef.current) { URL.revokeObjectURL(capturedImageUrlRef.current); capturedImageUrlRef.current = null }
    setCapturedImage(null)
    setCapturedBlob(null)
    setCountdown(sessionRef.current?.borne_countdown_duration || 3)
    setIsRocketLaunching(false)
    setLastActionWasPrint(false)
    lockedFrameRef.current = null
    setLockedFrame(null)
    setWithFrame(true)
    setFrameRefresh((k) => k + 1)
    lastActivityRef.current = Date.now()
    setState('camera')
  }, [])

  // Fin du passage d'un invité : retour à l'accueil s'il est activé, sinon caméra
  const finishGuest = useCallback(() => {
    resetToCamera()
    if (sessionRef.current?.borne_welcome_enabled) setState('welcome')
  }, [resetToCamera])

  // Écran caméra laissé sans activité : retour à l'accueil
  useEffect(() => {
    if (state !== 'camera' || !session?.borne_welcome_enabled) return
    lastActivityRef.current = Date.now()
    const markActivity = () => { lastActivityRef.current = Date.now() }
    window.addEventListener('pointerdown', markActivity)
    const timer = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= WELCOME_IDLE_MS) setState('welcome')
    }, 5000)
    return () => {
      window.removeEventListener('pointerdown', markActivity)
      clearInterval(timer)
    }
  }, [state, session?.borne_welcome_enabled])

  // Capture photo with proper error handling
  const capturePhoto = useCallback((retryCount = 0) => {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) {
      setTimeout(() => resetToCamera(), 2000)
      return
    }

    // Check video is ready and playing
    const isVideoReady = video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0

    if (!isVideoReady) {
      // Try to play the video if paused
      if (video.paused) {
        video.play().catch(() => {})
      }

      // Retry up to 10 times with longer delay
      if (retryCount < 10) {
        captureRetryTimeoutRef.current = setTimeout(() => capturePhoto(retryCount + 1), 300)
      } else {
        captureRetryTimeoutRef.current = setTimeout(() => resetToCamera(), 2000)
      }
      return
    }

    // Double-check: if video is paused, play it
    if (video.paused) {
      video.play().catch(() => {})
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setTimeout(() => resetToCamera(), 2000)
      return
    }

    try {
      const framed = lockedFrameRef.current
      let composed = false
      if (framed) {
        // Photo + cadre aux dimensions du template ; en cas d'échec, photo sans cadre
        try {
          composeFramedPhoto(canvas, video, framed.img, framed.width, framed.height, framed.zone, facingMode === 'user')
          composed = true
        } catch (err) {
          console.warn('[AnimaBooth] composition impossible, photo sans cadre', err)
        }
      }

      if (!composed) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Mirror if using front camera
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0)
          ctx.scale(-1, 1)
        }

        ctx.drawImage(video, 0, 0)
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            if (capturedImageUrlRef.current) URL.revokeObjectURL(capturedImageUrlRef.current)
            const objectUrl = URL.createObjectURL(blob)
            capturedImageUrlRef.current = objectUrl
            setCapturedBlob(blob)
            setCapturedFramed(composed)
            setCapturedImage(objectUrl)
            setState('preview')
          } else {
            setTimeout(() => resetToCamera(), 2000)
          }
        },
        'image/jpeg',
        composed ? 0.92 : 0.9
      )
    } catch {
      setTimeout(() => resetToCamera(), 2000)
    }
  }, [facingMode, resetToCamera])

  // Handle countdown
  useEffect(() => {
    if (state !== 'countdown') return

    if (countdown === 0) {
      capturePhoto()
      return
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [state, countdown, capturePhoto])

  // Auto return to camera after success
  useEffect(() => {
    if (state !== 'success') return
    const delay = (sessionRef.current?.borne_return_delay ?? 5) * 1000
    const timer = setTimeout(() => finishGuest(), delay)
    return () => clearTimeout(timer)
  }, [state, finishGuest])

  function startCountdown() {
    if (!session) return

    lockedFrameRef.current = liveFrame
    setLockedFrame(liveFrame)

    if (session.borne_countdown) {
      setCountdown(session.borne_countdown_duration)
      setState('countdown')
    } else {
      capturePhoto()
    }
  }

  async function uploadPhoto() {
    if (!capturedBlob || !session) return

    setError(null)
    setState('compressing')

    try {
      // Re-fetch session to get latest moderation setting
      const { data: freshSession } = await supabase
        .from('sessions')
        .select('moderation_enabled')
        .eq('id', session.id)
        .single()

      const moderationEnabled = freshSession?.moderation_enabled ?? false
      const isApproved = !moderationEnabled

      const file = new File([capturedBlob], 'borne-photo.jpg', { type: 'image/jpeg' })

      const compressedFile = await compressImage(file, (progress) => {
        if (progress.stage === 'done') {
          setState('uploading')
        }
      })

      setState('uploading')

      const fileName = `${session.id}/borne-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, compressedFile, {
          contentType: 'image/jpeg',
        })

      if (uploadError) throw uploadError

      const { error: dbError } = await supabase.from('photos').insert({
        session_id: session.id,
        storage_path: fileName,
        status: isApproved ? 'approved' : 'pending',
        source: 'borne',
        approved_at: isApproved ? new Date().toISOString() : null,
      })

      if (dbError) throw dbError

      setLastUploadModerated(moderationEnabled)
      setState('success')
    } catch {
      setError('Erreur lors de l\'envoi')
      setState('preview')
    }
  }

  function toggleCamera() {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }

  // Modified upload with rocket animation
  async function handleSendWithAnimation() {
    setIsRocketLaunching(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    await uploadPhoto()
  }

  // Print function
  // Vérifier si la limite d'impression est atteinte
  const printLimitReached = session?.print_enabled && session?.print_limit !== null && session?.print_limit !== undefined
    && (session?.print_count ?? 0) >= session.print_limit

  async function handlePrint() {
    if (!capturedBlob || !session) return
    if (printLimitReached) return

    // La borne ne tente pas d'imprimer localement (elle n'est pas connectée à l'imprimante).
    // Elle uploade la photo et crée une print_request → le dashboard admin (mode auto)
    // reçoit la demande en realtime et déclenche l'impression sur le PC connecté à l'imprimante.
    setState('compressing')

    try {
      const { data: freshSession } = await supabase
        .from('sessions')
        .select('moderation_enabled, print_enabled, print_limit, print_count')
        .eq('id', session.id)
        .single()

      if (!freshSession?.print_enabled) { setState('preview'); return }
      if (freshSession.print_limit !== null && (freshSession.print_count ?? 0) >= freshSession.print_limit) {
        setState('preview'); return
      }

      const moderationEnabled = freshSession?.moderation_enabled ?? false
      const isApproved = !moderationEnabled

      const file = new File([capturedBlob], 'borne-photo.jpg', { type: 'image/jpeg' })
      const compressedFile = await compressImage(file, (progress) => {
        if (progress.stage === 'done') setState('uploading')
      })
      setState('uploading')

      const fileName = `${session.id}/borne-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, compressedFile, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      const { data: photoData, error: dbError } = await supabase
        .from('photos')
        .insert({
          session_id: session.id,
          storage_path: fileName,
          status: isApproved ? 'approved' : 'pending',
          source: 'borne',
          approved_at: isApproved ? new Date().toISOString() : null,
        })
        .select()
        .single()
      if (dbError) throw dbError

      // Créer la demande d'impression → récupérée par le dashboard admin via realtime
      await supabase.from('print_requests').insert({
        session_id: session.id,
        photo_id: photoData.id,
        guest_name: null,
        status: 'pending',
        printed_at: null,
      })

      const newCount = (freshSession.print_count ?? 0) + 1
      await supabase.from('sessions').update({ print_count: newCount }).eq('id', session.id)
      setSession({ ...session, print_count: newCount })

      setLastActionWasPrint(true)
      setLastUploadModerated(moderationEnabled)
      setState('success')
    } catch {
      setState('preview')
    }

    if (printReturnTimeoutRef.current) clearTimeout(printReturnTimeoutRef.current)
    printReturnTimeoutRef.current = setTimeout(() => finishGuest(), (sessionRef.current?.borne_return_delay ?? 5) * 1000)
  }

  // Handle PIN keypress
  const handleKeyPress = (key: number | 'delete' | null) => {
    if (key === 'delete') {
      setEnteredCode(prev => prev.slice(0, -1))
      setLockError(false)
    } else if (key !== null && enteredCode.length < 4) {
      const newCode = enteredCode + key
      setEnteredCode(newCode)

      // Check if code is complete
      if (newCode.length === 4) {
        if (newCode === session?.borne_lock_code) {
          // Correct code - redirect to dashboard
          window.location.href = '/admin/dashboard'
        } else {
          // Incorrect code
          setLockError(true)
          setTimeout(() => {
            setEnteredCode('')
            setLockError(false)
          }, 1000)
        }
      }
    }
  }

  // Prevent back navigation when lock is enabled
  useEffect(() => {
    if (session?.borne_lock_enabled) {
      const preventBack = () => {
        window.history.pushState(null, '', window.location.href)
      }

      window.history.pushState(null, '', window.location.href)
      window.addEventListener('popstate', preventBack)

      return () => {
        window.removeEventListener('popstate', preventBack)
      }
    }
  }, [session?.borne_lock_enabled])

  // Cadre à afficher : celui de l'orientation de la tablette, sinon l'autre
  // (un seul template sert dans les deux sens) ; aucun si l'invité a choisi « Sans cadre ».
  const landscapeNow = isLandscape ?? (view.w > view.h)
  const orientationFrame = frame.enabled
    ? (landscapeNow ? frame.landscape ?? frame.portrait : frame.portrait ?? frame.landscape)
    : null
  const liveFrame = orientationFrame && (withFrame || !frame.guestChoice) ? orientationFrame : null
  const shownFrame = state === 'countdown' ? lockedFrame : state === 'camera' ? liveFrame : null
  const stage = shownFrame && view.w > 0 ? fitStage(view.w, view.h, landscapeNow, shownFrame.width, shownFrame.height) : null
  const zoneRect = stage && shownFrame ? zoneOnScreen(stage, shownFrame.width, shownFrame.zone) : null

  if (state === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#1A1A1E] flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        <div className="relative z-10 text-center">
          <Image
            src="/images/animajet_logo_principal.png"
            alt="AnimaJet"
            width={150}
            height={150}
            className="mx-auto mb-4 animate-pulse"
          />
          <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37] mx-auto" />
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="fixed inset-0 bg-[#1A1A1E] flex items-center justify-center p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        <div className="text-center relative z-10">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#E53935]/10 flex items-center justify-center">
            <X className="h-12 w-12 text-[#E53935]" />
          </div>
          <h1 className="text-3xl font-bold mb-4 text-white">Oups !</h1>
          <p className="text-[#B0B0B5] text-xl">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#1A1A1E] overflow-hidden select-none">
      <canvas ref={canvasRef} className="hidden" />

      {/* Lock icon - always visible when lock is enabled */}
      {session?.borne_lock_enabled && (
        <button
          onClick={() => setShowUnlockModal(true)}
          className="fixed top-4 right-4 z-[60] p-2 opacity-30 hover:opacity-60 transition-opacity"
        >
          <Lock className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Video element - ALWAYS mounted, visibility controlled separately */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${
          facingMode === 'user' ? 'scale-x-[-1]' : ''
        } ${(state === 'camera' || state === 'countdown') ? 'block' : 'hidden'}`}
        style={zoneRect ? { left: zoneRect.x, top: zoneRect.y, width: zoneRect.w, height: zoneRect.h, right: 'auto', bottom: 'auto' } : undefined}
      />

      {/* Cadre AnimaBooth posé sur la vidéo (la vidéo remplit la zone transparente) */}
      {shownFrame && stage && (
        // eslint-disable-next-line @next/next/no-img-element -- PNG du template chargé en blob:
        <img
          src={shownFrame.src}
          alt=""
          draggable={false}
          className="absolute pointer-events-none select-none"
          style={{ left: stage.x, top: stage.y, width: stage.w, height: stage.h }}
        />
      )}

      {/* Écran d'accueil (optionnel) : un toucher lance la caméra */}
      <AnimatePresence>
        {state === 'welcome' && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetToCamera}
            className="absolute inset-0 z-20 bg-[#1A1A1E] flex flex-col items-center justify-center gap-10 px-8 text-center"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#D4AF37_0%,transparent_65%)] opacity-10 pointer-events-none" />
            {session?.borne_show_event_name && (
              <h1 className="relative text-4xl landscape:text-3xl font-bold text-white max-w-3xl">{session.name}</h1>
            )}
            <motion.div
              className="relative w-40 h-40 rounded-full bg-gold-gradient flex items-center justify-center shadow-2xl glow-gold-lg"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Camera className="h-20 w-20 text-[#1A1A1E]" />
            </motion.div>
            <p className="relative text-3xl landscape:text-2xl font-semibold text-gold-gradient max-w-2xl leading-snug">
              {session?.borne_welcome_message?.trim() || WELCOME_DEFAULT_MESSAGE}
            </p>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Camera View Overlay - Controls only shown in camera state */}
      <AnimatePresence>
        {state === 'camera' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-10"
          >
            {/* Event name */}
            {session?.borne_show_event_name && !liveFrame && (
              <div className="absolute top-8 left-0 right-0 text-center landscape:px-48">
                <div className="inline-block px-6 py-3 bg-[#1A1A1E]/80 backdrop-blur-sm rounded-full border border-[#D4AF37]/30">
                  <h1 className="text-2xl font-bold text-white">
                    {session.name}
                  </h1>
                </div>
              </div>
            )}

            {/* Camera switch button */}
            <button
              onClick={toggleCamera}
              className="pointer-events-auto absolute top-8 right-8 landscape:right-24 p-4 bg-[#1A1A1E]/80 backdrop-blur-sm rounded-full text-[#D4AF37] hover:bg-[#242428] transition-colors border border-[#D4AF37]/30"
            >
              <RefreshCw className="h-8 w-8" />
            </button>

            {/* Capture button */}
            <div className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-auto landscape:inset-y-0 landscape:left-auto landscape:right-16 landscape:items-center">
              <button
                onClick={startCountdown}
                className="group relative"
              >
                <div className="w-32 h-32 rounded-full bg-gold-gradient flex items-center justify-center shadow-2xl glow-gold-lg group-hover:scale-105 transition-transform">
                  <Camera className="h-14 w-14 text-[#1A1A1E]" />
                </div>
                <span className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white font-bold text-xl whitespace-nowrap drop-shadow-lg">
                  PRENDRE UNE PHOTO
                </span>
              </button>
            </div>

            {/* Choix de l'invité : avec ou sans cadre. Vertical : barre centrée entre le
                cadre et le bouton photo ; horizontal : colonne de droite, sous « PRENDRE UNE
                PHOTO ». Jamais par-dessus le bouton, du téléphone à la grande tablette. */}
            {orientationFrame && frame.guestChoice && (
              <div
                role="group"
                aria-label="Choix du cadre"
                className="pointer-events-auto absolute bottom-[206px] left-1/2 -translate-x-1/2 w-[min(20rem,calc(100%-2rem))] flex gap-1 p-1 rounded-2xl border border-[#D4AF37]/40 bg-[#1A1A1E]/90 backdrop-blur-sm landscape:bottom-auto landscape:top-[min(calc(50%+124px),calc(100%-4rem))] landscape:left-auto landscape:right-4 landscape:translate-x-0 landscape:w-56"
              >
                <button
                  type="button"
                  aria-pressed={withFrame}
                  onClick={() => setWithFrame(true)}
                  className={`flex-1 h-12 px-2 rounded-xl flex items-center justify-center gap-1.5 text-sm font-bold whitespace-nowrap transition-colors ${withFrame ? 'bg-[#D4AF37] text-[#1A1A1E]' : 'text-gray-200'}`}
                >
                  <Frame className="h-4 w-4 shrink-0 landscape:hidden" />
                  Avec cadre
                </button>
                <button
                  type="button"
                  aria-pressed={!withFrame}
                  onClick={() => setWithFrame(false)}
                  className={`flex-1 h-12 px-2 rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors ${!withFrame ? 'bg-[#D4AF37] text-[#1A1A1E]' : 'text-gray-200'}`}
                >
                  <ImageIcon className="h-4 w-4 shrink-0 landscape:hidden" />
                  Sans cadre
                </button>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown */}
      <AnimatePresence>
        {state === 'countdown' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#1A1A1E]/90 flex flex-col items-center justify-center z-50"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span className="text-[200px] font-bold leading-none text-gold-gradient">
                {countdown}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview */}
      <AnimatePresence>
        {(state === 'preview' || state === 'compressing' || state === 'uploading') && capturedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#1A1A1E]"
          >
            <div className={['absolute inset-4 flex items-center justify-center landscape:right-48', capturedFramed && 'portrait:bottom-[210px]'].filter(Boolean).join(' ')}>
              <img
                src={capturedImage}
                alt="Captured"
                className="max-w-full max-h-full object-contain rounded-xl border-4 border-[#D4AF37]/30 shadow-gold"
              />
            </div>

            {(state === 'compressing' || state === 'uploading') ? (
              <div className="absolute inset-0 bg-[#1A1A1E]/80 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-[#D4AF37]" />
                  <p className="text-xl text-white">
                    {state === 'compressing' ? 'Optimisation de la photo...' : 'Envoi en cours...'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-6 landscape:inset-y-0 landscape:left-auto landscape:right-4 landscape:w-40 landscape:justify-center landscape:text-center">
                {/* Error display */}
                {error && (
                  <div className="px-4 py-2 rounded font-mono text-sm bg-red-500/20 text-red-400">
                    {error}
                  </div>
                )}
                {/* Main action buttons */}
                <div className="flex items-center gap-10 landscape:flex-col landscape:gap-5">
                  {/* Reprendre button */}
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      size="lg"
                      variant="secondary"
                      className="w-20 h-20 rounded-full bg-gradient-to-b from-[#D4AF37] to-[#B8960C] hover:from-[#E5C349] hover:to-[#C9A71D] text-[#1A1A1E] border-2 border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                      onClick={resetToCamera}
                    >
                      <RotateCcw className="h-8 w-8" />
                    </Button>
                    <span className="text-[#D4AF37] text-sm font-medium">Reprendre</span>
                  </div>

                  {/* Rocket Send button */}
                  <div className="flex flex-col items-center gap-2">
                    <RocketButton
                      onClick={handleSendWithAnimation}
                      disabled={isRocketLaunching}
                      isLaunching={isRocketLaunching}
                    />
                    <span className="text-[#D4AF37] text-lg font-bold">ENVOYER</span>
                  </div>

                  {/* Print button */}
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      size="lg"
                      variant="secondary"
                      className="w-20 h-20 rounded-full bg-gradient-to-b from-[#D4AF37] to-[#B8960C] hover:from-[#E5C349] hover:to-[#C9A71D] text-[#1A1A1E] border-2 border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.4)] disabled:opacity-40"
                      onClick={handlePrint}
                      disabled={!!printLimitReached}
                    >
                      <Printer className="h-8 w-8" />
                    </Button>
                    <span className="text-[#D4AF37] text-sm font-medium">
                      {printLimitReached ? 'Limite atteinte' : 'Imprimer'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success */}
      <AnimatePresence>
        {state === 'success' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#1A1A1E] flex items-center justify-center"
          >
            {/* Gold radial gradient background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#D4AF37_0%,transparent_70%)] opacity-10" />

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="text-center relative z-10"
            >
              <motion.div
                animate={{
                  rotate: [0, -10, 10, -10, 0],
                }}
                transition={{
                  duration: 0.5,
                  delay: 0.3,
                }}
              >
                <div className="w-40 h-40 mx-auto mb-8 rounded-full bg-[#4CAF50]/10 flex items-center justify-center">
                  <Sparkles className="h-20 w-20 text-[#D4AF37]" />
                </div>
              </motion.div>
              <h1 className="text-5xl font-bold mb-4 text-gold-gradient">Super !</h1>
              <p className="text-2xl text-[#B0B0B5]">
                {lastActionWasPrint
                  ? 'Impression en cours...'
                  : lastUploadModerated
                  ? 'Photo envoyée pour validation'
                  : 'Photo ajoutée au diaporama !'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unlock Modal */}
      <AnimatePresence>
        {showUnlockModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#242428] border border-[#D4AF37] rounded-2xl p-8 max-w-sm w-full mx-4"
            >
              <h2 className="text-white text-xl font-bold text-center mb-6 flex items-center justify-center gap-2">
                <Lock className="h-5 w-5 text-[#D4AF37]" />
                Déverrouiller la borne
              </h2>

              {/* PIN dots */}
              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3].map((index) => (
                  <motion.div
                    key={index}
                    className={`w-4 h-4 rounded-full border-2 border-[#D4AF37] ${
                      enteredCode.length > index ? 'bg-[#D4AF37]' : 'bg-transparent'
                    }`}
                    animate={lockError ? { x: [-5, 5, -5, 5, 0] } : {}}
                    transition={{ duration: 0.3 }}
                  />
                ))}
              </div>

              {/* Numeric keypad */}
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'delete'].map((num, i) => (
                  <button
                    key={i}
                    onClick={() => handleKeyPress(num as number | 'delete' | null)}
                    disabled={num === null}
                    className={`h-14 rounded-xl text-2xl font-bold transition-colors ${
                      num === null
                        ? 'invisible'
                        : num === 'delete'
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40 active:bg-red-500/60'
                        : 'bg-[#2E2E33] text-white hover:bg-[#D4AF37] hover:text-black active:bg-[#F4D03F]'
                    }`}
                  >
                    {num === 'delete' ? <Delete className="h-6 w-6 mx-auto" /> : num}
                  </button>
                ))}
              </div>

              {/* Error message */}
              {lockError && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-center mt-4"
                >
                  Code incorrect
                </motion.p>
              )}

              {/* Cancel button */}
              <button
                onClick={() => {
                  setShowUnlockModal(false)
                  setEnteredCode('')
                  setLockError(false)
                }}
                className="w-full mt-6 py-3 text-gray-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
