'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  RotateCcw,
  Check,
  X,
  RefreshCw,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session } from '@/types/database'
import { compressImage } from '@/lib/image-utils'

type BorneState = 'loading' | 'error' | 'camera' | 'countdown' | 'preview' | 'uploading' | 'success'

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

  // Handle countdown
  useEffect(() => {
    if (state !== 'countdown') return

    if (countdown <= 0) {
      capturePhoto()
      return
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [state, countdown])

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

    if (session.borne_countdown) {
      setCountdown(session.borne_countdown_duration)
      setState('countdown')
    } else {
      capturePhoto()
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Mirror if using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob)
          setCapturedImage(URL.createObjectURL(blob))
          setState('preview')
        }
      },
      'image/jpeg',
      0.9
    )
  }

  async function uploadPhoto() {
    if (!capturedBlob || !session) return

    setState('uploading')

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
      const compressedFile = await compressImage(file)

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

      // Update local session state for UI feedback
      setSession({ ...session, moderation_enabled: moderationEnabled })
      setState('success')
    } catch (err) {
      console.error('Upload error:', err)
      setError('Erreur lors de l\'envoi')
      setState('preview')
    }
  }

  function resetToCamera() {
    setCapturedImage(null)
    setCapturedBlob(null)
    setCountdown(session?.borne_countdown_duration || 3)
    setState('camera')
  }

  function toggleCamera() {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
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

      {/* Camera View */}
      <AnimatePresence>
        {state === 'camera' && (
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

            {/* Overlay */}
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
            </div>
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
            className="absolute inset-0 bg-[#1A1A1E]/90 flex items-center justify-center z-50"
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
        {(state === 'preview' || state === 'uploading') && capturedImage && (
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

            {state === 'uploading' ? (
              <div className="absolute inset-0 bg-[#1A1A1E]/80 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-[#D4AF37]" />
                  <p className="text-xl text-white">Envoi en cours...</p>
                </div>
              </div>
            ) : (
              <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-8">
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-20 px-10 text-xl bg-[#2E2E33] hover:bg-[#3E3E43] text-white border border-[rgba(255,255,255,0.1)]"
                  onClick={resetToCamera}
                >
                  <RotateCcw className="h-8 w-8 mr-3" />
                  Reprendre
                </Button>
                <Button
                  size="lg"
                  className="h-20 px-10 text-xl bg-gold-gradient text-[#1A1A1E] font-semibold hover:opacity-90 glow-gold"
                  onClick={uploadPhoto}
                >
                  <Check className="h-8 w-8 mr-3" />
                  Valider
                </Button>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
