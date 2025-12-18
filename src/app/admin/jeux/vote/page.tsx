'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Play,
  Pause,
  Monitor,
  Trophy,
  X,
  Plus,
  Check,
  Timer,
  BarChart3,
  Image,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session, Photo, VotePhotoCandidate } from '@/types/database'
import { toast } from 'sonner'

export default function VotePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)

  // Photos de la session pour sélection
  const [sessionPhotos, setSessionPhotos] = useState<Photo[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)

  // Configuration
  const [selectedPhotos, setSelectedPhotos] = useState<VotePhotoCandidate[]>([])
  const [useTimer, setUseTimer] = useState(false)
  const [timerDuration, setTimerDuration] = useState(60)

  // Game state
  const [gameActive, setGameActive] = useState(false)
  const [isVoteOpen, setIsVoteOpen] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showPodium, setShowPodium] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const router = useRouter()
  const supabase = createClient()
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    fetchSession()
  }, [])

  // Setup broadcast channel
  useEffect(() => {
    if (!session) return

    const channel = supabase.channel(`vote-game-${session.code}`)
    broadcastChannelRef.current = channel
    channel.subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [session?.code, supabase])

  // Broadcast game state
  const broadcastGameState = useCallback((state: {
    gameActive: boolean
    photos: VotePhotoCandidate[]
    isVoteOpen: boolean
    showResults: boolean
    showPodium: boolean
    timeLeft: number | null
  }) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'vote_state',
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

      // Charger les photos sélectionnées depuis la DB (même si le jeu n'est pas actif)
      if (data.vote_photos) {
        try {
          setSelectedPhotos(JSON.parse(data.vote_photos))
        } catch {
          setSelectedPhotos([])
        }
      }

      // Initialize game state from session si le jeu est actif
      if (data.vote_active) {
        setGameActive(true)
        setIsVoteOpen(data.vote_is_open ?? false)
        setShowResults(data.vote_show_results ?? false)
        setShowPodium(data.vote_show_podium ?? false)
        setTimeLeft(data.vote_timer_left ?? null)
      }

      // Fetch session photos
      await fetchPhotos(data.id)
    } catch (err) {
      console.error('Error fetching session:', err)
      toast.error('Erreur lors du chargement de la session')
    } finally {
      setLoading(false)
    }
  }

  async function fetchPhotos(sessionId: string) {
    setLoadingPhotos(true)
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'approved')
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      setSessionPhotos(data || [])
    } catch (err) {
      console.error('Error fetching photos:', err)
    } finally {
      setLoadingPhotos(false)
    }
  }

  // Timer effect
  useEffect(() => {
    if (!isVoteOpen || timeLeft === null || timeLeft <= 0 || !session) return

    const timer = setInterval(async () => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 0) return 0
        const newTime = prev - 1

        if (newTime <= 0) {
          // Time's up - close voting
          setIsVoteOpen(false)
          setShowResults(true)
          supabase
            .from('sessions')
            .update({
              vote_is_open: false,
              vote_show_results: true,
              vote_timer_left: 0,
            })
            .eq('id', session.id)

          broadcastGameState({
            gameActive: true,
            photos: selectedPhotos,
            isVoteOpen: false,
            showResults: true,
            showPodium: false,
            timeLeft: 0,
          })

          toast.info('Temps écoulé ! Vote terminé.')
        } else {
          supabase
            .from('sessions')
            .update({ vote_timer_left: newTime })
            .eq('id', session.id)

          broadcastGameState({
            gameActive: true,
            photos: selectedPhotos,
            isVoteOpen: true,
            showResults: false,
            showPodium: false,
            timeLeft: newTime,
          })
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isVoteOpen, timeLeft, session, selectedPhotos, broadcastGameState, supabase])

  // Subscribe to realtime votes
  useEffect(() => {
    if (!session || !gameActive) return

    const channel = supabase
      .channel(`votes-realtime-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.new.vote_photos) {
            try {
              const updatedPhotos = JSON.parse(payload.new.vote_photos)
              setSelectedPhotos(updatedPhotos)
            } catch {
              // Ignore parse errors
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, gameActive, supabase])

  // Sauvegarder les photos sélectionnées dans la DB
  async function savePhotosToDatabase(updatedPhotos: VotePhotoCandidate[]) {
    if (!session) return
    await supabase
      .from('sessions')
      .update({ vote_photos: JSON.stringify(updatedPhotos) })
      .eq('id', session.id)
  }

  function togglePhotoSelection(photo: Photo) {
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
    const exists = selectedPhotos.find(p => p.photoId === photo.id)

    let updatedPhotos: VotePhotoCandidate[]
    if (exists) {
      updatedPhotos = selectedPhotos.filter(p => p.photoId !== photo.id)
    } else {
      if (selectedPhotos.length >= 10) {
        toast.error('Maximum 10 photos')
        return
      }
      updatedPhotos = [
        ...selectedPhotos,
        { photoId: photo.id, photoUrl: urlData.publicUrl, votes: 0 }
      ]
    }
    setSelectedPhotos(updatedPhotos)
    savePhotosToDatabase(updatedPhotos)
  }

  async function launchGame() {
    if (!session || selectedPhotos.length < 2) {
      toast.error('Sélectionnez au moins 2 photos')
      return
    }

    setLaunching(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          vote_active: true,
          vote_photos: JSON.stringify(selectedPhotos),
          vote_votes: JSON.stringify([]),
          vote_is_open: false,
          vote_show_results: false,
          vote_show_podium: false,
          vote_timer: useTimer ? timerDuration : null,
          vote_timer_left: useTimer ? timerDuration : null,
        })
        .eq('id', session.id)

      if (error) throw error

      setGameActive(true)
      setIsVoteOpen(false)
      setShowResults(false)
      setShowPodium(false)
      setTimeLeft(useTimer ? timerDuration : null)

      broadcastGameState({
        gameActive: true,
        photos: selectedPhotos,
        isVoteOpen: false,
        showResults: false,
        showPodium: false,
        timeLeft: useTimer ? timerDuration : null,
      })

      toast.success('Jeu configuré!')
      window.open(`/live/${session.code}`, 'photojet-live')
    } catch (err) {
      console.error('Error launching game:', err)
      toast.error('Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  async function startVote() {
    if (!session) return

    const initialTimer = useTimer ? timerDuration : null
    setIsVoteOpen(true)
    setShowResults(false)
    setShowPodium(false)
    setTimeLeft(initialTimer)

    // Reset votes
    const resetPhotos = selectedPhotos.map(p => ({ ...p, votes: 0 }))
    setSelectedPhotos(resetPhotos)

    await supabase
      .from('sessions')
      .update({
        vote_photos: JSON.stringify(resetPhotos),
        vote_votes: JSON.stringify([]),
        vote_is_open: true,
        vote_show_results: false,
        vote_show_podium: false,
        vote_timer_left: initialTimer,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      photos: resetPhotos,
      isVoteOpen: true,
      showResults: false,
      showPodium: false,
      timeLeft: initialTimer,
    })

    toast.success('Vote ouvert!')
  }

  async function stopVote() {
    if (!session) return

    setIsVoteOpen(false)
    setTimeLeft(null)

    await supabase
      .from('sessions')
      .update({
        vote_is_open: false,
        vote_timer_left: null,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      photos: selectedPhotos,
      isVoteOpen: false,
      showResults: false,
      showPodium: false,
      timeLeft: null,
    })

    toast.info('Vote arrêté')
  }

  async function toggleResults() {
    if (!session) return

    const newShowResults = !showResults
    setShowResults(newShowResults)
    if (newShowResults) setShowPodium(false)

    await supabase
      .from('sessions')
      .update({
        vote_show_results: newShowResults,
        vote_show_podium: false,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      photos: selectedPhotos,
      isVoteOpen,
      showResults: newShowResults,
      showPodium: false,
      timeLeft,
    })
  }

  async function togglePodium() {
    if (!session) return

    const newShowPodium = !showPodium
    setShowPodium(newShowPodium)
    if (newShowPodium) setShowResults(false)

    await supabase
      .from('sessions')
      .update({
        vote_show_results: false,
        vote_show_podium: newShowPodium,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      photos: selectedPhotos,
      isVoteOpen,
      showResults: false,
      showPodium: newShowPodium,
      timeLeft,
    })
  }

  async function exitGame() {
    if (!session) return

    // On garde les photos sélectionnées dans la DB, on reset juste l'état du jeu
    setGameActive(false)
    setIsVoteOpen(false)
    setShowResults(false)
    setShowPodium(false)
    setTimeLeft(null)
    // Ne pas vider selectedPhotos - garder la sélection

    await supabase
      .from('sessions')
      .update({
        vote_active: false,
        // On garde vote_photos intact !
        vote_votes: JSON.stringify([]),
        vote_is_open: false,
        vote_show_results: false,
        vote_show_podium: false,
        vote_timer: null,
        vote_timer_left: null,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: false,
      photos: [],
      isVoteOpen: false,
      showResults: false,
      showPodium: false,
      timeLeft: null,
    })

    toast.success('Jeu arrêté - Configuration conservée')
    router.push('/admin/jeux')
  }

  // Fonction pour supprimer toutes les données
  async function clearAllData() {
    if (!session) return

    if (!window.confirm('Désélectionner toutes les photos ?')) {
      return
    }

    await supabase
      .from('sessions')
      .update({
        vote_active: false,
        vote_photos: null,
        vote_votes: null,
        vote_is_open: false,
        vote_show_results: false,
        vote_show_podium: false,
        vote_timer: null,
        vote_timer_left: null,
      })
      .eq('id', session.id)

    setGameActive(false)
    setSelectedPhotos([])

    toast.success('Sélection réinitialisée')
  }

  // Sort photos by votes for display
  const sortedPhotos = [...selectedPhotos].sort((a, b) => b.votes - a.votes)
  const totalVotes = selectedPhotos.reduce((sum, p) => sum + p.votes, 0)

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
    <div className="min-h-screen bg-[#0D0D0F] relative">
      {/* Animated background effects - Rose/Pink theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl border-b border-white/5">
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
                <span className="text-xl">🗳️</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Vote Photo</h1>
                <p className="text-sm text-[#6B6B70]">{session.name}</p>
              </div>
            </div>
          </div>
          {gameActive && (
            <Button
              size="sm"
              onClick={() => window.open(`/live/${session.code}`, 'photojet-live')}
              className="bg-[#D4AF37] text-[#1A1A1E] hover:bg-[#F4D03F]"
            >
              <Monitor className="h-4 w-4 mr-2" />
              Voir le diaporama
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {!gameActive ? (
          /* Configuration */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-[#242428] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">🗳️</span>
                <div>
                  <h2 className="text-xl font-bold text-white">Vote Photo</h2>
                  <p className="text-gray-400 text-sm">Les invités votent pour leur photo préférée</p>
                </div>
              </div>

              {/* Timer option */}
              <div className="mb-6">
                <label className="flex items-center gap-3 text-white mb-3">
                  <input
                    type="checkbox"
                    checked={useTimer}
                    onChange={(e) => setUseTimer(e.target.checked)}
                    className="w-5 h-5 rounded bg-[#2E2E33] border-[#3E3E43] text-[#D4AF37] focus:ring-[#D4AF37]"
                  />
                  <Timer className="h-5 w-5 text-[#D4AF37]" />
                  <span>Limiter la durée du vote</span>
                </label>
                {useTimer && (
                  <div className="grid grid-cols-4 gap-2 ml-8">
                    {[30, 60, 90, 120].map(sec => (
                      <button
                        key={sec}
                        onClick={() => setTimerDuration(sec)}
                        className={`py-2 rounded-xl font-bold transition-all ${
                          timerDuration === sec
                            ? 'bg-[#D4AF37] text-black'
                            : 'bg-[#2E2E33] text-white hover:bg-[#3E3E43]'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Photo selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white font-medium flex items-center gap-2">
                    <Image className="h-5 w-5 text-[#D4AF37]" />
                    Sélectionnez les photos (2-10)
                  </label>
                  <span className="text-[#D4AF37] font-bold">{selectedPhotos.length}/10</span>
                </div>

                {loadingPhotos ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
                  </div>
                ) : sessionPhotos.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    Aucune photo approuvée dans la session
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {sessionPhotos.map(photo => {
                      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
                      const isSelected = selectedPhotos.some(p => p.photoId === photo.id)
                      return (
                        <div
                          key={photo.id}
                          onClick={() => togglePhotoSelection(photo)}
                          className={`aspect-square rounded-xl overflow-hidden cursor-pointer relative group transition-all ${
                            isSelected ? 'ring-4 ring-[#D4AF37]' : 'hover:ring-2 hover:ring-[#D4AF37]/50'
                          }`}
                        >
                          <img
                            src={urlData.publicUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-[#D4AF37]/30 flex items-center justify-center">
                              <Check className="h-8 w-8 text-white" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Launch button */}
            <button
              onClick={launchGame}
              disabled={launching || selectedPhotos.length < 2}
              className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {launching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>🚀 Configurer et ouvrir le diaporama</>
              )}
            </button>

            {/* Clear data button */}
            {selectedPhotos.length > 0 && (
              <button
                onClick={clearAllData}
                className="w-full py-3 border border-red-500/50 text-red-400 rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" />
                Désélectionner toutes les photos ({selectedPhotos.length})
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
                <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                  isVoteOpen ? 'bg-green-500' : 'bg-gray-500'
                }`}></span>
                <span className="text-white font-bold">
                  {isVoteOpen ? 'Vote en cours' : showPodium ? 'Podium' : showResults ? 'Résultats' : 'En attente'}
                </span>
              </div>
              {timeLeft !== null && timeLeft > 0 && (
                <span className={`text-2xl font-bold font-mono ${
                  timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-[#D4AF37]'
                }`}>
                  {timeLeft}s
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#1A1A1E] rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Photos</p>
                <p className="text-2xl font-bold text-white">{selectedPhotos.length}</p>
              </div>
              <div className="bg-[#1A1A1E] rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Votes totaux</p>
                <p className="text-2xl font-bold text-[#D4AF37]">{totalVotes}</p>
              </div>
            </div>

            {/* Live results */}
            <div className="bg-[#1A1A1E] rounded-lg p-3 mb-4 max-h-[200px] overflow-y-auto">
              <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                <BarChart3 className="h-3 w-3" /> Classement en direct
              </p>
              <div className="space-y-2">
                {sortedPhotos.map((photo, index) => {
                  const percentage = totalVotes > 0 ? (photo.votes / totalVotes * 100) : 0
                  return (
                    <div key={photo.photoId} className="flex items-center gap-2">
                      <span className={`text-sm font-bold w-5 ${
                        index === 0 ? 'text-[#FFD700]' : index === 1 ? 'text-[#C0C0C0]' : index === 2 ? 'text-[#CD7F32]' : 'text-gray-500'
                      }`}>
                        {index + 1}.
                      </span>
                      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                        <img src={photo.photoUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <div className="h-2 bg-[#2E2E33] rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]"
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                      <span className="text-white font-bold text-sm w-12 text-right">
                        {photo.votes}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-2">
              {!isVoteOpen ? (
                <button
                  onClick={startVote}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2"
                >
                  <Play className="h-5 w-5" />
                  {totalVotes > 0 ? '🔄 Nouveau vote' : '🗳️ Ouvrir le vote'}
                </button>
              ) : (
                <button
                  onClick={stopVote}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Pause className="h-5 w-5" />
                  Arrêter le vote
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={toggleResults}
                  disabled={isVoteOpen}
                  className={`py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
                    showResults
                      ? 'bg-[#D4AF37] text-black'
                      : 'bg-[#2E2E33] text-white hover:bg-[#3E3E43]'
                  } disabled:opacity-50`}
                >
                  <BarChart3 className="h-4 w-4" />
                  Résultats
                </button>
                <button
                  onClick={togglePodium}
                  disabled={isVoteOpen}
                  className={`py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
                    showPodium
                      ? 'bg-[#D4AF37] text-black'
                      : 'bg-[#2E2E33] text-white hover:bg-[#3E3E43]'
                  } disabled:opacity-50`}
                >
                  <Trophy className="h-4 w-4" />
                  Podium
                </button>
              </div>
            </div>

            {/* Quitter */}
            <button
              onClick={exitGame}
              className="w-full mt-3 py-2 bg-red-500/30 hover:bg-red-500 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
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
