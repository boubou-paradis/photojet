'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Eye, RotateCcw, X, Search } from 'lucide-react'
import { Session, MysteryPhotoGrid, MysteryPhotoSpeed } from '@/types/database'
import { createClient } from '@/lib/supabase'

interface Tile {
  id: number
  revealed: boolean
}

interface GameState {
  tiles: Tile[]
  isPlaying: boolean
  revealedCount: number
}

interface MysteryPhotoGameProps {
  session: Session
  onExit: () => void
}

const SPEED_MAP: Record<MysteryPhotoSpeed, number> = {
  slow: 3000,
  medium: 2000,
  fast: 1000,
}

export default function MysteryPhotoGame({ session, onExit }: MysteryPhotoGameProps) {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [revealedCount, setRevealedCount] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  // Parse grid dimensions
  const [cols, rows] = (session.mystery_photo_grid || '8x6').split('x').map(Number)
  const totalTiles = cols * rows
  const speed = SPEED_MAP[session.mystery_photo_speed || 'medium']

  // Initialize tiles
  useEffect(() => {
    // Try to restore state from session
    if (session.mystery_photo_state) {
      try {
        const state: GameState = JSON.parse(session.mystery_photo_state)
        setTiles(state.tiles)
        setIsPlaying(state.isPlaying)
        setRevealedCount(state.revealedCount)
        return
      } catch {
        console.error('Failed to parse game state')
      }
    }

    // Initialize fresh tiles
    const initialTiles = Array.from({ length: totalTiles }, (_, i) => ({
      id: i,
      revealed: false,
    }))
    setTiles(initialTiles)
    setRevealedCount(0)
    setIsPlaying(false)
  }, [totalTiles, session.mystery_photo_state])

  // Save game state to database
  const saveGameState = useCallback(async (newTiles: Tile[], playing: boolean, count: number) => {
    const state: GameState = {
      tiles: newTiles,
      isPlaying: playing,
      revealedCount: count,
    }

    await supabase
      .from('sessions')
      .update({ mystery_photo_state: JSON.stringify(state) })
      .eq('id', session.id)
  }, [session.id, supabase])

  // Auto-reveal logic
  useEffect(() => {
    if (!isPlaying) return

    const hiddenTiles = tiles.filter(t => !t.revealed)
    if (hiddenTiles.length === 0) {
      setIsPlaying(false)
      saveGameState(tiles, false, revealedCount)
      return
    }

    const interval = setInterval(() => {
      setTiles(prev => {
        const hidden = prev.filter(t => !t.revealed)
        if (hidden.length === 0) {
          clearInterval(interval)
          return prev
        }

        // Choose random tile to reveal
        const randomIndex = Math.floor(Math.random() * hidden.length)
        const tileToReveal = hidden[randomIndex]

        const newTiles = prev.map(t =>
          t.id === tileToReveal.id ? { ...t, revealed: true } : t
        )

        setRevealedCount(c => {
          const newCount = c + 1
          saveGameState(newTiles, true, newCount)
          return newCount
        })

        return newTiles
      })
    }, speed)

    return () => clearInterval(interval)
  }, [isPlaying, tiles, speed, saveGameState, revealedCount])

  // Subscribe to session changes for remote control
  useEffect(() => {
    const channel = supabase
      .channel(`mystery-game-${session.id}`)
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

          // Check if game was stopped from admin
          if (!updated.mystery_photo_active) {
            onExit()
            return
          }

          // Update game state if changed externally
          if (updated.mystery_photo_state) {
            try {
              const state: GameState = JSON.parse(updated.mystery_photo_state)
              setTiles(state.tiles)
              setIsPlaying(state.isPlaying)
              setRevealedCount(state.revealedCount)
            } catch {
              console.error('Failed to parse updated game state')
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session.id, supabase, onExit])

  // Show/hide controls on mouse movement
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current)
    }
    hideControlsTimeout.current = setTimeout(() => {
      setShowControls(false)
    }, 5000)
  }, [])

  useEffect(() => {
    const handleMouseMove = () => resetControlsTimer()
    window.addEventListener('mousemove', handleMouseMove)
    resetControlsTimer()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current)
      }
    }
  }, [resetControlsTimer])

  // Control functions
  const togglePlayPause = async () => {
    const newPlaying = !isPlaying
    setIsPlaying(newPlaying)
    await saveGameState(tiles, newPlaying, revealedCount)
  }

  const revealAll = async () => {
    const newTiles = tiles.map(t => ({ ...t, revealed: true }))
    setTiles(newTiles)
    setIsPlaying(false)
    setRevealedCount(totalTiles)
    await saveGameState(newTiles, false, totalTiles)
  }

  const resetGame = async () => {
    const newTiles = Array.from({ length: totalTiles }, (_, i) => ({
      id: i,
      revealed: false,
    }))
    setTiles(newTiles)
    setIsPlaying(false)
    setRevealedCount(0)
    await saveGameState(newTiles, false, 0)
  }

  const exitGame = async () => {
    await supabase
      .from('sessions')
      .update({
        mystery_photo_active: false,
        mystery_photo_state: null,
      })
      .eq('id', session.id)
    onExit()
  }

  // Get photo URL
  function getPhotoUrl(storagePath: string | null) {
    if (!storagePath) return null
    const { data } = supabase.storage.from('photos').getPublicUrl(storagePath)
    return data.publicUrl
  }

  const photoUrl = getPhotoUrl(session.mystery_photo_url)

  if (!photoUrl) {
    return (
      <div className="fixed inset-0 bg-[#1A1A1E] flex items-center justify-center">
        <p className="text-white">Aucune photo configurée</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#1A1A1E] flex flex-col">
      {/* Header */}
      <motion.div
        initial={false}
        animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : -20 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between p-4 bg-[#242428] border-b border-[rgba(255,255,255,0.1)]"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
            <Search className="h-5 w-5 text-[#D4AF37]" />
          </div>
          <h1 className="text-xl font-bold text-white">Photo Mystère</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#D4AF37] font-bold text-lg">
            {revealedCount}/{totalTiles} cases révélées
          </span>
          {isPlaying && (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 bg-[#4CAF50] rounded-full animate-pulse" />
              <span className="text-[#4CAF50] font-medium">En cours</span>
            </span>
          )}
        </div>
      </motion.div>

      {/* Game area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="relative w-full max-w-5xl aspect-video">
          {/* Photo underneath */}
          <img
            src={photoUrl}
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
                    ${tile.revealed ? 'pointer-events-none' : 'bg-gradient-to-br from-[#D4AF37] to-[#B8960C] border border-[#B8960C]/50'}
                  `}
                >
                  {/* Shine effect */}
                  {!tile.revealed && (
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent" />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Controls */}
      <motion.div
        initial={false}
        animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
        transition={{ duration: 0.3 }}
        className="p-4 bg-[#242428] border-t border-[rgba(255,255,255,0.1)] flex justify-center gap-4"
      >
        <button
          onClick={togglePlayPause}
          className={`
            px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-3 transition-all duration-200
            ${isPlaying
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] hover:opacity-90 text-[#1A1A1E]'
            }
          `}
        >
          {isPlaying ? (
            <>
              <Pause className="h-5 w-5" />
              PAUSE
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              PLAY
            </>
          )}
        </button>

        <button
          onClick={revealAll}
          className="px-8 py-4 rounded-xl font-bold text-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-3 transition-all duration-200"
        >
          <Eye className="h-5 w-5" />
          Révéler tout
        </button>

        <button
          onClick={resetGame}
          className="px-8 py-4 rounded-xl font-bold text-lg bg-[#3E3E43] hover:bg-[#4E4E53] text-white flex items-center gap-3 transition-all duration-200"
        >
          <RotateCcw className="h-5 w-5" />
          Recommencer
        </button>

        <button
          onClick={exitGame}
          className="px-8 py-4 rounded-xl font-bold text-lg bg-red-500 hover:bg-red-600 text-white flex items-center gap-3 transition-all duration-200"
        >
          <X className="h-5 w-5" />
          Quitter le jeu
        </button>
      </motion.div>

      {/* Progress bar */}
      <div className="h-2 bg-[#2E2E33]">
        <motion.div
          className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]"
          initial={{ width: '0%' }}
          animate={{ width: `${(revealedCount / totalTiles) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  )
}
