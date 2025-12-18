'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Maximize, Minimize, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import QRCode from 'react-qr-code'
import { Session, MysteryPhotoGrid, MysteryPhotoSpeed } from '@/types/database'
import { createClient } from '@/lib/supabase'
import { getInviteUrl } from '@/lib/utils'

interface MysteryPhotoGameProps {
  session: Session
  onExit: () => void
}

interface MysteryPhotoData {
  url: string
  audioUrl?: string
}

const SPEED_MAP: Record<MysteryPhotoSpeed, number> = {
  slow: 3000,
  medium: 2000,
  fast: 1000,
}

// Helper function for delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Generate zigzag path for Pac-Man
const generatePacmanPath = (rows: number, cols: number) => {
  const path: { row: number; col: number }[] = []
  for (let row = 0; row < rows; row++) {
    if (row % 2 === 0) {
      for (let col = 0; col < cols; col++) {
        path.push({ row, col })
      }
    } else {
      for (let col = cols - 1; col >= 0; col--) {
        path.push({ row, col })
      }
    }
  }
  return path
}

export default function MysteryPhotoGame({ session, onExit }: MysteryPhotoGameProps) {
  const [revealedTiles, setRevealedTiles] = useState<number[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentRound, setCurrentRound] = useState(1)
  const [totalRounds, setTotalRounds] = useState(1)
  const [photos, setPhotos] = useState<MysteryPhotoData[]>([])
  const [showRoundTransition, setShowRoundTransition] = useState(false)

  // Winner animation states
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false)
  const [animationPhase, setAnimationPhase] = useState(0)
  const [pacmanPosition, setPacmanPosition] = useState({ row: 0, col: 0 })
  const [pacmanDirection, setPacmanDirection] = useState<'right' | 'left' | 'up' | 'down'>('right')
  const [eatenTiles, setEatenTiles] = useState<number[]>([])

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const gameAreaRef = useRef<HTMLDivElement>(null)

  // QR Code visibility (synced with session)
  const [showQR, setShowQR] = useState(session.show_qr_on_screen ?? false)

  // Audio states - Per-photo audio (plays when photo is fully revealed)
  const photoAudioRef = useRef<HTMLAudioElement>(null)
  const [audioVolume, setAudioVolume] = useState(0.8)
  const [isPhotoAudioPlaying, setIsPhotoAudioPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [hasPlayedPhotoAudio, setHasPlayedPhotoAudio] = useState(false)

  // Audio states - Global reveal audio (plays during tile removal)
  const revealAudioRef = useRef<HTMLAudioElement>(null)
  const [revealAudioUrl, setRevealAudioUrl] = useState<string | null>(null)
  const [isRevealAudioPlaying, setIsRevealAudioPlaying] = useState(false)
  const [hasStartedRevealAudio, setHasStartedRevealAudio] = useState(false) // Track if audio started this round

  const supabase = createClient()

  // Parse grid dimensions
  const [cols, rows] = (session.mystery_photo_grid || '12x8').split('x').map(Number)
  const totalTiles = cols * rows
  const speed = SPEED_MAP[session.mystery_photo_speed || 'medium']

  // Get current photo URL
  const currentPhotoUrl = useMemo(() => {
    if (photos.length > 0 && currentRound <= photos.length) {
      const photoData = photos[currentRound - 1]
      if (photoData?.url) {
        const { data } = supabase.storage.from('photos').getPublicUrl(photoData.url)
        return data.publicUrl
      }
    }
    if (session.mystery_photo_url) {
      const { data } = supabase.storage.from('photos').getPublicUrl(session.mystery_photo_url)
      return data.publicUrl
    }
    return null
  }, [photos, currentRound, session.mystery_photo_url, supabase])

  // Get current audio URL
  const currentAudioUrl = useMemo(() => {
    if (photos.length > 0 && currentRound <= photos.length) {
      const photoData = photos[currentRound - 1]
      if (photoData?.audioUrl) {
        const { data } = supabase.storage.from('photos').getPublicUrl(photoData.audioUrl)
        return data.publicUrl
      }
    }
    return null
  }, [photos, currentRound, supabase])

  // Check if current photo has audio (for revelation)
  const hasPhotoAudio = useMemo(() => {
    return !!currentAudioUrl
  }, [currentAudioUrl])

  // Check if global reveal audio is configured
  const hasRevealAudio = useMemo(() => {
    return !!revealAudioUrl
  }, [revealAudioUrl])

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Listen for fullscreen change (ESC key exits fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])


  // Load global reveal audio URL from session
  useEffect(() => {
    if (session.mystery_reveal_audio) {
      const { data } = supabase.storage.from('photos').getPublicUrl(session.mystery_reveal_audio)
      setRevealAudioUrl(data.publicUrl)
    }
  }, [session.mystery_reveal_audio, supabase])

  // GLOBAL REVEAL AUDIO: Play/pause when game starts/pauses
  useEffect(() => {
    if (isPlaying && revealAudioUrl && !isMuted && revealAudioRef.current) {
      // Only reset to beginning on first start of the round
      if (!hasStartedRevealAudio) {
        revealAudioRef.current.currentTime = 0
        setHasStartedRevealAudio(true)
      }
      // Resume or start playing
      revealAudioRef.current.loop = true
      revealAudioRef.current.play().catch(() => {})
      setIsRevealAudioPlaying(true)
    } else if (!isPlaying && revealAudioRef.current && isRevealAudioPlaying) {
      // Pause audio when game is paused (keep current position)
      revealAudioRef.current.pause()
      setIsRevealAudioPlaying(false)
    }
  }, [isPlaying, revealAudioUrl, isMuted, hasStartedRevealAudio])

  // Stop REVEAL audio when all tiles are revealed
  useEffect(() => {
    if (revealedTiles.length === totalTiles && totalTiles > 0) {
      // Stop reveal audio with fade out
      if (revealAudioRef.current && isRevealAudioPlaying) {
        const fadeOutDuration = 500 // 0.5 second fade out
        const fadeInterval = 50
        const steps = fadeOutDuration / fadeInterval
        const volumeStep = revealAudioRef.current.volume / steps

        const fadeOut = setInterval(() => {
          if (revealAudioRef.current && revealAudioRef.current.volume > volumeStep) {
            revealAudioRef.current.volume -= volumeStep
          } else {
            clearInterval(fadeOut)
            if (revealAudioRef.current) {
              revealAudioRef.current.pause()
              revealAudioRef.current.volume = isMuted ? 0 : audioVolume
              revealAudioRef.current.loop = false
            }
            setIsRevealAudioPlaying(false)
          }
        }, fadeInterval)
      }
    }
  }, [revealedTiles.length, totalTiles, isRevealAudioPlaying, isMuted, audioVolume])

  // Play PER-PHOTO audio when all tiles are revealed
  useEffect(() => {
    if (revealedTiles.length === totalTiles && totalTiles > 0 && currentAudioUrl && !hasPlayedPhotoAudio && !isMuted) {
      // Wait a bit for reveal audio to fade, then play photo audio
      const timer = setTimeout(() => {
        if (photoAudioRef.current) {
          photoAudioRef.current.currentTime = 0
          photoAudioRef.current.loop = false
          photoAudioRef.current.play().catch((err) => {
            console.log('Photo audio play failed:', err)
          })
          setIsPhotoAudioPlaying(true)
          setHasPlayedPhotoAudio(true)
        }
      }, 700)

      return () => clearTimeout(timer)
    }
  }, [revealedTiles.length, totalTiles, currentAudioUrl, hasPlayedPhotoAudio, isMuted])

  // Reset audio states when round changes
  useEffect(() => {
    setHasPlayedPhotoAudio(false)
    setIsPhotoAudioPlaying(false)
    setIsRevealAudioPlaying(false)
    setHasStartedRevealAudio(false) // Reset so next round starts from beginning

    // Stop both audio elements
    if (photoAudioRef.current) {
      photoAudioRef.current.pause()
      photoAudioRef.current.currentTime = 0
      photoAudioRef.current.volume = isMuted ? 0 : audioVolume
    }
    if (revealAudioRef.current) {
      revealAudioRef.current.pause()
      revealAudioRef.current.currentTime = 0
      revealAudioRef.current.loop = false
      revealAudioRef.current.volume = isMuted ? 0 : audioVolume
    }
  }, [currentRound, audioVolume, isMuted])

  // Update audio volume for both audio elements
  useEffect(() => {
    if (photoAudioRef.current) {
      photoAudioRef.current.volume = isMuted ? 0 : audioVolume
    }
    if (revealAudioRef.current) {
      revealAudioRef.current.volume = isMuted ? 0 : audioVolume
    }
  }, [audioVolume, isMuted])

  // Audio control functions (for per-photo audio)
  const playPhotoAudio = () => {
    if (photoAudioRef.current && currentAudioUrl) {
      photoAudioRef.current.play()
      setIsPhotoAudioPlaying(true)
    }
  }

  const replayPhotoAudio = () => {
    if (photoAudioRef.current && currentAudioUrl) {
      photoAudioRef.current.currentTime = 0
      photoAudioRef.current.play()
      setIsPhotoAudioPlaying(true)
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  // Initialize state from session
  useEffect(() => {
    if (session.mystery_photos) {
      try {
        const parsedPhotos = JSON.parse(session.mystery_photos)
        setPhotos(parsedPhotos)
        setTotalRounds(parsedPhotos.length || 1)
      } catch {
        console.error('Failed to parse mystery_photos')
      }
    }
    setCurrentRound(session.mystery_current_round || 1)
    setTotalRounds(session.mystery_total_rounds || 1)
    setIsPlaying(session.mystery_is_playing || false)
    setRevealedTiles(session.mystery_revealed_tiles || [])
  }, [])

  // Subscribe to session changes for real-time sync
  useEffect(() => {
    const channel = supabase
      .channel(`mystery-game-display-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const updated = payload.new as Session
          if (!updated.mystery_photo_active) {
            onExit()
            return
          }
          const newRound = updated.mystery_current_round || 1
          const prevRound = currentRound
          if (newRound !== prevRound && newRound > prevRound) {
            setShowRoundTransition(true)
            setTimeout(() => {
              // IMPORTANT: D'abord remettre toutes les cases (vider revealedTiles)
              // AVANT de changer la photo (currentRound)
              setRevealedTiles([])

              // Petit délai pour que les cases soient bien en place
              setTimeout(() => {
                setCurrentRound(newRound)
                setShowRoundTransition(false)
              }, 100)
            }, 2000)
          } else {
            setCurrentRound(newRound)
            setRevealedTiles(updated.mystery_revealed_tiles || [])
          }
          setTotalRounds(updated.mystery_total_rounds || 1)
          setIsPlaying(updated.mystery_is_playing || false)
          // Update QR code visibility
          setShowQR(updated.show_qr_on_screen ?? false)
          if (updated.mystery_photos) {
            try {
              const parsedPhotos = JSON.parse(updated.mystery_photos)
              setPhotos(parsedPhotos)
            } catch {
              console.error('Failed to parse updated mystery_photos')
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session.id, supabase, onExit, currentRound])

  // Listen for winner animation broadcast
  useEffect(() => {
    const winnerChannel = supabase
      .channel(`mystery-winner-${session.code}`)
      .on('broadcast', { event: 'mystery_winner' }, () => {
        console.log('[MysteryPhoto] Winner animation triggered!')
        startWinnerSequence()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(winnerChannel)
    }
  }, [session.code, supabase, rows, cols])

  // Winner animation sequence
  const startWinnerSequence = async () => {
    setShowWinnerAnimation(true)
    setEatenTiles([])
    setPacmanPosition({ row: 0, col: 0 })
    setPacmanDirection('right')

    // Phase 1: Reset all tiles (show them again)
    setAnimationPhase(1)
    await sleep(800)

    // Phase 2: Pac-Man eats tiles
    setAnimationPhase(2)
    await pacmanEatAnimation()

    // Phase 3: Victory explosion
    setAnimationPhase(3)
    await sleep(6000)

    // End
    setShowWinnerAnimation(false)
    setAnimationPhase(0)
    setEatenTiles([])
  }

  // Pac-Man eating animation
  const pacmanEatAnimation = async () => {
    const path = generatePacmanPath(rows, cols)

    for (let i = 0; i < path.length; i++) {
      const { row, col } = path[i]
      const prevPos = i > 0 ? path[i - 1] : path[0]

      // Determine direction
      if (col > prevPos.col) setPacmanDirection('right')
      else if (col < prevPos.col) setPacmanDirection('left')
      else if (row > prevPos.row) setPacmanDirection('down')
      else if (row < prevPos.row) setPacmanDirection('up')

      setPacmanPosition({ row, col })
      setEatenTiles(prev => [...prev, row * cols + col])
      await sleep(35)
    }
  }

  // Auto-reveal logic
  useEffect(() => {
    if (!isPlaying) return
    if (revealedTiles.length >= totalTiles) return

    const interval = setInterval(async () => {
      const allTiles = Array.from({ length: totalTiles }, (_, i) => i)
      const hiddenTiles = allTiles.filter(t => !revealedTiles.includes(t))
      if (hiddenTiles.length === 0) return
      const randomIndex = Math.floor(Math.random() * hiddenTiles.length)
      const tileToReveal = hiddenTiles[randomIndex]
      const newRevealedTiles = [...revealedTiles, tileToReveal]
      await supabase
        .from('sessions')
        .update({ mystery_revealed_tiles: newRevealedTiles })
        .eq('id', session.id)
      setRevealedTiles(newRevealedTiles)
    }, speed)

    return () => clearInterval(interval)
  }, [isPlaying, revealedTiles, totalTiles, speed, session.id, supabase])

  // Generate tile elements
  const tiles = useMemo(() => {
    return Array.from({ length: totalTiles }, (_, i) => ({
      id: i,
      revealed: revealedTiles.includes(i),
    }))
  }, [totalTiles, revealedTiles])

  if (!currentPhotoUrl) {
    return (
      <div className="fixed inset-0 bg-[#1A1A1E] flex items-center justify-center">
        <p className="text-white text-xl">Aucune photo configurée</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="fixed inset-0 bg-[#1A1A1E] flex flex-col">
      {/* Round transition overlay */}
      <AnimatePresence>
        {showRoundTransition && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#1A1A1E] flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-center"
            >
              <span className="text-7xl mb-6 block">🎉</span>
              <h2 className="text-5xl font-bold text-white mb-4">Bien joué !</h2>
              <p className="text-[#D4AF37] text-3xl">
                Préparez-vous pour la manche {currentRound + 1}...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WINNER ANIMATION OVERLAY */}
      <AnimatePresence>
        {showWinnerAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] overflow-hidden"
          >
            {/* Black background */}
            <div className="absolute inset-0 bg-black" />

            {/* Phase 1 & 2: Photo with tiles + Pac-Man eating them */}
            {(animationPhase === 1 || animationPhase === 2) && (
              <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
                <div
                  className="relative"
                  style={{
                    width: '64vw',
                    maxWidth: '900px',
                    paddingBottom: `${(rows / cols) * 64}vw`,
                    maxHeight: `${(rows / cols) * 900}px`,
                  }}
                >
                  {/* Photo underneath */}
                  <img
                    src={currentPhotoUrl || ''}
                    alt="Photo révélée"
                    className="absolute top-0 left-0 w-full h-full object-cover rounded-xl"
                  />

                  {/* Tile grid overlay */}
                  <div
                    className="absolute top-0 left-0 right-0 bottom-0 rounded-xl overflow-hidden"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: totalTiles }, (_, index) => {
                      const isEaten = eatenTiles.includes(index)
                      return (
                        <motion.div
                          key={index}
                          initial={{ scale: 1, opacity: 1 }}
                          animate={{
                            scale: isEaten ? 0 : 1,
                            opacity: isEaten ? 0 : 1,
                          }}
                          transition={{ duration: 0.1 }}
                          className="bg-[#D4AF37]"
                          style={{
                            boxShadow: isEaten ? 'none' : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                          }}
                        />
                      )
                    })}
                  </div>

                  {/* PAC-MAN */}
                  {animationPhase === 2 && (
                    <motion.div
                      className="absolute z-10"
                      style={{
                        width: `${100 / cols}%`,
                        height: `${100 / rows}%`,
                        left: `${(pacmanPosition.col / cols) * 100}%`,
                        top: `${(pacmanPosition.row / rows) * 100}%`,
                        transform: `rotate(${
                          pacmanDirection === 'right' ? 0 :
                          pacmanDirection === 'down' ? 90 :
                          pacmanDirection === 'left' ? 180 :
                          270
                        }deg)`,
                      }}
                      transition={{ duration: 0.03 }}
                    >
                      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
                        <defs>
                          <radialGradient id="pacmanGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#FFFF00" />
                            <stop offset="100%" stopColor="#FFD700" />
                          </radialGradient>
                        </defs>
                        {/* Body */}
                        <circle cx="50" cy="50" r="45" fill="url(#pacmanGlow)" />
                        {/* Animated mouth */}
                        <motion.path
                          d="M50,50 L95,25 A45,45 0 0,1 95,75 Z"
                          fill="#000"
                          animate={{
                            d: [
                              "M50,50 L95,15 A45,45 0 0,1 95,85 Z",
                              "M50,50 L95,45 A45,45 0 0,1 95,55 Z",
                              "M50,50 L95,15 A45,45 0 0,1 95,85 Z",
                            ]
                          }}
                          transition={{ duration: 0.15, repeat: Infinity }}
                        />
                        {/* Eye */}
                        <circle cx="55" cy="25" r="8" fill="#000" />
                      </svg>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Phase 3: VICTORY EXPLOSION */}
            {animationPhase === 3 && (
              <>
                {/* Animated gradient background */}
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    background: [
                      'linear-gradient(45deg, #1a0a2e, #0a1a3e, #2e0a1a)',
                      'linear-gradient(90deg, #0a1a3e, #2e0a1a, #1a0a2e)',
                      'linear-gradient(135deg, #2e0a1a, #1a0a2e, #0a1a3e)',
                      'linear-gradient(180deg, #1a0a2e, #0a1a3e, #2e0a1a)',
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                />

                {/* Neon borders */}
                <div className="absolute inset-0 pointer-events-none">
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-2 bg-[#D4AF37]"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    style={{ boxShadow: '0 0 30px #D4AF37, 0 0 60px #D4AF37, 0 0 90px #D4AF37' }}
                  />
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-2 bg-[#D4AF37]"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    style={{ boxShadow: '0 0 30px #D4AF37, 0 0 60px #D4AF37, 0 0 90px #D4AF37' }}
                  />
                  <motion.div
                    className="absolute top-0 bottom-0 left-0 w-2 bg-[#D4AF37]"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: 0.25 }}
                    style={{ boxShadow: '0 0 30px #D4AF37, 0 0 60px #D4AF37, 0 0 90px #D4AF37' }}
                  />
                  <motion.div
                    className="absolute top-0 bottom-0 right-0 w-2 bg-[#D4AF37]"
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: 0.25 }}
                    style={{ boxShadow: '0 0 30px #D4AF37, 0 0 60px #D4AF37, 0 0 90px #D4AF37' }}
                  />
                </div>

                {/* Fireworks */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={`firework-${i}`}
                      className="absolute"
                      style={{
                        left: `${10 + (i * 4) % 80}%`,
                        top: `${10 + (i * 7) % 60}%`,
                      }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: [0, 1, 1.5, 0],
                        opacity: [0, 1, 1, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.3,
                        repeatDelay: 1,
                      }}
                    >
                      {[...Array(12)].map((_, j) => (
                        <motion.div
                          key={j}
                          className="absolute w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: ['#D4AF37', '#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#FFFF00', '#00FFFF', '#FF6600', '#9900FF', '#FF0099', '#00FF99', '#99FF00'][j],
                            transformOrigin: 'center',
                          }}
                          animate={{
                            x: [0, Math.cos(j * 30 * Math.PI / 180) * 80],
                            y: [0, Math.sin(j * 30 * Math.PI / 180) * 80],
                            scale: [1, 0],
                            opacity: [1, 0],
                          }}
                          transition={{
                            duration: 1,
                            delay: 0.2,
                            repeat: Infinity,
                            repeatDelay: 1.8,
                          }}
                        />
                      ))}
                    </motion.div>
                  ))}
                </div>

                {/* Confetti */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(100)].map((_, i) => (
                    <motion.div
                      key={`confetti-${i}`}
                      className="absolute"
                      style={{
                        left: `${Math.random() * 100}%`,
                        width: `${8 + Math.random() * 12}px`,
                        height: `${8 + Math.random() * 12}px`,
                        backgroundColor: ['#D4AF37', '#F4D03F', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'][i % 9],
                        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                      }}
                      initial={{ top: '-5%', rotate: 0 }}
                      animate={{
                        top: '105%',
                        rotate: 720,
                        x: [0, (Math.random() - 0.5) * 100, 0],
                      }}
                      transition={{
                        duration: 3 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 3,
                        ease: 'linear',
                      }}
                    />
                  ))}
                </div>

                {/* Stars */}
                <div className="absolute inset-0 pointer-events-none">
                  {[...Array(30)].map((_, i) => (
                    <motion.div
                      key={`star-${i}`}
                      className="absolute"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                      }}
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5],
                        rotate: [0, 180, 360],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: Math.random() * 2,
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF">
                        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                      </svg>
                    </motion.div>
                  ))}
                </div>

                {/* Spinning light rays */}
                <motion.div
                  className="absolute inset-0 pointer-events-none overflow-hidden opacity-20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                  style={{
                    backgroundColor: 'transparent', // Fallback for browsers without conic-gradient
                    background: 'conic-gradient(from 0deg, transparent, #D4AF37 10deg, transparent 20deg, transparent 30deg, #D4AF37 40deg, transparent 50deg, transparent 60deg, #D4AF37 70deg, transparent 80deg)',
                  }}
                />

                {/* Main winner text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    {/* Trophy */}
                    <motion.div
                      className="text-[120px] md:text-[180px] mb-4"
                      animate={{ y: [0, -20, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      🏆
                    </motion.div>

                    {/* WINNER text */}
                    <motion.h1
                      className="text-7xl md:text-9xl font-black"
                      animate={{
                        backgroundPosition: ['0% 50%', '200% 50%'],
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      style={{
                        backgroundImage: 'linear-gradient(90deg, #D4AF37, #F4D03F, #FFFFFF, #F4D03F, #D4AF37)',
                        backgroundSize: '200% auto',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 0 30px #D4AF37) drop-shadow(0 0 60px #D4AF37)',
                      }}
                    >
                      WINNER
                    </motion.h1>

                    {/* Congratulations */}
                    <motion.p
                      className="text-3xl md:text-5xl text-white mt-6"
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{ textShadow: '0 0 20px rgba(255,255,255,0.8)' }}
                    >
                      🎉 FÉLICITATIONS ! 🎉
                    </motion.p>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#242428]/80 backdrop-blur-sm border-b border-[rgba(255,255,255,0.1)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
            <Search className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <h1 className="text-lg font-bold text-white">Photo Mystère</h1>
          {totalRounds > 1 && (
            <span className="ml-2 px-2 py-0.5 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-xs font-semibold">
              Manche {currentRound}/{totalRounds}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#D4AF37] font-bold text-sm">
            {revealedTiles.length}/{totalTiles} cases
          </span>
          {isPlaying && (
            <span className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 rounded-full">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">En cours</span>
            </span>
          )}

          {/* Audio controls - show if any audio is available */}
          {(hasPhotoAudio || hasRevealAudio) && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#D4AF37]/10 rounded-lg border border-[#D4AF37]/30">
              {/* Audio indicator */}
              <Volume2 className={`h-4 w-4 ${(isPhotoAudioPlaying || isRevealAudioPlaying) ? 'text-[#D4AF37] animate-pulse' : 'text-[#D4AF37]/70'}`} />

              {/* Volume slider */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : audioVolume}
                onChange={(e) => {
                  setAudioVolume(parseFloat(e.target.value))
                  if (parseFloat(e.target.value) > 0) setIsMuted(false)
                }}
                className="w-16 h-1 bg-[#3E3E43] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                title="Volume"
              />

              {/* Mute button */}
              <button
                onClick={toggleMute}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title={isMuted ? "Activer le son" : "Couper le son"}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4 text-white/50" />
                ) : (
                  <Volume2 className="h-4 w-4 text-white/70" />
                )}
              </button>

              {/* Replay photo audio button - only show if photo has audio */}
              {hasPhotoAudio && (
                <button
                  onClick={replayPhotoAudio}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Rejouer l'audio de la photo"
                >
                  <RotateCcw className="h-4 w-4 text-white/70 hover:text-[#D4AF37]" />
                </button>
              )}
            </div>
          )}

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors group"
            title={isFullscreen ? "Quitter plein écran (ESC)" : "Plein écran"}
          >
            {isFullscreen ? (
              <Minimize className="h-5 w-5 text-white/70 group-hover:text-white" />
            ) : (
              <Maximize className="h-5 w-5 text-white/70 group-hover:text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Game area - uses 85vh height with aspect ratio */}
      <div ref={gameAreaRef} className="flex-1 flex items-center justify-center overflow-hidden p-1">
        <div
          className="relative rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: '95vw',
            height: '85vh',
            maxWidth: `calc(85vh * ${cols / rows})`,
            maxHeight: `calc(95vw / ${cols / rows})`,
          }}
        >
          <img
            src={currentPhotoUrl}
            alt="Photo Mystère"
            className="absolute top-0 left-0 w-full h-full object-cover"
          />
          <div
            className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            <AnimatePresence>
              {tiles.map((tile) => (
                <motion.div
                  key={tile.id}
                  initial={false}
                  animate={
                    tile.revealed
                      ? { opacity: 0, scale: 0.8 }
                      : { opacity: 1, scale: 1 }
                  }
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    backgroundColor: tile.revealed ? 'transparent' : '#D4AF37',
                    background: tile.revealed ? 'transparent' : 'linear-gradient(135deg, #D4AF37 0%, #B8960C 100%)',
                    border: tile.revealed ? 'none' : '0.5px solid rgba(184, 150, 12, 0.3)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  className={tile.revealed ? 'pointer-events-none' : ''}
                >
                  {!tile.revealed && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%, transparent 100%)',
                      }}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[#242428]">
        <motion.div
          className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]"
          initial={{ width: '0%' }}
          animate={{ width: `${(revealedTiles.length / totalTiles) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* QR Code overlay */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-8 right-8 z-50"
          >
            <div className="flex items-center gap-3 bg-black/50 backdrop-blur-sm rounded-xl p-3">
              <motion.div
                animate={{
                  scale: [1, 1.02, 1],
                  boxShadow: [
                    '0 0 0 0 rgba(212, 175, 55, 0.4)',
                    '0 0 0 8px rgba(212, 175, 55, 0)',
                    '0 0 0 0 rgba(212, 175, 55, 0)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="bg-white p-2 rounded-lg"
              >
                <QRCode
                  value={getInviteUrl(session.code)}
                  size={80}
                />
              </motion.div>
              <div className="text-right">
                <p className="text-xl font-mono font-bold text-[#D4AF37]">#{session.code}</p>
                <p className="text-sm text-white/70">Partagez vos photos</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden audio elements */}
      {/* Per-photo audio (plays when photo is fully revealed) */}
      {currentAudioUrl && (
        <audio
          ref={photoAudioRef}
          src={currentAudioUrl}
          onEnded={() => setIsPhotoAudioPlaying(false)}
          onPlay={() => setIsPhotoAudioPlaying(true)}
          onPause={() => setIsPhotoAudioPlaying(false)}
        />
      )}
      {/* Global reveal audio (plays during tile removal) */}
      {revealAudioUrl && (
        <audio
          ref={revealAudioRef}
          src={revealAudioUrl}
          onEnded={() => setIsRevealAudioPlaying(false)}
          onPlay={() => setIsRevealAudioPlaying(true)}
          onPause={() => setIsRevealAudioPlaying(false)}
        />
      )}
    </div>
  )
}
