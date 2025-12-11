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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session } from '@/types/database'
import { compressImage } from '@/lib/image-utils'

type BorneState = 'loading' | 'error' | 'camera' | 'countdown' | 'preview' | 'compressing' | 'uploading' | 'success' | 'printing'

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
  const [debugStatus, setDebugStatus] = useState<string>('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const supabase = createClient()

  // Generate or retrieve device ID
  useEffect(() => {
    let id = localStorage.getItem('photojet-device-id')
    if (!id) {
      id = `device-${Date.now()}-${Math.random().toString(36).substring(7)}`
      localStorage.setItem('photojet-device-id', id)
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
        setState('camera')
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
    if (state === 'camera' && session) {
      startCamera()
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [state, session, startCamera])

  // Reset to camera state
  const resetToCamera = useCallback(() => {
    console.log('[Borne] Resetting to camera')
    setCapturedImage(null)
    setCapturedBlob(null)
    setCountdown(session?.borne_countdown_duration || 3)
    setIsRocketLaunching(false)
    setState('camera')
  }, [session?.borne_countdown_duration])

  // Capture photo with proper error handling
  const capturePhoto = useCallback((retryCount = 0) => {
    console.log('[Borne] capturePhoto called, retry:', retryCount)
    setDebugStatus(`Capture photo... (essai ${retryCount + 1})`)

    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) {
      console.error('[Borne] Video or canvas ref not available')
      setDebugStatus('ERREUR: Video/canvas non disponible')
      setTimeout(() => resetToCamera(), 2000)
      return
    }

    // Check video is ready
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('[Borne] Video dimensions not ready:', video.videoWidth, video.videoHeight)
      setDebugStatus(`Video pas prête: ${video.videoWidth}x${video.videoHeight}`)

      // Retry up to 5 times
      if (retryCount < 5) {
        setTimeout(() => {
          capturePhoto(retryCount + 1)
        }, 500)
      } else {
        setDebugStatus('ERREUR: Video non prête après 5 essais')
        setTimeout(() => resetToCamera(), 2000)
      }
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('[Borne] Could not get canvas context')
      setDebugStatus('ERREUR: Canvas context non disponible')
      setTimeout(() => resetToCamera(), 2000)
      return
    }

    try {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      console.log('[Borne] Canvas size:', canvas.width, 'x', canvas.height)
      setDebugStatus(`Canvas: ${canvas.width}x${canvas.height}`)

      // Mirror if using front camera
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }

      ctx.drawImage(video, 0, 0)
      console.log('[Borne] Image drawn to canvas')
      setDebugStatus('Image capturée, création blob...')

      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log('[Borne] Blob created:', blob.size, 'bytes')
            setDebugStatus(`Blob créé: ${Math.round(blob.size / 1024)} Ko`)
            setCapturedBlob(blob)
            setCapturedImage(URL.createObjectURL(blob))
            setState('preview')
          } else {
            console.error('[Borne] Failed to create blob')
            setDebugStatus('ERREUR: Blob null')
            setTimeout(() => resetToCamera(), 2000)
          }
        },
        'image/jpeg',
        0.9
      )
    } catch (err) {
      console.error('[Borne] Error capturing photo:', err)
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue'
      setDebugStatus(`ERREUR capture: ${errorMsg}`)
      setTimeout(() => resetToCamera(), 2000)
    }
  }, [facingMode, resetToCamera])

  // Handle countdown
  useEffect(() => {
    if (state !== 'countdown') return

    if (countdown === 0) {
      console.log('[Borne] Countdown finished, capturing photo')
      capturePhoto()
      return
    }

    const timer = setTimeout(() => {
      console.log('[Borne] Countdown:', countdown - 1)
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [state, countdown, capturePhoto])

  // Auto return to camera after success
  useEffect(() => {
    if (state !== 'success' || !session) return

    const timer = setTimeout(() => {
      resetToCamera()
    }, session.borne_return_delay * 1000)

    return () => clearTimeout(timer)
  }, [state, session])

  function startCountdown() {
    if (!session) return
    console.log('[Borne] Starting countdown, borne_countdown:', session.borne_countdown)

    if (session.borne_countdown) {
      setCountdown(session.borne_countdown_duration)
      setState('countdown')
    } else {
      capturePhoto()
    }
  }

  async function uploadPhoto() {
    console.log('[Borne] uploadPhoto called')
    setDebugStatus('Démarrage upload...')

    if (!capturedBlob || !session) {
      console.error('[Borne] Missing capturedBlob or session')
      setDebugStatus('ERREUR: Pas de photo ou session')
      return
    }

    setDebugStatus(`Photo: ${Math.round(capturedBlob.size / 1024)} Ko`)
    setState('compressing')

    try {
      // Re-fetch session to get latest moderation setting
      setDebugStatus('Vérification session...')
      const { data: freshSession, error: sessionError } = await supabase
        .from('sessions')
        .select('moderation_enabled')
        .eq('id', session.id)
        .single()

      if (sessionError) {
        console.error('[Borne] Error fetching session:', sessionError)
        setDebugStatus(`ERREUR session: ${sessionError.message}`)
      }

      const moderationEnabled = freshSession?.moderation_enabled ?? false
      const isApproved = !moderationEnabled

      const file = new File([capturedBlob], 'borne-photo.jpg', { type: 'image/jpeg' })
      setDebugStatus('Compression en cours...')

      const compressedFile = await compressImage(file, (progress) => {
        if (progress.progress) {
          setDebugStatus(`Compression: ${progress.progress}%`)
        }
        if (progress.stage === 'done') {
          setState('uploading')
        }
      })

      setDebugStatus(`Compressé: ${Math.round(compressedFile.size / 1024)} Ko`)
      setState('uploading')

      const fileName = `${session.id}/borne-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
      setDebugStatus('Upload vers Storage...')

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, compressedFile, {
          contentType: 'image/jpeg',
        })

      if (uploadError) {
        console.error('[Borne] Storage upload error:', uploadError)
        setDebugStatus(`ERREUR Storage: ${uploadError.message}`)
        throw uploadError
      }

      setDebugStatus('Storage OK! Enregistrement DB...')

      const { data: dbData, error: dbError } = await supabase.from('photos').insert({
        session_id: session.id,
        storage_path: fileName,
        status: isApproved ? 'approved' : 'pending',
        source: 'borne',
        approved_at: isApproved ? new Date().toISOString() : null,
      }).select()

      if (dbError) {
        console.error('[Borne] Database insert error:', dbError)
        setDebugStatus(`ERREUR DB: ${dbError.message}`)
        throw dbError
      }

      setDebugStatus('SUCCESS! Photo envoyée!')
      setSession({ ...session, moderation_enabled: moderationEnabled })
      setState('success')
    } catch (err: unknown) {
      console.error('[Borne] Upload error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setDebugStatus(`ERREUR: ${errorMessage}`)
      setError('Erreur lors de l\'envoi')
      setState('preview')
    }
  }

  function toggleCamera() {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }

  // Modified upload with rocket animation
  async function handleSendWithAnimation() {
    console.log('[Borne] handleSendWithAnimation called - starting rocket animation')
    setIsRocketLaunching(true)
    // Wait for animation before upload
    await new Promise(resolve => setTimeout(resolve, 800))
    console.log('[Borne] Animation done, calling uploadPhoto')
    await uploadPhoto()
  }

  // Print function
  async function handlePrint() {
    if (!capturedImage) return

    setState('printing')

    // Create a print window with the captured image
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>PhotoJet - Impression</title>
            <style>
              @page { margin: 0; }
              body {
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: #000;
              }
              img {
                max-width: 100%;
                max-height: 100vh;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <img src="${capturedImage}" onload="window.print(); window.close();" />
          </body>
        </html>
      `)
      printWindow.document.close()
    }

    // Return to camera after delay
    setTimeout(() => {
      resetToCamera()
    }, (session?.borne_return_delay || 5) * 1000)
  }

  if (state === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#1A1A1E] flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        <div className="relative z-10 text-center">
          <Image
            src="/logo.png"
            alt="PhotoJet"
            width={100}
            height={100}
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

      {/* Camera View - Keep mounted during countdown to preserve videoRef */}
      <AnimatePresence>
        {(state === 'camera' || state === 'countdown') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              }`}
            />

            {/* Overlay - Only show controls when in camera state */}
            {state === 'camera' && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Event name */}
                {session?.borne_show_event_name && (
                  <div className="absolute top-8 left-0 right-0 text-center">
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
                  className="pointer-events-auto absolute top-8 right-8 p-4 bg-[#1A1A1E]/80 backdrop-blur-sm rounded-full text-[#D4AF37] hover:bg-[#242428] transition-colors border border-[#D4AF37]/30"
                >
                  <RefreshCw className="h-8 w-8" />
                </button>

                {/* Capture button */}
                <div className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-auto">
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

                {/* Logo */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <Image
                    src="/logo.png"
                    alt="PhotoJet"
                    width={30}
                    height={30}
                    className="opacity-60"
                  />
                  <span className="text-[#D4AF37]/60 text-sm font-medium">PhotoJet</span>
                </div>

                {/* Debug status on camera screen */}
                {debugStatus && (
                  <div className="absolute bottom-4 right-4 pointer-events-none">
                    <p className="text-xs text-[#D4AF37] font-mono bg-black/70 px-3 py-1 rounded">
                      {debugStatus}
                    </p>
                  </div>
                )}
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
            {debugStatus && (
              <p className="mt-8 text-sm text-[#D4AF37] font-mono bg-black/50 px-4 py-2 rounded">
                {debugStatus}
              </p>
            )}
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
            <div className="absolute inset-4 flex items-center justify-center">
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
                  <p className="text-xl text-white mb-2">
                    {state === 'compressing' ? 'Optimisation de la photo...' : 'Envoi en cours...'}
                  </p>
                  {debugStatus && (
                    <p className="text-sm text-[#D4AF37] font-mono bg-black/50 px-4 py-2 rounded">
                      {debugStatus}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-6">
                {/* Error/Debug display */}
                {(error || debugStatus) && (
                  <div className={`px-4 py-2 rounded font-mono text-sm ${error ? 'bg-red-500/20 text-red-400' : 'bg-black/50 text-[#D4AF37]'}`}>
                    {error || debugStatus}
                  </div>
                )}
                {/* Main action buttons */}
                <div className="flex items-center gap-10">
                  {/* Reprendre button */}
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      size="lg"
                      variant="secondary"
                      className="w-20 h-20 rounded-full bg-[#2E2E33] hover:bg-[#3E3E43] text-white border border-[rgba(255,255,255,0.1)]"
                      onClick={resetToCamera}
                    >
                      <RotateCcw className="h-8 w-8" />
                    </Button>
                    <span className="text-white/70 text-sm font-medium">Reprendre</span>
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
                      className="w-20 h-20 rounded-full bg-[#2E2E33] hover:bg-[#3E3E43] text-white border border-[rgba(255,255,255,0.1)]"
                      onClick={handlePrint}
                    >
                      <Printer className="h-8 w-8" />
                    </Button>
                    <span className="text-white/70 text-sm font-medium">Imprimer</span>
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
                {session?.moderation_enabled
                  ? 'Photo envoyée pour validation'
                  : 'Photo ajoutée au diaporama !'}
              </p>
              {debugStatus && (
                <p className="text-sm text-[#4CAF50] font-mono mt-4 bg-black/30 px-4 py-2 rounded">
                  {debugStatus}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
