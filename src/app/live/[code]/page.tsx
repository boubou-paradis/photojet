'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'react-qr-code'
import { Maximize, Minimize, ImagePlus, MessageCircle, Quote } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Session, Photo, Message } from '@/types/database'
import { getInviteUrl } from '@/lib/utils'
import MysteryPhotoGame from '@/components/games/MysteryPhotoGame'
import LineupGame from '@/components/games/LineupGame'

// Types for slideshow items
type SlideshowItem =
  | { type: 'photo'; data: Photo }
  | { type: 'message'; data: Message }

// Rocket Animation Component
interface RocketProps {
  delay: number
  duration: number
  startX: number
  size: number
  curveIntensity: number
  opacity: number
}

function Rocket({ delay, duration, startX, size, curveIntensity, opacity }: RocketProps) {
  // Use a fixed height that works for most screens - rockets will still animate correctly
  const screenHeight = 1200

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${startX}%`,
        bottom: '-100px',
        zIndex: 5,
        willChange: 'transform',
      }}
      initial={{ y: 0, x: 0, opacity: 0 }}
      animate={{
        y: [0, -screenHeight - 200],
        x: [0, curveIntensity, curveIntensity * 0.5, curveIntensity * 1.2, 0],
        opacity: [0, opacity, opacity, opacity, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full blur-md"
        style={{
          width: size * 0.6,
          height: size * 3,
          bottom: -size * 2,
          background: 'linear-gradient(to top, transparent, rgba(212, 175, 55, 0.3), rgba(244, 208, 63, 0.5))',
        }}
      />
      <svg
        width={size}
        height={size * 1.8}
        viewBox="0 0 40 72"
        fill="none"
        style={{ filter: 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.6))' }}
      >
        <defs>
          <linearGradient id={`rocketGradient-${startX}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#F4D03F" />
          </linearGradient>
        </defs>
        <path
          d="M20 0 C20 0, 8 20, 8 35 L8 50 L32 50 L32 35 C32 20, 20 0, 20 0Z"
          fill={`url(#rocketGradient-${startX})`}
        />
        <rect x="8" y="50" width="24" height="10" fill={`url(#rocketGradient-${startX})`} />
        <path d="M8 45 L0 65 L8 60 Z" fill={`url(#rocketGradient-${startX})`} />
        <path d="M32 45 L40 65 L32 60 Z" fill={`url(#rocketGradient-${startX})`} />
        <circle cx="20" cy="35" r="6" fill="#1A1A1E" />
        <circle cx="20" cy="35" r="4" fill="rgba(212, 175, 55, 0.3)" />
        <path
          d="M12 60 L14 72 L20 65 L26 72 L28 60 Z"
          fill="#F4D03F"
          style={{ filter: 'blur(1px)' }}
        />
      </svg>
    </motion.div>
  )
}

// Pre-generated rocket data to avoid Math.random in render
const ROCKET_DATA = [
  { id: 0, delay: 1.2, duration: 10, startX: 15, size: 28, curveIntensity: 30, opacity: 0.6 },
  { id: 1, delay: 3.5, duration: 12, startX: 35, size: 35, curveIntensity: -25, opacity: 0.7 },
  { id: 2, delay: 0.8, duration: 9, startX: 55, size: 22, curveIntensity: 45, opacity: 0.5 },
  { id: 3, delay: 5.2, duration: 11, startX: 75, size: 30, curveIntensity: -40, opacity: 0.65 },
  { id: 4, delay: 2.1, duration: 13, startX: 25, size: 40, curveIntensity: 20, opacity: 0.75 },
  { id: 5, delay: 6.8, duration: 10, startX: 65, size: 25, curveIntensity: -35, opacity: 0.55 },
  { id: 6, delay: 4.0, duration: 14, startX: 85, size: 32, curveIntensity: 50, opacity: 0.8 },
]

function RocketAnimation() {
  const rockets = ROCKET_DATA

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {rockets.map((rocket) => (
        <Rocket key={rocket.id} {...rocket} />
      ))}
    </div>
  )
}

