'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Monitor,
  X,
  Plus,
  Trash2,
  Check,
  XCircle,
  Trophy,
  Camera,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session, PhotoChallenge, ChallengeSubmission } from '@/types/database'
import { toast } from 'sonner'

// Default challenges
const DEFAULT_CHALLENGES: PhotoChallenge[] = [
  { id: '1', title: 'Photo avec le/la marié(e)', points: 10, enabled: true },
  { id: '2', title: 'Grimace la plus drôle', points: 15, enabled: true },
  { id: '3', title: 'Photo de groupe 10+ personnes', points: 20, enabled: true },
  { id: '4', title: 'Photo sur la piste de danse', points: 10, enabled: true },
  { id: '5', title: 'Selfie avec le DJ', points: 15, enabled: true },
]

export default function DefisPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)

  // Configuration
  const [challenges, setChallenges] = useState<PhotoChallenge[]>(DEFAULT_CHALLENGES)
  const [newChallengeTitle, setNewChallengeTitle] = useState('')
  const [newChallengePoints, setNewChallengePoints] = useState(10)

  // Game state
  const [gameActive, setGameActive] = useState(false)
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([])
  const [currentChallenge, setCurrentChallenge] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    fetchSession()
  }, [])

  // Setup broadcast channel
  useEffect(() => {
    if (!session) return

    const channel = supabase.channel(`defis-game-${session.code}`)
    broadcastChannelRef.current = channel
    channel.subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [session?.code, supabase])

  // Broadcast game state
  const broadcastGameState = useCallback((state: {
    gameActive: boolean
    challenges: PhotoChallenge[]
    currentChallenge: string | null
    submissions: ChallengeSubmission[]
    lastValidated?: ChallengeSubmission | null
  }) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'defis_state',
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

      // Charger les challenges depuis la DB (même si le jeu n'est pas actif)
      if (data.challenges_list) {
        try {
          setChallenges(JSON.parse(data.challenges_list))
        } catch {
          setChallenges(DEFAULT_CHALLENGES)
        }
      }

      // Initialize game state from session si le jeu est actif
      if (data.challenges_active) {
        setGameActive(true)
        setCurrentChallenge(data.challenges_current ?? null)
        if (data.challenges_submissions) {
          try {
            setSubmissions(JSON.parse(data.challenges_submissions))
          } catch {
            setSubmissions([])
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

  // Subscribe to realtime submissions
  useEffect(() => {
    if (!session || !gameActive) return

    const channel = supabase
      .channel(`defis-realtime-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.new.challenges_submissions) {
            try {
              setSubmissions(JSON.parse(payload.new.challenges_submissions))
            } catch {
              // Ignore
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, gameActive, supabase])

  // Sauvegarder les challenges dans la DB
  async function saveChallengesToDatabase(updatedChallenges: PhotoChallenge[]) {
    if (!session) return
    await supabase
      .from('sessions')
      .update({ challenges_list: JSON.stringify(updatedChallenges) })
      .eq('id', session.id)
  }

  function addChallenge() {
    if (!newChallengeTitle.trim()) return

    const newChallenge: PhotoChallenge = {
      id: Date.now().toString(),
      title: newChallengeTitle.trim(),
      points: newChallengePoints,
      enabled: true,
    }
    const updatedChallenges = [...challenges, newChallenge]
    setChallenges(updatedChallenges)
    saveChallengesToDatabase(updatedChallenges)
    setNewChallengeTitle('')
    setNewChallengePoints(10)
  }

  function removeChallenge(id: string) {
    const updatedChallenges = challenges.filter(c => c.id !== id)
    setChallenges(updatedChallenges)
    saveChallengesToDatabase(updatedChallenges)
  }

  function toggleChallenge(id: string) {
    const updatedChallenges = challenges.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
    setChallenges(updatedChallenges)
    saveChallengesToDatabase(updatedChallenges)
  }

  async function launchGame() {
    if (!session) return

    const enabledChallenges = challenges.filter(c => c.enabled)
    if (enabledChallenges.length === 0) {
      toast.error('Activez au moins un défi')
      return
    }

    setLaunching(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          challenges_active: true,
          challenges_list: JSON.stringify(challenges),
          challenges_submissions: JSON.stringify([]),
          challenges_current: null,
        })
        .eq('id', session.id)

      if (error) throw error

      setGameActive(true)
      setSubmissions([])
      setCurrentChallenge(null)

      broadcastGameState({
        gameActive: true,
        challenges,
        currentChallenge: null,
        submissions: [],
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

  async function displayChallenge(challengeId: string) {
    if (!session) return

    setCurrentChallenge(challengeId)

    await supabase
      .from('sessions')
      .update({ challenges_current: challengeId })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      challenges,
      currentChallenge: challengeId,
      submissions,
    })
  }

  async function hideChallenge() {
    if (!session) return

    setCurrentChallenge(null)

    await supabase
      .from('sessions')
      .update({ challenges_current: null })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      challenges,
      currentChallenge: null,
      submissions,
    })
  }

  async function validateSubmission(submission: ChallengeSubmission, approved: boolean) {
    if (!session) return

    const updatedSubmissions = submissions.map(s =>
      s.id === submission.id ? { ...s, status: approved ? 'approved' as const : 'rejected' as const } : s
    )
    setSubmissions(updatedSubmissions)

    await supabase
      .from('sessions')
      .update({ challenges_submissions: JSON.stringify(updatedSubmissions) })
      .eq('id', session.id)

    if (approved) {
      // Broadcast validation with photo info
      broadcastGameState({
        gameActive: true,
        challenges,
        currentChallenge,
        submissions: updatedSubmissions,
        lastValidated: submission,
      })
      toast.success(`Photo validée! ${submission.visitorName} gagne des points!`)
    } else {
      broadcastGameState({
        gameActive: true,
        challenges,
        currentChallenge,
        submissions: updatedSubmissions,
      })
      toast.info('Photo rejetée')
    }
  }

  async function exitGame() {
    if (!session) return

    // On garde les challenges dans la DB, on reset juste l'état du jeu
    setGameActive(false)
    setSubmissions([])
    setCurrentChallenge(null)
    // Ne pas reset à DEFAULT_CHALLENGES - garder la configuration

    await supabase
      .from('sessions')
      .update({
        challenges_active: false,
        // On garde challenges_list intact !
        challenges_submissions: JSON.stringify([]),
        challenges_current: null,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: false,
      challenges: [],
      currentChallenge: null,
      submissions: [],
    })

    toast.success('Jeu arrêté - Configuration conservée')
    router.push('/admin/jeux')
  }

  // Fonction pour supprimer toutes les données
  async function clearAllData() {
    if (!session) return

    if (!window.confirm('Supprimer tous les défis ? Cette action est irréversible.')) {
      return
    }

    await supabase
      .from('sessions')
      .update({
        challenges_active: false,
        challenges_list: null,
        challenges_submissions: null,
        challenges_current: null,
      })
      .eq('id', session.id)

    setGameActive(false)
    setChallenges(DEFAULT_CHALLENGES)
    setSubmissions([])

    toast.success('Toutes les données ont été supprimées')
  }

  // Stats
  const pendingSubmissions = submissions.filter(s => s.status === 'pending')
  const approvedSubmissions = submissions.filter(s => s.status === 'approved')

  // Leaderboard
  const leaderboard = approvedSubmissions.reduce((acc, s) => {
    const challenge = challenges.find(c => c.id === s.challengeId)
    const points = challenge?.points || 0
    if (!acc[s.visitorId]) {
      acc[s.visitorId] = { name: s.visitorName, score: 0 }
    }
    acc[s.visitorId].score += points
    return acc
  }, {} as Record<string, { name: string; score: number }>)

  const sortedLeaderboard = Object.entries(leaderboard)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 5)

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
      {/* Animated background effects - Emerald/Green theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
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
                <span className="text-xl">📸</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Défis Photo</h1>
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
                <span className="text-4xl">📸</span>
                <div>
                  <h2 className="text-xl font-bold text-white">Défis Photo</h2>
                  <p className="text-gray-400 text-sm">Créez des défis photo pour vos invités</p>
                </div>
              </div>

              {/* Add challenge */}
              <div className="flex gap-2 mb-4">
                <input
                  value={newChallengeTitle}
                  onChange={(e) => setNewChallengeTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addChallenge()}
                  placeholder="Nouveau défi..."
                  className="flex-1 bg-[#2E2E33] text-white rounded-xl px-4 py-3 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none"
                />
                <select
                  value={newChallengePoints}
                  onChange={(e) => setNewChallengePoints(Number(e.target.value))}
                  className="bg-[#2E2E33] text-white rounded-xl px-3 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none"
                >
                  <option value={5}>5 pts</option>
                  <option value={10}>10 pts</option>
                  <option value={15}>15 pts</option>
                  <option value={20}>20 pts</option>
                  <option value={25}>25 pts</option>
                  <option value={30}>30 pts</option>
                </select>
                <button
                  onClick={addChallenge}
                  className="px-4 py-3 bg-[#D4AF37] text-black rounded-xl font-bold hover:bg-[#F4D03F] flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Challenges list */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className={`flex items-center gap-3 rounded-lg p-3 transition-all ${
                      challenge.enabled ? 'bg-[#1A1A1E]' : 'bg-[#1A1A1E]/50 opacity-60'
                    }`}
                  >
                    <button
                      onClick={() => toggleChallenge(challenge.id)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        challenge.enabled ? 'bg-[#D4AF37] text-black' : 'bg-[#3E3E43] text-gray-500'
                      }`}
                    >
                      {challenge.enabled && <Check className="h-4 w-4" />}
                    </button>
                    <span className="flex-1 text-white">{challenge.title}</span>
                    <span className="px-2 py-1 bg-[#D4AF37]/20 text-[#D4AF37] rounded font-bold text-sm">
                      {challenge.points} pts
                    </span>
                    <button
                      onClick={() => removeChallenge(challenge.id)}
                      className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-gray-500 text-xs mt-3">
                {challenges.filter(c => c.enabled).length} défis actifs
              </p>
            </div>

            {/* Launch button */}
            <button
              onClick={launchGame}
              disabled={launching || challenges.filter(c => c.enabled).length === 0}
              className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {launching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>🚀 Configurer et ouvrir le diaporama</>
              )}
            </button>

            {/* Clear data button */}
            {challenges.length > 0 && challenges !== DEFAULT_CHALLENGES && (
              <button
                onClick={clearAllData}
                className="w-full py-3 border border-red-500/50 text-red-400 rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Réinitialiser les défis
              </button>
            )}
          </motion.div>
        ) : (
          /* Control Panel */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Challenges & Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#242428] rounded-xl p-4 border-2 border-[#D4AF37]"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Camera className="h-5 w-5 text-[#D4AF37]" />
                  Défis
                </h3>
                <span className="text-[#D4AF37] text-sm">{pendingSubmissions.length} en attente</span>
              </div>

              {/* Challenges */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 mb-4">
                {challenges.filter(c => c.enabled).map((challenge) => (
                  <div
                    key={challenge.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                      currentChallenge === challenge.id
                        ? 'bg-[#D4AF37] text-black'
                        : 'bg-[#1A1A1E] text-white hover:bg-[#2E2E33]'
                    }`}
                    onClick={() => currentChallenge === challenge.id ? hideChallenge() : displayChallenge(challenge.id)}
                  >
                    <span className="flex-1 text-sm">{challenge.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      currentChallenge === challenge.id ? 'bg-black/20' : 'bg-[#D4AF37]/20 text-[#D4AF37]'
                    }`}>
                      {challenge.points} pts
                    </span>
                  </div>
                ))}
              </div>

              {currentChallenge && (
                <button
                  onClick={hideChallenge}
                  className="w-full py-2 bg-[#2E2E33] text-white rounded-lg font-medium hover:bg-[#3E3E43]"
                >
                  Masquer le défi
                </button>
              )}

              {/* Leaderboard */}
              {sortedLeaderboard.length > 0 && (
                <div className="mt-4 bg-[#1A1A1E] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                    <Trophy className="h-3 w-3" /> Classement
                  </p>
                  <div className="space-y-1">
                    {sortedLeaderboard.map(([id, data], index) => (
                      <div key={id} className="flex items-center gap-2 text-sm">
                        <span className={`font-bold ${
                          index === 0 ? 'text-[#FFD700]' : index === 1 ? 'text-[#C0C0C0]' : index === 2 ? 'text-[#CD7F32]' : 'text-gray-500'
                        }`}>
                          {index + 1}.
                        </span>
                        <span className="text-white flex-1">{data.name}</span>
                        <span className="text-[#D4AF37] font-bold">{data.score}</span>
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

            {/* Right: Submissions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#242428] rounded-xl p-4"
            >
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-[#D4AF37]" />
                Soumissions en attente ({pendingSubmissions.length})
              </h3>

              {pendingSubmissions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Aucune soumission en attente
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {pendingSubmissions.map((submission) => {
                    const challenge = challenges.find(c => c.id === submission.challengeId)
                    return (
                      <div key={submission.id} className="bg-[#1A1A1E] rounded-lg overflow-hidden">
                        <div className="aspect-video relative">
                          <img
                            src={submission.photoUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-3">
                          <p className="text-white font-medium">{submission.visitorName}</p>
                          <p className="text-gray-400 text-sm">{challenge?.title}</p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => validateSubmission(submission, true)}
                              className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-1"
                            >
                              <Check className="h-4 w-4" />
                              Valider
                            </button>
                            <button
                              onClick={() => validateSubmission(submission, false)}
                              className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium flex items-center justify-center gap-1"
                            >
                              <XCircle className="h-4 w-4" />
                              Rejeter
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </main>
    </div>
  )
}
