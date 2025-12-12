'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { Session, MysteryPhotoGrid, MysteryPhotoSpeed } from '@/types/database'
import { createClient } from '@/lib/supabase'

interface MysteryPhotoGameProps {
  session: Session
  onExit: () => void
}

interface MysteryPhotoData {
  url: string
}

const SPEED_MAP: Record<MysteryPhotoSpeed, number> = {
  slow: 3000,
  medium: 2000,
  fast: 1000,
}

export default function MysteryPhotoGame({ session, onExit }: MysteryPhotoGameProps) {
  const [revealedTiles, setRevealedTiles] = useState<number[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentRound, setCurrentRound] = useState(1)
  const [totalRounds, setTotalRounds] = useState(1)
  const [photos, setPhotos] = useState<MysteryPhotoData[]>([])
  const [showRoundTransition, setShowRoundTransition] = useState(false)
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
    // Fallback to legacy single photo
    if (session.mystery_photo_url) {
      const { data } = supabase.storage.from('photos').getPublicUrl(session.mystery_photo_url)
      return data.publicUrl
    }
    return null
  }, [photos, currentRound, session.mystery_photo_url, supabase])

  // Initialize state from session
  useEffect(() => {
    // Load photos from JSON
    if (session.mystery_photos) {
      try {
        const parsedPhotos = JSON.parse(session.mystery_photos)
        setPhotos(parsedPhotos)
        setTotalRounds(parsedPhotos.length || 1)
      } catch {
        console.error('Failed to parse mystery_photos')
      }
    }

    // Load game state
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

          // Check if game was stopped
          if (!updated.mystery_photo_active) {
            onExit()
            return
          }

          // Update state from session
          const newRound = updated.mystery_current_round || 1
          const prevRound = currentRound

          // Detect round change for transition animation
          if (newRound !== prevRound && newRound > prevRound) {
            setShowRoundTransition(true)
            setTimeout(() => {
              setShowRoundTransition(false)
              setCurrentRound(newRound)
              setRevealedTiles(updated.mystery_revealed_tiles || [])
            }, 2000)
          } else {
            setCurrentRound(newRound)
            setRevealedTiles(updated.mystery_revealed_tiles || [])
          }

          setTotalRounds(updated.mystery_total_rounds || 1)
          setIsPlaying(updated.mystery_is_playing || false)

          // Update photos if changed
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

  // Auto-reveal logic (controlled by admin, just sync state here)
  useEffect(() => {
    if (!isPlaying) return
    if (revealedTiles.length >= totalTiles) return

    const interval = setInterval(async () => {
      // Generate next tile to reveal
      const allTiles = Array.from({ length: totalTiles }, (_, i) => i)
      const hiddenTiles = allTiles.filter(t => !revealedTiles.includes(t))

      if (hiddenTiles.length === 0) return

      const randomIndex = Math.floor(Math.random() * hiddenTiles.length)
      const tileToReveal = hiddenTiles[randomIndex]
      const newRevealedTiles = [...revealedTiles, tileToReveal]

      // Update database (admin will see this too)
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
    <div className="fixed inset-0 bg-[#1A1A1E] flex flex-col">
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

      {/* Header - discret */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#242428]/80 backdrop-blur-sm border-b border-[rgba(255,255,255,0.1)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
            <Search className="h-5 w-5 text-[#D4AF37]" />
          </div>
          <h1 className="text-xl font-bold text-white">Photo Mystère</h1>
          {totalRounds > 1 && (
            <span className="ml-4 px-3 py-1 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-sm font-semibold">
              Manche {currentRound}/{totalRounds}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#D4AF37] font-bold text-lg">
            {revealedTiles.length}/{totalTiles} cases révélées
          </span>
          {isPlaying && (
            <span className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 rounded-full">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">En cours</span>
            </span>
          )}
        </div>
      </div>

      {/* Game area - fullscreen */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="relative w-full h-full max-w-6xl max-h-[85vh] aspect-video">
          {/* Photo underneath */}
          <img
            src={currentPhotoUrl}
            alt="Photo Mystère"
            className="absolute inset-0 w-full h-full object-cover rounded-2xl shadow-2xl"
          />

          {/* Tile grid overlay */}
          <div
            className="absolute inset-0 grid rounded-2xl overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
            }}
          >
            <AnimatePresence>
              {tiles.map((tile) => (
                <motion.div
                  key={tile.id}
                  initial={false}
                  animate={
                    tile.revealed
                      ? {
                          opacity: 0,
                          scale: 0.8,
                          rotate: Math.random() * 10 - 5,
                        }
                      : {
                          opacity: 1,
                          scale: 1,
                          rotate: 0,
                        }
                  }
                  transition={{
                    duration: 0.5,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className={`
                    relative overflow-hidden
                    ${tile.revealed ? 'pointer-events-none' : 'bg-gradient-to-br from-[#D4AF37] to-[#B8960C] border-[0.5px] border-[#B8960C]/30'}
                  `}
                >
                  {/* Shine effect */}
                  {!tile.revealed && (
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Progress bar at bottom */}
      <div className="h-2 bg-[#242428]">
        <motion.div
          className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]"
          initial={{ width: '0%' }}
          animate={{ width: `${(revealedTiles.length / totalTiles) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  )
}
