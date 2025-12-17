'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Monitor,
  X,
  Plus,
  Trash2,
  RotateCcw,
  History,
  Palette,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session, WheelSegment, WheelResult } from '@/types/database'
import { toast } from 'sonner'

// Default segments
const DEFAULT_SEGMENTS: WheelSegment[] = [
  { id: '1', text: 'Chante une chanson', color: '#D4AF37' },
  { id: '2', text: 'Fais 10 pompes', color: '#C0392B' },
  { id: '3', text: 'Imite un animal', color: '#27AE60' },
  { id: '4', text: 'Offre un verre', color: '#2980B9' },
  { id: '5', text: 'Raconte une blague', color: '#8E44AD' },
  { id: '6', text: 'Danse 30 secondes', color: '#F39C12' },
]

// Color palette
const COLORS = [
  '#D4AF37', '#C0392B', '#27AE60', '#2980B9', '#8E44AD', '#F39C12',
  '#1ABC9C', '#E74C3C', '#3498DB', '#9B59B6', '#E67E22', '#16A085',
]

export default function WheelPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)

  // Configuration
  const [segments, setSegments] = useState<WheelSegment[]>(DEFAULT_SEGMENTS)
  const [newSegmentText, setNewSegmentText] = useState('')

  // Game state
  const [gameActive, setGameActive] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [history, setHistory] = useState<WheelResult[]>([])

  const router = useRouter()
  const supabase = createClient()
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    fetchSession()
  }, [])

  // Setup broadcast channel
  useEffect(() => {
    if (!session) return

    const channel = supabase.channel(`wheel-game-${session.code}`)
    broadcastChannelRef.current = channel
    channel.subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [session?.code, supabase])

  // Cleanup: désactiver la roue quand l'admin quitte la page
  useEffect(() => {
    if (!session?.id) return

    const cleanup = async () => {
      // Broadcast que le jeu n'est plus actif
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'wheel_state',
          payload: {
            gameActive: false,
            segments: [],
            isSpinning: false,
            result: null,
          },
        })
      }
      // Mettre à jour la base de données
      await supabase
        .from('sessions')
        .update({ wheel_active: false })
        .eq('id', session.id)
    }

    // Cleanup on unmount or page unload
    window.addEventListener('beforeunload', cleanup)

    return () => {
      window.removeEventListener('beforeunload', cleanup)
      cleanup()
    }
  }, [session?.id, supabase])

  // Calculer les segments utilisés à partir de l'historique
  const usedSegmentIds = useMemo(() => {
    return history.map(h => h.segmentId)
  }, [history])

  // Segments disponibles (non utilisés)
  const availableSegments = useMemo(() => {
    return segments.filter(s => !usedSegmentIds.includes(s.id))
  }, [segments, usedSegmentIds])

  // Jeu terminé quand tous les segments sont utilisés
  const isGameFinished = useMemo(() => {
    return gameActive && availableSegments.length === 0
  }, [gameActive, availableSegments.length])

  // Broadcast game state
  const broadcastGameState = useCallback((state: {
    gameActive: boolean
    segments: WheelSegment[]
    isSpinning: boolean
    result: string | null
    spinToIndex?: number
    usedSegmentIds?: string[]
    isGameFinished?: boolean
  }) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'wheel_state',
        payload: state,
      })
    }
  }, [])

  async function fetchSession() {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
      setSession(data)

      // Charger les segments depuis la DB (même si le jeu n'est pas actif)
      if (data.wheel_segments) {
        try {
          setSegments(JSON.parse(data.wheel_segments))
        } catch {
          setSegments(DEFAULT_SEGMENTS)
        }
      }

      // Initialize game state from session si le jeu est actif
      if (data.wheel_active) {
        setGameActive(true)
        setResult(data.wheel_result ?? null)
        if (data.wheel_history) {
          try {
            setHistory(JSON.parse(data.wheel_history))
          } catch {
            setHistory([])
          }
        }
      }
    } catch (err) {
      console.error('Error fetching session:', err)
      toast.error('Erreur lors du chargement de la session')
    } finally {
      setLoading(false)
    }
  }

  // Sauvegarder les segments dans la DB
  async function saveSegmentsToDatabase(updatedSegments: WheelSegment[]) {
    if (!session) return
    await supabase
      .from('sessions')
      .update({ wheel_segments: JSON.stringify(updatedSegments) })
      .eq('id', session.id)
  }

  function addSegment() {
    if (!newSegmentText.trim()) return
    if (segments.length >= 12) {
      toast.error('Maximum 12 segments')
      return
    }

    const newSegment: WheelSegment = {
      id: Date.now().toString(),
      text: newSegmentText.trim(),
      color: COLORS[segments.length % COLORS.length],
    }
    const updatedSegments = [...segments, newSegment]
    setSegments(updatedSegments)
    saveSegmentsToDatabase(updatedSegments)
    setNewSegmentText('')
  }

  function removeSegment(id: string) {
    if (segments.length <= 2) {
      toast.error('Minimum 2 segments')
      return
    }
    const updatedSegments = segments.filter(s => s.id !== id)
    setSegments(updatedSegments)
    saveSegmentsToDatabase(updatedSegments)
  }

  function updateSegmentColor(id: string, color: string) {
    const updatedSegments = segments.map(s => s.id === id ? { ...s, color } : s)
    setSegments(updatedSegments)
    saveSegmentsToDatabase(updatedSegments)
  }

  function updateSegmentText(id: string, text: string) {
    const updatedSegments = segments.map(s => s.id === id ? { ...s, text } : s)
    setSegments(updatedSegments)
    saveSegmentsToDatabase(updatedSegments)
  }

  async function launchGame() {
    if (!session || segments.length < 2) {
      toast.error('Ajoutez au moins 2 segments')
      return
    }

    setLaunching(true)
    try {
      // Désactiver tous les autres jeux avant d'activer la roue
      const { error } = await supabase
        .from('sessions')
        .update({
          // Désactiver les autres jeux
          mystery_photo_active: false,
          lineup_active: false,
          // Activer la roue
          wheel_active: true,
          wheel_segments: JSON.stringify(segments),
          wheel_is_spinning: false,
          wheel_result: null,
          wheel_history: JSON.stringify([]),
        })
        .eq('id', session.id)

      if (error) throw error

      setGameActive(true)
      setIsSpinning(false)
      setResult(null)
      setHistory([])

      broadcastGameState({
        gameActive: true,
        segments,
        isSpinning: false,
        result: null,
        usedSegmentIds: [],
        isGameFinished: false,
      })

      toast.success('Jeu configuré!')
      window.open(`/live/${session.code}`, '_blank')
    } catch (err) {
      console.error('Error launching game:', err)
      toast.error('Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  async function spinWheel() {
    if (!session || isSpinning || availableSegments.length === 0) return

    setIsSpinning(true)
    setResult(null)

    // Choose random segment from AVAILABLE segments only
    const randomIndex = Math.floor(Math.random() * availableSegments.length)
    const selectedSegment = availableSegments[randomIndex]

    // Update DB
    await supabase
      .from('sessions')
      .update({
        wheel_is_spinning: true,
        wheel_result: null,
      })
      .eq('id', session.id)

    // Broadcast spin start with target index (index in available segments)
    broadcastGameState({
      gameActive: true,
      segments,
      isSpinning: true,
      result: null,
      spinToIndex: randomIndex,
      usedSegmentIds,
      isGameFinished: false,
    })

    // Wait for spin animation (5 seconds)
    setTimeout(async () => {
      const newResult: WheelResult = {
        segmentId: selectedSegment.id,
        text: selectedSegment.text,
        timestamp: new Date().toISOString(),
      }
      const newHistory = [newResult, ...history].slice(0, 20) // Keep last 20
      const newUsedSegmentIds = [...usedSegmentIds, selectedSegment.id]
      const newAvailableCount = segments.length - newUsedSegmentIds.length
      const gameFinished = newAvailableCount === 0

      setIsSpinning(false)
      setResult(selectedSegment.text)
      setHistory(newHistory)

      await supabase
        .from('sessions')
        .update({
          wheel_is_spinning: false,
          wheel_result: selectedSegment.text,
          wheel_history: JSON.stringify(newHistory),
        })
        .eq('id', session.id)

      broadcastGameState({
        gameActive: true,
        segments,
        isSpinning: false,
        result: selectedSegment.text,
        usedSegmentIds: newUsedSegmentIds,
        isGameFinished: gameFinished,
      })

      toast.success(`Résultat: ${selectedSegment.text}`)

      if (gameFinished) {
        toast.success('🎉 Tous les segments ont été utilisés!', { duration: 5000 })
      }
    }, 5000)
  }

  async function clearResult() {
    if (!session) return

    setResult(null)

    await supabase
      .from('sessions')
      .update({ wheel_result: null })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      segments,
      isSpinning: false,
      result: null,
      usedSegmentIds,
      isGameFinished,
    })
  }

  async function exitGame() {
    if (!session) return

    // On garde les segments dans la DB, on reset juste l'état du jeu
    setGameActive(false)
    setIsSpinning(false)
    setResult(null)
    setHistory([])
    // Ne pas reset à DEFAULT_SEGMENTS - garder la configuration

    await supabase
      .from('sessions')
      .update({
        wheel_active: false,
        // On garde wheel_segments intact !
        wheel_is_spinning: false,
        wheel_result: null,
        wheel_history: JSON.stringify([]),
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: false,
      segments: [],
      isSpinning: false,
      result: null,
    })

    toast.success('Jeu arrêté - Configuration conservée')
    router.push('/admin/jeux')
  }

  // Fonction pour supprimer toutes les données
  async function clearAllData() {
    if (!session) return

    if (!window.confirm('Supprimer tous les segments ? Cette action est irréversible.')) {
      return
    }

    await supabase
      .from('sessions')
      .update({
        wheel_active: false,
        wheel_segments: null,
        wheel_is_spinning: false,
        wheel_result: null,
        wheel_history: null,
      })
      .eq('id', session.id)

    setGameActive(false)
    setSegments(DEFAULT_SEGMENTS)
    setHistory([])

    toast.success('Toutes les données ont été supprimées')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Aucune session trouvée</p>
          <Button onClick={() => router.push('/admin/dashboard')}>
            Retour au dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F]">
      {/* Header */}
      <header className="bg-[#242428] border-b border-[rgba(255,255,255,0.1)]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/jeux')}
              className="text-white hover:text-[#D4AF37]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                <span className="text-xl">🎡</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Roue de la Destinée</h1>
                <p className="text-sm text-[#6B6B70]">{session.name}</p>
              </div>
            </div>
          </div>
          {gameActive && (
            <Button
              size="sm"
              onClick={() => window.open(`/live/${session.code}`, '_blank')}
              className="bg-[#D4AF37] text-[#1A1A1E] hover:bg-[#F4D03F]"
            >
              <Monitor className="h-4 w-4 mr-2" />
              Voir le diaporama
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {!gameActive ? (
          /* Configuration */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-[#242428] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">🎡</span>
                <div>
                  <h2 className="text-xl font-bold text-white">Roue de la Destinée</h2>
                  <p className="text-gray-400 text-sm">Personnalisez les segments de la roue</p>
                </div>
              </div>

              {/* Add segment */}
              <div className="flex gap-2 mb-4">
                <input
                  value={newSegmentText}
                  onChange={(e) => setNewSegmentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSegment()}
                  placeholder="Nouveau défi..."
                  className="flex-1 bg-[#2E2E33] text-white rounded-xl px-4 py-3 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none"
                />
                <button
                  onClick={addSegment}
                  disabled={segments.length >= 12}
                  className="px-4 py-3 bg-[#D4AF37] text-black rounded-xl font-bold hover:bg-[#F4D03F] disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Segments list */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {segments.map((segment, index) => (
                  <div
                    key={segment.id}
                    className="flex items-center gap-3 bg-[#1A1A1E] rounded-lg p-3"
                  >
                    <span className="text-gray-500 font-mono text-sm w-6">{index + 1}.</span>
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 cursor-pointer relative group"
                      style={{ backgroundColor: segment.color }}
                    >
                      <input
                        type="color"
                        value={segment.color}
                        onChange={(e) => updateSegmentColor(segment.id, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    <input
                      value={segment.text}
                      onChange={(e) => updateSegmentText(segment.id, e.target.value)}
                      className="flex-1 bg-transparent text-white border-none focus:outline-none"
                    />
                    <button
                      onClick={() => removeSegment(segment.id)}
                      className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-gray-500 text-xs mt-3">
                {segments.length}/12 segments • Cliquez sur la couleur pour la modifier
              </p>
            </div>

            {/* Launch button */}
            <button
              onClick={launchGame}
              disabled={launching || segments.length < 2}
              className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {launching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>🚀 Configurer et ouvrir le diaporama</>
              )}
            </button>

            {/* Clear data button */}
            {segments.length > 0 && segments !== DEFAULT_SEGMENTS && (
              <button
                onClick={clearAllData}
                className="w-full py-3 border border-red-500/50 text-red-400 rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Réinitialiser les segments
              </button>
            )}
          </motion.div>
        ) : (
          /* Control Panel */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#242428] rounded-xl p-4 border-2 border-[#D4AF37]"
          >
            {/* Header avec status */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  isGameFinished ? 'bg-[#D4AF37] animate-pulse' :
                  isSpinning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                }`}></span>
                <span className="text-white font-bold">
                  {isGameFinished ? '🏆 Jeu terminé!' : isSpinning ? 'Rotation...' : result ? 'Résultat affiché' : 'Prêt'}
                </span>
              </div>
              <span className={`text-sm ${availableSegments.length === 0 ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
                {availableSegments.length}/{segments.length} restants
              </span>
            </div>

            {/* Current result */}
            {result && (
              <div className="bg-gradient-to-r from-[#D4AF37]/20 to-[#F4D03F]/20 rounded-lg p-4 mb-4 text-center border border-[#D4AF37]">
                <p className="text-gray-400 text-xs mb-1">RÉSULTAT</p>
                <p className="text-2xl font-bold text-[#D4AF37]">{result}</p>
              </div>
            )}

            {/* Spin button */}
            <button
              onClick={spinWheel}
              disabled={isSpinning || isGameFinished}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                isSpinning || isGameFinished
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black hover:opacity-90'
              }`}
            >
              {isSpinning ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Rotation en cours...
                </>
              ) : isGameFinished ? (
                <>
                  🏆 Tous les segments utilisés!
                </>
              ) : (
                <>
                  <RotateCcw className="h-6 w-6" />
                  🎡 FAIRE TOURNER
                </>
              )}
            </button>

            {/* Clear result */}
            {result && !isSpinning && (
              <button
                onClick={clearResult}
                className="w-full mt-2 py-2 bg-[#2E2E33] text-white rounded-lg font-medium hover:bg-[#3E3E43] transition-colors"
              >
                Masquer le résultat
              </button>
            )}

            {/* History */}
            {history.length > 0 && (
              <div className="mt-4 bg-[#1A1A1E] rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                  <History className="h-3 w-3" /> Historique
                </p>
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {history.slice(0, 5).map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{index + 1}.</span>
                      <span className="text-white">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quitter */}
            <button
              onClick={exitGame}
              className="w-full mt-4 py-2 bg-red-500/30 hover:bg-red-500 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" />
              Quitter le jeu
            </button>
          </motion.div>
        )}
      </main>
    </div>
  )
}
