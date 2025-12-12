'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Play,
  Square,
  Monitor,
  RotateCcw,
  Trophy,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session } from '@/types/database'
import { toast } from 'sonner'

export default function LineupPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)

  // Configuration
  const [teamSize, setTeamSize] = useState(5)
  const [clockDuration, setClockDuration] = useState(30)
  const [team1Name, setTeam1Name] = useState('Équipe 1')
  const [team2Name, setTeam2Name] = useState('Équipe 2')

  // Game state
  const [gameActive, setGameActive] = useState(false)
  const [team1Score, setTeam1Score] = useState(0)
  const [team2Score, setTeam2Score] = useState(0)
  const [currentNumber, setCurrentNumber] = useState('')
  const [timeLeft, setTimeLeft] = useState(30)
  const [isRunning, setIsRunning] = useState(false)
  const [currentPoints, setCurrentPoints] = useState(10)
  const [showWinner, setShowWinner] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchSession()
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

      // Initialize state from session
      if (data.lineup_active) {
        setGameActive(true)
        setTeamSize(data.lineup_team_size ?? 5)
        setClockDuration(data.lineup_clock_duration ?? 30)
        setTeam1Name(data.lineup_team1_name ?? 'Équipe 1')
        setTeam2Name(data.lineup_team2_name ?? 'Équipe 2')
        setTeam1Score(data.lineup_team1_score ?? 0)
        setTeam2Score(data.lineup_team2_score ?? 0)
        setCurrentNumber(data.lineup_current_number ?? '')
        setTimeLeft(data.lineup_time_left ?? 30)
        setIsRunning(data.lineup_is_running ?? false)
        setCurrentPoints(data.lineup_current_points ?? 10)
        setShowWinner(data.lineup_show_winner ?? false)
      }
    } catch (err) {
      console.error('Error fetching session:', err)
      toast.error('Erreur lors du chargement de la session')
    } finally {
      setLoading(false)
    }
  }

  // Subscribe to session changes for real-time state updates
  useEffect(() => {
    if (!session) return

    const channel = supabase
      .channel(`lineup-admin-${session.id}`)
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
          setGameActive(updated.lineup_active ?? false)
          setTeam1Score(updated.lineup_team1_score ?? 0)
          setTeam2Score(updated.lineup_team2_score ?? 0)
          setCurrentNumber(updated.lineup_current_number ?? '')
          setTimeLeft(updated.lineup_time_left ?? 30)
          setIsRunning(updated.lineup_is_running ?? false)
          setCurrentPoints(updated.lineup_current_points ?? 10)
          setShowWinner(updated.lineup_show_winner ?? false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.id, supabase])

  // Generate random order
  const generateNumber = useCallback(() => {
    const digits = Array.from({ length: teamSize }, (_, i) => i + 1)
    // Fisher-Yates shuffle
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[digits[i], digits[j]] = [digits[j], digits[i]]
    }
    return digits.join('')
  }, [teamSize])

  // Timer effect
  useEffect(() => {
    if (!isRunning || timeLeft <= 0 || !session) return

    const timer = setInterval(async () => {
      const newTime = timeLeft - 1

      // Calculate points based on time remaining
      const thirdOfTime = clockDuration / 3
      let newPoints = 10
      if (newTime > thirdOfTime * 2) {
        newPoints = 10 // First third - fewest points
      } else if (newTime > thirdOfTime) {
        newPoints = 20 // Second third
      } else {
        newPoints = 30 // Last third - most points (urgency!)
      }

      setTimeLeft(newTime)
      setCurrentPoints(newPoints)

      // Update database
      await supabase
        .from('sessions')
        .update({
          lineup_time_left: newTime,
          lineup_current_points: newPoints,
          lineup_is_running: newTime > 0,
        })
        .eq('id', session.id)

      if (newTime <= 0) {
        setIsRunning(false)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [isRunning, timeLeft, clockDuration, session, supabase])

  async function launchGame() {
    if (!session) return

    setLaunching(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          lineup_active: true,
          lineup_team_size: teamSize,
          lineup_clock_duration: clockDuration,
          lineup_team1_name: team1Name,
          lineup_team2_name: team2Name,
          lineup_team1_score: 0,
          lineup_team2_score: 0,
          lineup_current_number: '',
          lineup_time_left: clockDuration,
          lineup_is_running: false,
          lineup_current_points: 10,
          lineup_show_winner: false,
        })
        .eq('id', session.id)

      if (error) throw error

      setGameActive(true)
      setTeam1Score(0)
      setTeam2Score(0)
      setCurrentNumber('')
      setTimeLeft(clockDuration)
      setIsRunning(false)
      setCurrentPoints(10)
      setShowWinner(false)
      toast.success('Jeu lancé!')

      // Open slideshow in new tab
      window.open(`/live/${session.code}`, '_blank')
    } catch (err) {
      console.error('Error launching game:', err)
      toast.error('Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  async function startRound() {
    if (!session) return

    const newNumber = generateNumber()
    setCurrentNumber(newNumber)
    setTimeLeft(clockDuration)
    setIsRunning(true)
    setCurrentPoints(10)
    setShowWinner(false)

    await supabase
      .from('sessions')
      .update({
        lineup_current_number: newNumber,
        lineup_time_left: clockDuration,
        lineup_is_running: true,
        lineup_current_points: 10,
        lineup_show_winner: false,
      })
      .eq('id', session.id)
  }

  async function stopRound() {
    if (!session) return

    setIsRunning(false)

    await supabase
      .from('sessions')
      .update({ lineup_is_running: false })
      .eq('id', session.id)
  }

  async function awardPoints(team: 1 | 2) {
    if (!session) return

    const newTeam1Score = team === 1 ? team1Score + currentPoints : team1Score
    const newTeam2Score = team === 2 ? team2Score + currentPoints : team2Score

    if (team === 1) {
      setTeam1Score(newTeam1Score)
    } else {
      setTeam2Score(newTeam2Score)
    }

    setCurrentNumber('')
    setTimeLeft(clockDuration)
    setIsRunning(false)

    await supabase
      .from('sessions')
      .update({
        lineup_team1_score: newTeam1Score,
        lineup_team2_score: newTeam2Score,
        lineup_current_number: '',
        lineup_time_left: clockDuration,
        lineup_is_running: false,
      })
      .eq('id', session.id)

    toast.success(`${team === 1 ? team1Name : team2Name} gagne ${currentPoints} points!`)
  }

  async function showInitialOrder() {
    if (!session) return

    const initial = Array.from({ length: teamSize }, (_, i) => teamSize - i).join('')
    setCurrentNumber(initial)
    setIsRunning(false)

    await supabase
      .from('sessions')
      .update({
        lineup_current_number: initial,
        lineup_is_running: false,
      })
      .eq('id', session.id)
  }

  async function clearNumber() {
    if (!session) return

    setCurrentNumber('')
    setIsRunning(false)

    await supabase
      .from('sessions')
      .update({
        lineup_current_number: '',
        lineup_is_running: false,
      })
      .eq('id', session.id)
  }

  async function resetScores() {
    if (!session) return

    setTeam1Score(0)
    setTeam2Score(0)

    await supabase
      .from('sessions')
      .update({
        lineup_team1_score: 0,
        lineup_team2_score: 0,
      })
      .eq('id', session.id)

    toast.success('Scores remis à zéro')
  }

  async function showWinnerScreen() {
    if (!session) return

    setShowWinner(true)
    setIsRunning(false)

    await supabase
      .from('sessions')
      .update({
        lineup_show_winner: true,
        lineup_is_running: false,
      })
      .eq('id', session.id)
  }

  async function hideWinnerScreen() {
    if (!session) return

    setShowWinner(false)

    await supabase
      .from('sessions')
      .update({ lineup_show_winner: false })
      .eq('id', session.id)
  }

  async function exitGame() {
    if (!session) return

    await supabase
      .from('sessions')
      .update({
        lineup_active: false,
        lineup_is_running: false,
        lineup_current_number: '',
        lineup_show_winner: false,
      })
      .eq('id', session.id)

    setGameActive(false)
    setIsRunning(false)
    setCurrentNumber('')
    setShowWinner(false)
    toast.success('Jeu arrêté')
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!gameActive) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (isRunning) {
          stopRound()
        } else {
          startRound()
        }
      }
      if ((e.code === 'Digit1' || e.code === 'ArrowLeft') && !isRunning && currentNumber) {
        awardPoints(1)
      }
      if ((e.code === 'Digit2' || e.code === 'ArrowRight') && !isRunning && currentNumber) {
        awardPoints(2)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [gameActive, isRunning, currentNumber])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
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
    <div className="min-h-screen bg-[#1A1A1E]">
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
                <Users className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Le Bon Ordre</h1>
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
            className="bg-[#242428] rounded-xl p-6 space-y-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">🏃</span>
              <div>
                <h2 className="text-xl font-bold text-white">Le Bon Ordre</h2>
                <p className="text-gray-400 text-sm">Les équipes se placent dans l&apos;ordre affiché</p>
              </div>
            </div>

            {/* Nombre de joueurs par équipe */}
            <div>
              <label className="text-white mb-2 block font-medium">Joueurs par équipe</label>
              <div className="flex gap-2">
                {[4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setTeamSize(n)}
                    className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                      teamSize === n
                        ? 'bg-[#D4AF37] text-black'
                        : 'bg-[#2E2E33] text-white hover:bg-[#3E3E43]'
                    }`}
                  >
                    {n} joueurs
                  </button>
                ))}
              </div>
            </div>

            {/* Durée du chronomètre */}
            <div>
              <label className="text-white mb-2 block font-medium">Durée du chronomètre</label>
              <div className="flex gap-2">
                {[15, 30, 45, 60].map(sec => (
                  <button
                    key={sec}
                    onClick={() => {
                      setClockDuration(sec)
                      setTimeLeft(sec)
                    }}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                      clockDuration === sec
                        ? 'bg-[#D4AF37] text-black'
                        : 'bg-[#2E2E33] text-white hover:bg-[#3E3E43]'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            {/* Noms des équipes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white mb-2 block font-medium">Équipe 1</label>
                <input
                  value={team1Name}
                  onChange={(e) => setTeam1Name(e.target.value)}
                  placeholder="Nom équipe 1"
                  className="w-full bg-[#2E2E33] text-white rounded-xl p-3 text-center font-bold border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-white mb-2 block font-medium">Équipe 2</label>
                <input
                  value={team2Name}
                  onChange={(e) => setTeam2Name(e.target.value)}
                  placeholder="Nom équipe 2"
                  className="w-full bg-[#2E2E33] text-white rounded-xl p-3 text-center font-bold border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </div>

            {/* Bouton lancer */}
            <button
              onClick={launchGame}
              disabled={launching}
              className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {launching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>🚀 Lancer le jeu</>
              )}
            </button>
          </motion.div>
        ) : (
          /* Control Panel - Compact */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#242428] rounded-xl p-4 border-2 border-[#D4AF37]"
          >
            {/* Header compact */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-white font-bold text-sm">Jeu en cours</span>
              </div>
              <div className="text-xs text-gray-500">
                Espace = Start/Stop
              </div>
            </div>

            {/* Scores côte à côte - compact */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-[#1A1A1E] rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs truncate">{team1Name}</p>
                <p className="text-3xl font-bold text-white">{team1Score}</p>
              </div>
              <div className="bg-[#1A1A1E] rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs truncate">{team2Name}</p>
                <p className="text-3xl font-bold text-white">{team2Score}</p>
              </div>
            </div>

            {/* Numéro + Points + Timer - compact */}
            <div className="bg-[#1A1A1E] rounded-lg p-3 mb-3 text-center">
              <p className="text-4xl font-bold text-[#D4AF37] tracking-widest font-mono mb-1">
                {currentNumber || Array(teamSize).fill('-').join('')}
              </p>
              <div className="flex justify-center items-center gap-4">
                <span className={`font-bold ${
                  currentPoints === 30 ? 'text-green-400' :
                  currentPoints === 20 ? 'text-yellow-400' :
                  'text-orange-400'
                }`}>
                  {currentPoints} pts
                </span>
                <span className={`text-3xl font-bold font-mono ${
                  timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'
                }`}>
                  {timeLeft}s
                </span>
              </div>
            </div>

            {/* Boutons principaux - grille 2x2 */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={startRound}
                disabled={isRunning}
                className="py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
              >
                <Play className="h-4 w-4" />
                START
              </button>
              <button
                onClick={stopRound}
                disabled={!isRunning}
                className="py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
              >
                <Square className="h-4 w-4" />
                STOP
              </button>
              <button
                onClick={() => awardPoints(1)}
                disabled={isRunning || !currentNumber}
                className="py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold text-sm disabled:opacity-50 transition-colors truncate px-2"
              >
                ✓ {team1Name}
              </button>
              <button
                onClick={() => awardPoints(2)}
                disabled={isRunning || !currentNumber}
                className="py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-bold text-sm disabled:opacity-50 transition-colors truncate px-2"
              >
                ✓ {team2Name}
              </button>
            </div>

            {/* Actions secondaires - une ligne */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              <button
                onClick={showInitialOrder}
                className="py-2 bg-[#2E2E33] hover:bg-[#3E3E43] text-white rounded-lg text-xs transition-colors"
              >
                📋 Initial
              </button>
              <button
                onClick={clearNumber}
                className="py-2 bg-[#2E2E33] hover:bg-[#3E3E43] text-white rounded-lg text-xs transition-colors"
              >
                🗑️ Effacer
              </button>
              <button
                onClick={resetScores}
                className="py-2 bg-[#2E2E33] hover:bg-[#3E3E43] text-white rounded-lg text-xs transition-colors"
              >
                🔄 Reset
              </button>
              <button
                onClick={showWinner ? hideWinnerScreen : showWinnerScreen}
                className="py-2 bg-[#D4AF37] hover:bg-[#F4D03F] text-black rounded-lg text-xs font-bold transition-colors"
              >
                🏆 {showWinner ? 'Masquer' : 'Gagnant'}
              </button>
            </div>

            {/* Quitter */}
            <button
              onClick={exitGame}
              className="w-full py-2 bg-red-500/50 hover:bg-red-500 text-white rounded-lg text-sm transition-colors"
            >
              ✖️ Quitter le jeu
            </button>
          </motion.div>
        )}
      </main>
    </div>
  )
}
