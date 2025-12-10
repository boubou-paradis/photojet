'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'react-qr-code'
import { Maximize, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Session, Photo } from '@/types/database'

const transitions = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-100%', opacity: 0 },
  },
  zoom: {
    initial: { scale: 1.2, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.8, opacity: 0 },
  },
}

export default function LivePage() {
  const params = useParams()
  const code = params.code as string

  const [session, setSession] = useState<Session | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const supabase = createClient()

  const fetchSession = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('code', code)
        .single()

      if (error) throw error
      setSession(data)
    } catch (err) {
      console.error('Error fetching session:', err)
    }
  }, [code, supabase])

  const fetchPhotos = useCallback(async () => {
    if (!session) return
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('session_id', session.id)
        .eq('status', 'approved')
        .order('approved_at', { ascending: true })

      if (error) throw error
      setPhotos(data || [])
    } catch (err) {
      console.error('Error fetching photos:', err)
    } finally {
      setLoading(false)
    }
  }, [session, supabase])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  useEffect(() => {
    if (session) {
      fetchPhotos()

      const channel = supabase
        .channel(`live-photos-${session.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'photos',
            filter: `session_id=eq.${session.id}`,
          },
          () => {
            fetchPhotos()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [session, fetchPhotos, supabase])

  useEffect(() => {
    if (photos.length <= 1) return

    const duration = (session?.transition_duration || 5) * 1000
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length)
    }, duration)

    return () => clearInterval(interval)
  }, [photos.length, session?.transition_duration])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  function getPhotoUrl(storagePath: string) {
    const { data } = supabase.storage.from('photos').getPublicUrl(storagePath)
    return data.publicUrl
  }

  const transitionType = session?.transition_type || 'fade'
  const currentPhoto = photos[currentIndex]

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        <div className="text-center text-white relative z-10">
          <Image
            src="/logo.png"
            alt="PhotoJet"
            width={80}
            height={80}
            className="mx-auto mb-4 animate-pulse"
          />
          <p className="text-xl text-[#B0B0B5]">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A1E] overflow-hidden relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/3 via-transparent to-[#D4AF37]/3" />

      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-50 p-3 bg-[#242428]/80 hover:bg-[#2E2E33] border border-[rgba(255,255,255,0.1)] rounded-full transition-colors backdrop-blur-sm"
        title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
      >
        <Maximize className="h-6 w-6 text-[#D4AF37]" />
      </button>

      {photos.length === 0 ? (
        <div className="h-screen flex flex-col items-center justify-center text-white relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
              <ImageIcon className="h-14 w-14 text-[#D4AF37]" />
            </div>
            <h1 className="text-4xl font-bold mb-4 text-white">{session.name}</h1>
            <p className="text-xl text-[#B0B0B5] mb-8">
              En attente des premières photos...
            </p>

            {session.show_qr_on_screen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col items-center"
              >
                <div className="bg-white p-6 rounded-2xl shadow-gold glow-gold">
                  <QRCode
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${code}`}
                    size={200}
                  />
                </div>
                <p className="mt-4 text-3xl font-mono font-bold text-gold-gradient">#{code}</p>
                <p className="text-[#B0B0B5] mt-2">
                  Scannez pour partager vos photos
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>
      ) : (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPhoto?.id || currentIndex}
              variants={transitions[transitionType]}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className="absolute inset-0 flex items-center justify-center p-8 z-10"
            >
              {currentPhoto && (
                <div className="relative">
                  <img
                    src={getPhotoUrl(currentPhoto.storage_path)}
                    alt="Photo"
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border-2 border-[#D4AF37]/20"
                  />
                  {/* Gold glow effect */}
                  <div className="absolute inset-0 rounded-lg shadow-gold pointer-events-none" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#1A1A1E] via-[#1A1A1E]/80 to-transparent z-20">
            <div className="flex items-end justify-between">
              <div className="flex items-center gap-4">
                <Image
                  src="/logo.png"
                  alt="PhotoJet"
                  width={50}
                  height={50}
                  className="drop-shadow-lg"
                />
                <div>
                  <h1 className="text-2xl font-bold text-white">{session.name}</h1>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[#D4AF37] font-semibold">
                      {currentIndex + 1} / {photos.length}
                    </span>
                    {currentPhoto?.uploader_name && (
                      <span className="text-[#B0B0B5]">
                        par {currentPhoto.uploader_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {session.show_qr_on_screen && (
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2 rounded-lg shadow-gold">
                    <QRCode
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${code}`}
                      size={80}
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-mono font-bold text-[#D4AF37]">#{code}</p>
                    <p className="text-sm text-[#B0B0B5]">Partagez vos photos</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-30">
            {photos.slice(0, 10).map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentIndex % 10
                    ? 'w-8 bg-[#D4AF37]'
                    : 'w-1.5 bg-[#D4AF37]/30'
                }`}
              />
            ))}
            {photos.length > 10 && (
              <span className="text-[#D4AF37]/50 text-xs ml-2">
                +{photos.length - 10}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
