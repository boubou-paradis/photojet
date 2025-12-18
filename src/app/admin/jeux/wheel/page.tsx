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
  Music,
  Volume2,
  VolumeX,
  Upload,
  Play,
  Pause,
  Square,
  Timer,
  Hand,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session, WheelSegment, WheelResult, WheelAudioSettings } from '@/types/database'
import { toast } from 'sonner'
import WheelPreview from '@/components/games/WheelPreview'

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
  const [spinMode, setSpinMode] = useState<'auto' | 'manual'>('auto')
  const pendingResultRef = useRef<{ segment: WheelSegment; index: number } | null>(null)
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Audio state
  const [audioSettings, setAudioSettings] = useState<WheelAudioSettings>({
    url: null,
    enabled: true,
    filename: null,
  })
  const [audioUploading, setAudioUploading] = useState(false)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null)
  const audioInputRef = useRef<HTMLInputElement | null>(null)

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
    audioSettings?: WheelAudioSettings
    spinMode?: 'auto' | 'manual'
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
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
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

      // Charger les paramètres audio
      if (data.wheel_audio) {
        try {
          setAudioSettings(JSON.parse(data.wheel_audio))
        } catch {
          // Keep default
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

  // Audio functions
  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez MP3, WAV ou OGG.')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10MB)')
      return
    }

    setAudioUploading(true)
    try {
      // Delete old audio if exists
      if (audioSettings.url) {
        const oldPath = audioSettings.url.split('/').pop()
        if (oldPath) {
          await supabase.storage
            .from('wheel-audio')
            .remove([`${session.id}/${oldPath}`])
        }
      }

      // Upload new audio
      const fileExt = file.name.split('.').pop()
      const fileName = `wheel-audio-${Date.now()}.${fileExt}`
      const filePath = `${session.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('wheel-audio')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('wheel-audio')
        .getPublicUrl(filePath)

      // Update settings
      const newSettings: WheelAudioSettings = {
        url: publicUrl,
        enabled: true,
        filename: file.name,
      }
      setAudioSettings(newSettings)

      // Save to database
      await supabase
        .from('sessions')
        .update({ wheel_audio: JSON.stringify(newSettings) })
        .eq('id', session.id)

      toast.success('Musique uploadée!')
    } catch (err) {
      console.error('Error uploading audio:', err)
      toast.error('Erreur lors de l\'upload')
    } finally {
      setAudioUploading(false)
      if (audioInputRef.current) {
        audioInputRef.current.value = ''
      }
    }
  }

  async function deleteAudio() {
    if (!session || !audioSettings.url) return

    try {
      // Extract path from URL
      const urlParts = audioSettings.url.split('/wheel-audio/')
      if (urlParts.length > 1) {
        await supabase.storage
          .from('wheel-audio')
          .remove([urlParts[1]])
      }

      // Update settings
      const newSettings: WheelAudioSettings = {
        url: null,
        enabled: false,
        filename: null,
      }
      setAudioSettings(newSettings)

      // Save to database
      await supabase
        .from('sessions')
        .update({ wheel_audio: JSON.stringify(newSettings) })
        .eq('id', session.id)

      // Stop preview if playing
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause()
        setIsPreviewPlaying(false)
      }

      toast.success('Musique supprimée')
    } catch (err) {
      console.error('Error deleting audio:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  async function toggleAudioEnabled() {
    if (!session) return

    const newSettings: WheelAudioSettings = {
      ...audioSettings,
      enabled: !audioSettings.enabled,
    }
    setAudioSettings(newSettings)

    await supabase
      .from('sessions')
      .update({ wheel_audio: JSON.stringify(newSettings) })
      .eq('id', session.id)
  }

  function toggleAudioPreview() {
    if (!audioPreviewRef.current || !audioSettings.url) return

    if (isPreviewPlaying) {
      audioPreviewRef.current.pause()
      setIsPreviewPlaying(false)
    } else {
      audioPreviewRef.current.play().catch(() => {})
      setIsPreviewPlaying(true)
    }
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
        audioSettings,
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

    // Store pending result for manual mode
    pendingResultRef.current = { segment: selectedSegment, index: randomIndex }

    // Update DB
    await supabase
      .from('sessions')
      .update({
        wheel_is_spinning: true,
        wheel_result: null,
      })
      .eq('id', session.id)

    // Broadcast spin start with target index (index in available segments)
    // In manual mode, don't send spinToIndex so the wheel spins infinitely
    broadcastGameState({
      gameActive: true,
      segments,
      isSpinning: true,
      result: null,
      spinToIndex: spinMode === 'auto' ? randomIndex : undefined,
      usedSegmentIds,
      isGameFinished: false,
      audioSettings,
      spinMode,
    })

    // In auto mode, stop after 8 seconds
    if (spinMode === 'auto') {
      spinTimeoutRef.current = setTimeout(() => {
        finishSpin(selectedSegment)
      }, 8000)
    }
    // In manual mode, wait for stopWheel() to be called
  }

  async function stopWheel() {
    if (!session || !isSpinning || !pendingResultRef.current) return

    // Clear any pending auto timeout
    if (spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current)
      spinTimeoutRef.current = null
    }

    const { segment: selectedSegment, index: randomIndex } = pendingResultRef.current

    // Broadcast the stop with target index so wheel animates to result
    broadcastGameState({
      gameActive: true,
      segments,
      isSpinning: true, // Still spinning, but now with target
      result: null,
      spinToIndex: randomIndex,
      usedSegmentIds,
      isGameFinished: false,
      audioSettings,
      spinMode: 'manual',
    })

    // Wait for the deceleration animation (3 seconds)
    setTimeout(() => {
      finishSpin(selectedSegment)
    }, 3000)
  }

  async function finishSpin(selectedSegment: WheelSegment) {
    if (!session) return

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
    pendingResultRef.current = null

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
      audioSettings,
    })

    toast.success(`Résultat: ${selectedSegment.text}`)

    if (gameFinished) {
      toast.success('🎉 Tous les segments ont été utilisés!', { duration: 5000 })
    }
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
      audioSettings,
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
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-[#D4AF37]" />
            <div className="absolute inset-0 h-12 w-12 animate-ping opacity-20 rounded-full bg-[#D4AF37]" />
          </div>
          <p className="text-gray-400 text-sm">Chargement...</p>
        </motion.div>
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
    <div className="min-h-screen bg-[#0D0D0F] overflow-hidden">
      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-[#D4AF37]/3 to-transparent rounded-full" />
      </div>
      {/* Header */}
      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/jeux')}
              className="text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-yellow-500/30 flex items-center justify-center">
                <span className="text-xl">🎡</span>
                <div className="absolute inset-0 rounded-xl bg-[#D4AF37]/20 blur-xl opacity-50" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Roue de la Destinée</h1>
                <p className="text-xs text-gray-500">{session.name}</p>
              </div>
            </div>
          </div>
          {gameActive && (
            <Button
              size="sm"
              onClick={() => window.open(`/live/${session.code}`, '_blank')}
              className="bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-semibold hover:opacity-90 transition-opacity"
            >
              <Monitor className="h-4 w-4 mr-2" />
              Voir le diaporama
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-4 lg:py-6 max-w-6xl">
        {!gameActive ? (
          /* Configuration - 2 colonnes sur desktop */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col lg:flex-row gap-6"
          >
            {/* Colonne gauche - Configuration */}
            <div className="flex-1 space-y-4">
              {/* Segments */}
              <div className="bg-[#242428] rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🎡</span>
                  <div>
                    <h2 className="text-lg font-bold text-white">Segments</h2>
                    <p className="text-gray-400 text-xs">{segments.length}/12 segments</p>
                  </div>
                </div>

                {/* Add segment */}
                <div className="flex gap-2 mb-3">
                  <input
                    value={newSegmentText}
                    onChange={(e) => setNewSegmentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addSegment()}
                    placeholder="Nouveau défi..."
                    className="flex-1 bg-[#2E2E33] text-white rounded-lg px-3 py-2 text-sm border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none"
                  />
                  <button
                    onClick={addSegment}
                    disabled={segments.length >= 12}
                    className="px-3 py-2 bg-[#D4AF37] text-black rounded-lg font-bold hover:bg-[#F4D03F] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Segments list - hauteur fixe avec scroll */}
                <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {segments.map((segment, index) => (
                    <div
                      key={segment.id}
                      className="flex items-center gap-2 bg-[#1A1A1E] rounded-lg p-2"
                    >
                      <span className="text-gray-500 font-mono text-xs w-5">{index + 1}.</span>
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0 cursor-pointer relative"
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
                        className="flex-1 bg-transparent text-white text-sm border-none focus:outline-none"
                      />
                      <button
                        onClick={() => removeSegment(segment.id)}
                        className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audio Section - Compact */}
              <div className="bg-[#242428] rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                    <Music className="h-4 w-4 text-[#D4AF37]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Musique de la roue</h3>
                    <p className="text-gray-400 text-xs">Son pendant la rotation</p>
                  </div>
                </div>

                {/* Upload zone */}
                {!audioSettings.url ? (
                  <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-[rgba(255,255,255,0.1)] rounded-lg cursor-pointer hover:border-[#D4AF37]/50 transition-colors bg-[#1A1A1E]">
                    {audioUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Upload className="h-5 w-5" />
                        <span className="text-sm">Uploader (MP3, WAV, OGG)</span>
                      </div>
                    )}
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/mpeg,audio/wav,audio/ogg,audio/mp3"
                      onChange={handleAudioUpload}
                      className="hidden"
                      disabled={audioUploading}
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-[#1A1A1E] rounded-lg p-2">
                      <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center flex-shrink-0">
                        <Music className="h-4 w-4 text-[#D4AF37]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">
                          {audioSettings.filename || 'Fichier audio'}
                        </p>
                      </div>
                      <button
                        onClick={toggleAudioPreview}
                        className="p-1.5 rounded-lg bg-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/30"
                      >
                        {isPreviewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={deleteAudio}
                        className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-[#1A1A1E] rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        {audioSettings.enabled ? (
                          <Volume2 className="h-3.5 w-3.5 text-[#D4AF37]" />
                        ) : (
                          <VolumeX className="h-3.5 w-3.5 text-gray-500" />
                        )}
                        <span className="text-white text-xs">Son activé</span>
                      </div>
                      <button
                        onClick={toggleAudioEnabled}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          audioSettings.enabled ? 'bg-[#D4AF37]' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            audioSettings.enabled ? 'left-5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {audioSettings.url && (
                  <audio
                    ref={audioPreviewRef}
                    src={audioSettings.url}
                    onEnded={() => setIsPreviewPlaying(false)}
                  />
                )}
              </div>

              {/* Buttons */}
              <div className="space-y-2">
                <button
                  onClick={launchGame}
                  disabled={launching || segments.length < 2}
                  className="w-full py-3 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {launching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>🚀 Configurer et ouvrir le diaporama</>
                  )}
                </button>

                {segments.length > 0 && segments !== DEFAULT_SEGMENTS && (
                  <button
                    onClick={clearAllData}
                    className="w-full py-2 border border-red-500/50 text-red-400 rounded-xl text-sm hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>

            {/* Colonne droite - Prévisualisation (hidden on mobile) */}
            <div className="hidden lg:flex flex-col items-center justify-center bg-[#242428] rounded-xl p-6 min-w-[340px]">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Prévisualisation</h3>
              <WheelPreview segments={segments} size={280} />
              <p className="text-gray-500 text-xs mt-4 text-center">
                La roue se met à jour en temps réel
              </p>
            </div>
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

            {/* Mode selector */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSpinMode('auto')}
                disabled={isSpinning}
                className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  spinMode === 'auto'
                    ? 'bg-[#D4AF37] text-black'
                    : 'bg-[#1A1A1E] text-gray-400 hover:text-white'
                } ${isSpinning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Timer className="h-4 w-4" />
                Auto (8s)
              </button>
              <button
                onClick={() => setSpinMode('manual')}
                disabled={isSpinning}
                className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  spinMode === 'manual'
                    ? 'bg-[#D4AF37] text-black'
                    : 'bg-[#1A1A1E] text-gray-400 hover:text-white'
                } ${isSpinning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Hand className="h-4 w-4" />
                Manuel
              </button>
            </div>

            {/* Current result */}
            {result && (
              <div className="bg-gradient-to-r from-[#D4AF37]/20 to-[#F4D03F]/20 rounded-lg p-4 mb-4 text-center border border-[#D4AF37]">
                <p className="text-gray-400 text-xs mb-1">RÉSULTAT</p>
                <p className="text-2xl font-bold text-[#D4AF37]">{result}</p>
              </div>
            )}

            {/* Spin / Stop buttons */}
            {!isSpinning ? (
              <button
                onClick={spinWheel}
                disabled={isGameFinished}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                  isGameFinished
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black hover:opacity-90'
                }`}
              >
                {isGameFinished ? (
                  <>🏆 Tous les segments utilisés!</>
                ) : (
                  <>
                    <RotateCcw className="h-6 w-6" />
                    🎡 FAIRE TOURNER {spinMode === 'manual' ? '(Manuel)' : ''}
                  </>
                )}
              </button>
            ) : spinMode === 'manual' ? (
              <button
                onClick={stopWheel}
                className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all bg-red-500 text-white hover:bg-red-600 animate-pulse"
              >
                <Square className="h-6 w-6" />
                🛑 STOP !
              </button>
            ) : (
              <button
                disabled
                className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-gray-600 text-gray-400 cursor-not-allowed"
              >
                <Loader2 className="h-6 w-6 animate-spin" />
                Rotation en cours...
              </button>
            )}

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