// Animated counter component
function AnimatedCounter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="text-[#D4AF37] font-bold tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <span className="text-white/70">{label}</span>
    </div>
  )
}

// New photo notification component
function NewPhotoNotification({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 px-6 py-3 bg-[#D4AF37] rounded-full shadow-lg shadow-[#D4AF37]/30">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
            >
              <ImagePlus className="h-5 w-5 text-[#1A1A1E]" />
            </motion.div>
            <span className="font-semibold text-[#1A1A1E]">+1 nouvelle photo !</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Message display component - SMS bubble style
function MessageDisplay({ message }: { message: Message }) {
  const content = message.content
  const length = content.length

  // Calculate font size based on message length
  const getFontSize = () => {
    if (length < 50) return '2.5rem'
    if (length < 100) return '2rem'
    if (length < 150) return '1.5rem'
    return '1.25rem'
  }

  console.log('[MessageDisplay] Rendering message:', message.id, content.substring(0, 30) + '...')

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.95 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 flex items-center justify-center z-50"
    >
      <div className="relative max-w-2xl mx-4">
        {/* SMS Bubble */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
          className="bg-[#242428] border-2 border-[#D4AF37] rounded-3xl p-8 shadow-2xl"
          style={{ boxShadow: '0 0 40px rgba(212, 175, 55, 0.3), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
        >
          {/* Opening quote */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="text-[#D4AF37] text-5xl mb-4 text-center font-serif"
          >
            &ldquo;
          </motion.div>

          {/* Message content */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-white text-center font-medium leading-relaxed"
            style={{
              fontSize: getFontSize(),
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            {content}
          </motion.p>

          {/* Closing quote */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="text-[#D4AF37] text-5xl mt-4 text-center font-serif"
          >
            &rdquo;
          </motion.div>

          {/* Author name */}
          {message.author_name && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="text-[#D4AF37] text-xl italic text-center mt-6 font-medium"
            >
              — {message.author_name}
            </motion.p>
          )}
        </motion.div>

        {/* SMS bubble tail (triangle) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="absolute -bottom-4 left-1/2 transform -translate-x-1/2"
        >
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '20px solid transparent',
              borderRight: '20px solid transparent',
              borderTop: '20px solid #242428',
              filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))'
            }}
          />
          {/* Golden border for tail */}
          <div
            className="absolute -top-[2px] left-1/2 transform -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '22px solid transparent',
              borderRight: '22px solid transparent',
              borderTop: '22px solid #D4AF37',
              zIndex: -1
            }}
          />
        </motion.div>
      </div>
    </motion.div>
  )
}

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
    initial: { scale: 1.1, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
  },
}

const logoSizes = {
  small: { width: 40, height: 40 },
  medium: { width: 60, height: 60 },
  large: { width: 80, height: 80 },
}

export default function LivePage() {
  const params = useParams()
  const code = params.code as string

  const [session, setSession] = useState<Session | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showUI, setShowUI] = useState(true)
  const [showNewPhotoNotification, setShowNewPhotoNotification] = useState(false)
  const previousPhotosCount = useRef(0)
  const hideUITimeout = useRef<NodeJS.Timeout | null>(null)
  const messageIndex = useRef(0)
  const supabase = createClient()

  // Lineup game state (updated via broadcast from admin)
  const [lineupState, setLineupState] = useState<{
    gameActive: boolean
    currentNumber: string
    timeLeft: number
    isRunning: boolean
    isPaused: boolean
    isGameOver: boolean
    currentPoints: number
    team1Score: number
    team2Score: number
    team1Name: string
    team2Name: string
    showWinner: boolean
    clockDuration: number
  } | null>(null)

  // Build slideshow items list - interleaving messages with photos
  const slideshowItems = useMemo((): SlideshowItem[] => {
    const messagesEnabled = session?.messages_enabled ?? true
    const frequency = session?.messages_frequency || 4
    const approvedMessages = messages.filter(m => m.status === 'approved')

    console.log('[Live] Building slideshow:', {
      photosCount: photos.length,
      messagesCount: messages.length,
      approvedMessagesCount: approvedMessages.length,
      messagesEnabled,
      frequency
    })

    // If no photos and no messages, return empty
    if (photos.length === 0 && approvedMessages.length === 0) {
      return []
    }

    // If only messages (no photos), show all messages
    if (photos.length === 0 && messagesEnabled && approvedMessages.length > 0) {
      console.log('[Live] No photos, showing only messages')
      return approvedMessages.map(msg => ({ type: 'message' as const, data: msg }))
    }

    // If messages disabled or no messages, show only photos
    if (!messagesEnabled || approvedMessages.length === 0) {
      return photos.map(photo => ({ type: 'photo' as const, data: photo }))
    }

    // Interleave photos and messages
    const items: SlideshowItem[] = []
    let msgIdx = 0

    photos.forEach((photo, idx) => {
      items.push({ type: 'photo', data: photo })

      // Insert a message after every 'frequency' photos
      if ((idx + 1) % frequency === 0 && approvedMessages.length > 0) {
        items.push({ type: 'message', data: approvedMessages[msgIdx % approvedMessages.length] })
        msgIdx++
      }
    })

    // If we have messages but none were inserted (less photos than frequency), add one at the end
    if (approvedMessages.length > 0 && msgIdx === 0) {
      items.push({ type: 'message', data: approvedMessages[0] })
    }

    console.log('[Live] Slideshow items built:', items.length, 'items with', items.filter(i => i.type === 'message').length, 'messages')
    return items
  }, [photos, messages, session?.messages_enabled, session?.messages_frequency])

  // Get current item duration
  const getCurrentDuration = useCallback(() => {
    const currentItem = slideshowItems[currentIndex]
    if (!currentItem) return (session?.transition_duration || 5) * 1000

    if (currentItem.type === 'message') {
      return (session?.messages_duration || 8) * 1000
    }
    return (session?.transition_duration || 5) * 1000
  }, [currentIndex, slideshowItems, session?.transition_duration, session?.messages_duration])

  // Hide UI after inactivity
  const resetUITimer = useCallback(() => {
    setShowUI(true)
    if (hideUITimeout.current) {
      clearTimeout(hideUITimeout.current)
    }
    hideUITimeout.current = setTimeout(() => {
      if (isFullscreen) {
        setShowUI(false)
      }
    }, 5000)
  }, [isFullscreen])

  useEffect(() => {
    const handleMouseMove = () => resetUITimer()
    const handleClick = () => resetUITimer()

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      if (hideUITimeout.current) {
        clearTimeout(hideUITimeout.current)
      }
    }
  }, [resetUITimer])

  // Show UI when not fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      setShowUI(true)
      if (hideUITimeout.current) {
        clearTimeout(hideUITimeout.current)
      }
    } else {
      resetUITimer()
    }
  }, [isFullscreen, resetUITimer])

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

      const newPhotos = data || []

      // Show notification if new photo arrived
      if (previousPhotosCount.current > 0 && newPhotos.length > previousPhotosCount.current) {
        setShowNewPhotoNotification(true)
        setTimeout(() => setShowNewPhotoNotification(false), 3000)
      }
      previousPhotosCount.current = newPhotos.length

      setPhotos(newPhotos)
    } catch (err) {
      console.error('Error fetching photos:', err)
    } finally {
      setLoading(false)
    }
  }, [session, supabase])

  const fetchMessages = useCallback(async () => {
    if (!session) return
    try {
      // First fetch ALL messages to see what's in the DB
      const { data: allMessages, error: allError } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true })

      if (allError) {
        console.error('[Live] Error fetching all messages:', allError)
      } else {
        console.log('[Live] ALL messages in DB:', allMessages?.length || 0, allMessages?.map(m => ({ id: m.id, status: m.status, content: m.content?.substring(0, 20) })))
      }

      // Now fetch only approved ones
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', session.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: true })

      if (error) throw error
      console.log('[Live] APPROVED messages:', data?.length || 0, 'messages_enabled:', session.messages_enabled)
      setMessages(data || [])
    } catch (err) {
      console.error('Error fetching messages:', err)
    }
  }, [session, supabase])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  useEffect(() => {
    if (session) {
      fetchPhotos()
      fetchMessages()

      // Subscribe to photos changes
      const photosChannel = supabase
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

      // Subscribe to messages changes
      const messagesChannel = supabase
        .channel(`live-messages-${session.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `session_id=eq.${session.id}`,
          },
          () => {
            fetchMessages()
          }
        )
        .subscribe()

      // Subscribe to session changes (for settings updates like show_qr_on_screen)
      const sessionChannel = supabase
        .channel(`live-session-${session.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sessions',
            filter: `id=eq.${session.id}`,
          },
          async () => {
            // Re-fetch the full session to get updated values
            const { data } = await supabase
              .from('sessions')
              .select('*')
              .eq('id', session.id)
              .single()
            if (data) {
              setSession(data)
            }
          }
        )
        .subscribe()

      // Polling fallback: check session, photos, and messages every 5 seconds
      const pollInterval = setInterval(async () => {
        // Fetch session
        const { data } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', session.id)
          .single()
        if (data) {
          setSession((prev) => {
            // Only update if something changed
            if (JSON.stringify(prev) !== JSON.stringify(data)) {
              return data
            }
            return prev
          })
        }
        // Also poll for new photos and messages (fallback if realtime doesn't work)
        fetchPhotos()
        fetchMessages()
      }, 5000)

      return () => {
        supabase.removeChannel(photosChannel)
        supabase.removeChannel(messagesChannel)
        supabase.removeChannel(sessionChannel)
        clearInterval(pollInterval)
      }
    }
  }, [session?.id, fetchPhotos, fetchMessages, supabase])

  // Subscribe to Lineup game broadcast channel for real-time sync
  useEffect(() => {
    if (!session?.code) return

    const lineupChannel = supabase
      .channel(`lineup-game-${session.code}`)
      .on('broadcast', { event: 'lineup_state' }, (payload) => {
        console.log('[Live] Received lineup broadcast:', payload)
        if (payload.payload) {
          setLineupState(payload.payload)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(lineupChannel)
    }
  }, [session?.code, supabase])

  // Log current item for debugging
  useEffect(() => {
    const item = slideshowItems[currentIndex]
    console.log('[Live] Current slide:', {
      index: currentIndex,
      total: slideshowItems.length,
      type: item?.type,
      id: item?.data?.id,
      content: item?.type === 'message' ? item.data.content?.substring(0, 30) : 'photo'
    })
  }, [currentIndex, slideshowItems])

  // Slideshow timer with variable duration
  // Use ref to get current items without triggering effect re-run
  const slideshowItemsRef = useRef(slideshowItems)
  useEffect(() => {
    slideshowItemsRef.current = slideshowItems
  }, [slideshowItems])

  // Compute current item type for duration
  const currentItemType = slideshowItems[currentIndex]?.type || 'photo'
  const itemsCount = slideshowItems.length

  useEffect(() => {
    if (itemsCount <= 1) return

    const duration = currentItemType === 'message'
      ? (session?.messages_duration || 8) * 1000
      : (session?.transition_duration || 5) * 1000

    const timeout = setTimeout(() => {
      setCurrentIndex((prev) => {
        const items = slideshowItemsRef.current
        if (items.length === 0) return 0
        return (prev + 1) % items.length
      })
    }, duration)

    return () => clearTimeout(timeout)
  }, [currentIndex, currentItemType, itemsCount, session?.transition_duration, session?.messages_duration])

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

  function getStorageUrl(storagePath: string | null) {
    if (!storagePath) return null
    const { data } = supabase.storage.from('photos').getPublicUrl(storagePath)
    return data.publicUrl
  }

  const transitionType = session?.transition_type || 'fade'
  const currentItem = slideshowItems[currentIndex]

  // Get customization values with defaults
  const bgType = session?.background_type || 'color'
  const bgColor = session?.background_color || '#1A1A1E'
  const bgImage = session?.background_image
  const bgOpacity = session?.background_opacity ?? 50
  const customLogo = session?.custom_logo
  const logoSize = session?.logo_size || 'medium'
  const logoPosition = session?.logo_position || 'bottom-left'
  const logoUrl = customLogo ? getStorageUrl(customLogo) : '/logo.png'
  const logoSizeValues = logoSizes[logoSize]

  // Render background
  const renderBackground = () => {
    if (bgType === 'image' && bgImage) {
      return (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${getStorageUrl(bgImage)})` }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0, 0, 0, ${bgOpacity / 100})` }}
          />
        </>
      )
    }
    return (
      <div
        className="absolute inset-0"
        style={{ backgroundColor: bgColor }}
      />
    )
  }

  // Render logo component
  const renderLogo = () => (
    <motion.img
      src={logoUrl || '/logo.png'}
      alt="Logo"
      width={logoSizeValues.width}
      height={logoSizeValues.height}
      className="drop-shadow-lg object-contain"
      style={{ maxWidth: logoSizeValues.width, maxHeight: logoSizeValues.height }}
    />
  )

  // QR Code component with pulse animation
  const renderQRCode = (size: number = 80) => (
    <div className="flex items-center gap-3">
      <motion.div
        animate={{
          scale: [1, 1.02, 1],
          boxShadow: [
            '0 0 0 0 rgba(212, 175, 55, 0.4)',
            '0 0 0 8px rgba(212, 175, 55, 0)',
            '0 0 0 0 rgba(212, 175, 55, 0)',
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="bg-white p-2 rounded-lg"
      >
        <QRCode
          value={getInviteUrl(code)}
          size={size}
        />
      </motion.div>
      <div className="text-right">
        <p className="text-xl font-mono font-bold text-[#D4AF37]">#{code}</p>
        <p className="text-sm text-white/70">Partagez vos photos</p>
      </div>
    </div>
  )

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

  // Show Mystery Photo Game if active
  // Check for mystery_photos (new multi-photo system) OR mystery_photo_url (legacy)
  if (session.mystery_photo_active && (session.mystery_photos || session.mystery_photo_url)) {
    return (
      <MysteryPhotoGame
        session={session}
        onExit={() => {
          // Re-fetch session to get updated state
          fetchSession()
        }}
      />
    )
  }

  // Show Lineup Game (Le Bon Ordre) if active
  // Use broadcast state when available for real-time sync, fallback to session data
  const isLineupActive = lineupState?.gameActive ?? session.lineup_active
  if (isLineupActive) {
    return (
      <LineupGame
        currentNumber={lineupState?.currentNumber ?? session.lineup_current_number ?? ''}
        timeLeft={lineupState?.timeLeft ?? session.lineup_time_left ?? 30}
        clockDuration={lineupState?.clockDuration ?? session.lineup_clock_duration ?? 30}
        isRunning={lineupState?.isRunning ?? session.lineup_is_running ?? false}
        isPaused={lineupState?.isPaused ?? session.lineup_is_paused ?? false}
        isGameOver={lineupState?.isGameOver ?? session.lineup_is_game_over ?? false}
        currentPoints={lineupState?.currentPoints ?? session.lineup_current_points ?? 10}
        team1Name={lineupState?.team1Name ?? session.lineup_team1_name ?? 'Équipe 1'}
        team2Name={lineupState?.team2Name ?? session.lineup_team2_name ?? 'Équipe 2'}
        team1Score={lineupState?.team1Score ?? session.lineup_team1_score ?? 0}
        team2Score={lineupState?.team2Score ?? session.lineup_team2_score ?? 0}
        showWinner={lineupState?.showWinner ?? session.lineup_show_winner ?? false}
      />
    )
  }

  return (
    <div className="min-h-screen overflow-hidden relative cursor-none" style={{ cursor: showUI ? 'auto' : 'none' }}>
      {/* Background */}
      {renderBackground()}

      {/* New photo notification */}
      <NewPhotoNotification show={showNewPhotoNotification} />

      {/* Fullscreen button - always visible on hover */}
      <motion.button
        onClick={toggleFullscreen}
        initial={false}
        animate={{ opacity: showUI ? 1 : 0 }}
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.3 }}
        className="absolute top-4 right-4 z-50 p-3 bg-black/50 hover:bg-black/70 border border-[#D4AF37]/30 rounded-full transition-colors backdrop-blur-sm"
        title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
      >
        {isFullscreen ? (
          <Minimize className="h-6 w-6 text-[#D4AF37]" />
        ) : (
          <Maximize className="h-6 w-6 text-[#D4AF37]" />
        )}
      </motion.button>

      {/* Logo at top-center position if selected */}
      {logoPosition === 'top-center' && (
        <motion.div
          initial={false}
          animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : -20 }}
          transition={{ duration: 0.3 }}
          className="absolute top-6 left-1/2 -translate-x-1/2 z-40"
        >
          {renderLogo()}
        </motion.div>
      )}

      {slideshowItems.length === 0 ? (
        /* Waiting screen with rocket animation */
        <>
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
            >
              <RocketAnimation />
            </motion.div>
          </AnimatePresence>

          <div className="h-screen flex flex-col items-center justify-center text-white relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="mb-6">
                <img
                  src={logoUrl || '/logo.png'}
                  alt="Logo"
                  className="mx-auto drop-shadow-lg"
                  style={{
                    width: logoSize === 'small' ? 80 : logoSize === 'medium' ? 120 : 160,
                    height: 'auto',
                    objectFit: 'contain'
                  }}
                />
              </div>

              <h1 className="text-4xl font-bold mb-4 text-white drop-shadow-lg">{session.name}</h1>

              <p className="text-xl text-white/80 mb-12">
                En attente des premières photos ou messages...
              </p>

              {session.show_qr_on_screen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="fixed bottom-8 right-8"
                >
                  {renderQRCode(120)}
                </motion.div>
              )}
            </motion.div>
          </div>
        </>
      ) : (
        <>
          {/* Photo/Message slideshow */}
          <AnimatePresence mode="wait">
            {currentItem?.type === 'message' ? (
              <MessageDisplay key={`msg-${currentIndex}-${currentItem.data.id}`} message={currentItem.data} />
            ) : currentItem?.type === 'photo' ? (
              <motion.div
                key={`photo-${currentItem.data.id}`}
                variants={transitions[transitionType]}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-0 flex items-center justify-center p-6 z-10"
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="relative"
                >
                  <img
                    src={getStorageUrl(currentItem.data.storage_path) || ''}
                    alt="Photo"
                    className="max-w-full max-h-[90vh] object-contain"
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(212, 175, 55, 0.2)',
                    }}
                  />
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Bottom overlay bar */}
          <motion.div
            initial={false}
            animate={{
              opacity: showUI ? 1 : 0,
              y: showUI ? 0 : 20
            }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-0 left-0 right-0 z-20"
          >
            <div
              className="p-6 backdrop-blur-md"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                borderTop: '1px solid rgba(212, 175, 55, 0.1)'
              }}
            >
              <div className="flex items-end justify-between">
                {/* Left side: Logo + event info */}
                <div className="flex items-center gap-4">
                  {logoPosition === 'bottom-left' && renderLogo()}
                  <div>
                    <h1 className="text-2xl font-bold text-white drop-shadow-lg">{session.name}</h1>
                    <div className="flex items-center gap-4 mt-1">
                      <AnimatedCounter
                        value={currentIndex + 1}
                        label={`/ ${slideshowItems.length}`}
                      />
                      {currentItem?.type === 'photo' && currentItem.data.uploader_name && (
                        <span className="text-white/60 text-sm">
                          par {currentItem.data.uploader_name}
                        </span>
                      )}
                      {currentItem?.type === 'message' && (
                        <span className="text-[#D4AF37]/80 text-sm flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          Message
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: QR Code */}
                {session.show_qr_on_screen && renderQRCode(70)}
              </div>
            </div>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            initial={false}
            animate={{ opacity: showUI ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-0 left-0 right-0 h-1 z-30"
          >
            <motion.div
              key={currentIndex}
              className="h-full bg-[#D4AF37]"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{
                duration: getCurrentDuration() / 1000,
                ease: 'linear'
              }}
            />
          </motion.div>
        </>
      )}
    </div>
  )
}
