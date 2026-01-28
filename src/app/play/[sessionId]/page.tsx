'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Wifi, WifiOff, CheckCircle2, XCircle, Trophy, Clock, Sparkles, Crown, Target } from 'lucide-react'

// Lib
import { createClient } from '@/lib/supabase'
import { getLocalClient } from '@/lib/realtime'
import {
  HostEventType,
  NextQuestionEvent,
  QuestionClosedEvent,
  LeaderboardEntry,
} from '@/lib/realtime/types'
import { getEstimatedHostTime } from '@/lib/quiz/antiCheat'

// Components
import KahootAnswerGridPlayer from '@/components/quiz/KahootAnswerGridPlayer'
import TimerBar from '@/components/quiz/TimerBar'

type PlayerState = 'CONNECTING' | 'WAITING' | 'ANSWERING' | 'ANSWERED' | 'REVEAL' | 'LEADERBOARD' | 'FINISHED'

// Quiz state from Supabase broadcast
interface QuizBroadcastState {
  gameActive: boolean
  questions: Array<{
    id: string
    question: string
    answers: string[]
    correctAnswer: number
    timeLimit: number
    points: number
  }>
  currentQuestionIndex: number
  isAnswering: boolean
  showResults: boolean
  timeLeft: number | null
  participants: Array<{
    odientId: string
    odientName: string
    totalScore: number
    correctAnswers: number
  }>
  answerStats: number[]
}

export default function PlayQuizPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = params.sessionId as string
  const sessionCode = searchParams.get('code') || ''
  const playerId = searchParams.get('playerId') || ''
  const playerName = searchParams.get('name') || 'Joueur'
  const supabase = createClient()

  // Connection state
  const [connected, setConnected] = useState(false)
  const [playerState, setPlayerState] = useState<PlayerState>('CONNECTING')
  const [useSupabase, setUseSupabase] = useState(false)

  // Supabase quiz state
  const [quizState, setQuizState] = useState<QuizBroadcastState | null>(null)

  // Time sync
  const [offsetMs, setOffsetMs] = useState(0)
  const [latency, setLatency] = useState(0)

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<{
    index: number
    question: string
    answers: { A: string; B: string; C: string; D: string }
    opensAt: number
    closesAt: number
    nonce: string
    hideQuestion: boolean
    points: number
  } | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null)
  const [correctKey, setCorrectKey] = useState<'A' | 'B' | 'C' | 'D' | null>(null)
  const [timeLeftMs, setTimeLeftMs] = useState(0)
  const [totalTimeMs, setTotalTimeMs] = useState(20000)

  // Results
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null)
  const [lastPointsEarned, setLastPointsEarned] = useState<number>(0)
  const [lastSpeedBonus, setLastSpeedBonus] = useState<string>('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [myScore, setMyScore] = useState(0)

  // Anti-cheat
  const [antiCheatEnabled, setAntiCheatEnabled] = useState(false)
  const [canAnswer, setCanAnswer] = useState(false)

  // Refs
  const clientRef = useRef(getLocalClient())
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const answerTimeRef = useRef<number>(0) // Track time when answer was submitted

  // Calculate progressive points based on response time
  const calculateProgressivePoints = useCallback((basePoints: number, timeUsedMs: number, totalTimeMs: number): { points: number; bonus: string } => {
    const timePercent = (timeUsedMs / totalTimeMs) * 100

    if (timePercent <= 25) {
      // 0-25% du temps utilisé = 100% des points
      return { points: basePoints, bonus: 'Éclair !' }
    } else if (timePercent <= 50) {
      // 25-50% du temps = 75% des points
      return { points: Math.round(basePoints * 0.75), bonus: 'Rapide !' }
    } else if (timePercent <= 75) {
      // 50-75% du temps = 50% des points
      return { points: Math.round(basePoints * 0.5), bonus: 'Bien !' }
    } else {
      // 75-100% du temps = 25% des points
      return { points: Math.round(basePoints * 0.25), bonus: 'Juste à temps' }
    }
  }, [])

  // Subscribe to Supabase quiz channel with Presence tracking
  useEffect(() => {
    if (!sessionCode) return

    console.log('Subscribing to Supabase quiz channel:', `quiz-game-${sessionCode}`)

    const channel = supabase
      .channel(`quiz-game-${sessionCode}`)
      .on('broadcast', { event: 'quiz_state' }, (payload) => {
        console.log('Received quiz state from Supabase:', payload)
        if (payload.payload) {
          setQuizState(payload.payload as QuizBroadcastState)
          setUseSupabase(true)
          setConnected(true)
        }
      })
      .subscribe(async (status) => {
        console.log('Supabase channel status:', status)
        if (status === 'SUBSCRIBED') {
          setConnected(true)
          setPlayerState('WAITING')

          // Track presence - let admin know this player is connected
          await channel.track({
            odientId: playerId,
            odientName: decodeURIComponent(playerName),
            joinedAt: Date.now(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionCode, supabase, playerId, playerName])

  // Handle quiz state changes from Supabase
  useEffect(() => {
    if (!quizState || !useSupabase) return

    const q = quizState.questions[quizState.currentQuestionIndex]
    if (!q) return

    if (quizState.gameActive && quizState.isAnswering) {
      // Question is active
      setCurrentQuestion({
        index: quizState.currentQuestionIndex,
        question: q.question,
        answers: {
          A: q.answers[0] || '',
          B: q.answers[1] || '',
          C: q.answers[2] || '',
          D: q.answers[3] || '',
        },
        opensAt: Date.now(),
        closesAt: Date.now() + (quizState.timeLeft || 20) * 1000,
        nonce: q.id,
        hideQuestion: false,
        points: q.points,
      })
      setPlayerState('ANSWERING')
      setCanAnswer(true)
      setTotalTimeMs((quizState.timeLeft || 20) * 1000)
      setTimeLeftMs((quizState.timeLeft || 20) * 1000)
      setCorrectKey(null)
    } else if (quizState.gameActive && quizState.showResults) {
      // Results are shown
      const correctIndex = q.correctAnswer
      const keys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D']
      setCorrectKey(keys[correctIndex])
      setPlayerState('REVEAL')
      setCanAnswer(false)

      // Check if answer was correct
      if (selectedAnswer !== null) {
        const selectedIndex = keys.indexOf(selectedAnswer)
        setLastAnswerCorrect(selectedIndex === correctIndex)
      }
    } else if (quizState.gameActive && !quizState.isAnswering && !quizState.showResults) {
      // Waiting between questions
      setPlayerState('WAITING')
      setSelectedAnswer(null)
      setCorrectKey(null)
      setLastPointsEarned(0)
      setLastSpeedBonus('')
    } else if (!quizState.gameActive) {
      // Quiz not active
      setPlayerState('WAITING')
    }

    // Update score
    const myEntry = quizState.participants.find(p => p.odientId === playerId)
    if (myEntry) {
      setMyScore(myEntry.totalScore)
    }
  }, [quizState, useSupabase, playerId, selectedAnswer])

  // Timer for smooth countdown (syncs with broadcasts from admin)
  useEffect(() => {
    if (playerState !== 'ANSWERING') return

    const timer = setInterval(() => {
      setTimeLeftMs(prev => {
        const newTime = prev - 100
        return Math.max(0, newTime)
      })
    }, 100)

    return () => clearInterval(timer)
  }, [playerState])

  // Connect to local client for demo mode (fallback)
  useEffect(() => {
    // Only use local client if Supabase doesn't work after 2 seconds
    const timeout = setTimeout(() => {
      if (!useSupabase) {
        const client = clientRef.current

        client.connect(sessionId, 'player').then(() => {
          if (!useSupabase) {
            setConnected(true)
            setPlayerState('WAITING')

            // Send join request
            client.send({
              type: 'join_request',
              playerId,
              playerName: decodeURIComponent(playerName),
              sessionCode,
              timestamp: Date.now(),
            })
          }
        })
      }
    }, 2000)

    // Listen for host events (demo mode)
    const unsubscribe = clientRef.current.onHostEvent((event: HostEventType) => {
      if (!useSupabase) {
        handleHostEvent(event)
      }
    })

    return () => {
      clearTimeout(timeout)
      unsubscribe()
      clientRef.current.disconnect()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [sessionId, playerId, playerName, sessionCode, useSupabase])

  // Handle host events
  const handleHostEvent = useCallback(
    (event: HostEventType) => {
      switch (event.type) {
        case 'quiz_started':
          setAntiCheatEnabled(event.antiCheatEnabled)
          setPlayerState('WAITING')
          break

        case 'sync_ping':
          // Respond to sync ping
          clientRef.current.send({
            type: 'sync_pong',
            playerId,
            timestamp: Date.now(),
            hostSentAt: event.hostSentAt,
            playerReceivedAt: Date.now(),
            playerSentAt: Date.now(),
          })
          // Estimate latency
          setLatency(Math.round((Date.now() - event.hostSentAt) / 2))
          break

        case 'sync_offset':
          if (event.playerId === playerId) {
            setOffsetMs(event.offsetMs)
          }
          break

        case 'next_question': {
          const q = event as NextQuestionEvent
          setCurrentQuestion({
            index: q.questionIndex,
            question: q.question,
            answers: q.answers,
            opensAt: q.opensAt,
            closesAt: q.closesAt,
            nonce: q.nonce,
            hideQuestion: q.hideQuestionOnMobile,
            points: q.points,
          })
          setSelectedAnswer(null)
          setCorrectKey(null)
          setLastAnswerCorrect(null)
          setLastPointsEarned(0)
          setLastSpeedBonus('')
          setPlayerState('ANSWERING')
          setTotalTimeMs(q.durationMs)
          setCanAnswer(false)

          // Start timer
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = setInterval(() => {
            const hostNow = getEstimatedHostTime(Date.now(), offsetMs)
            const timeLeft = q.closesAt - hostNow
            setTimeLeftMs(Math.max(0, timeLeft))

            // Enable answering when window opens
            if (hostNow >= q.opensAt && hostNow < q.closesAt) {
              setCanAnswer(true)
            } else {
              setCanAnswer(false)
            }

            // Auto-close when time is up
            if (timeLeft <= 0) {
              if (timerRef.current) clearInterval(timerRef.current)
            }
          }, 50)
          break
        }

        case 'question_closed': {
          const closed = event as QuestionClosedEvent
          setCorrectKey(closed.correctKey)
          setPlayerState('REVEAL')
          setCanAnswer(false)
          if (timerRef.current) clearInterval(timerRef.current)

          // Check if our answer was correct
          if (selectedAnswer !== null) {
            setLastAnswerCorrect(selectedAnswer === closed.correctKey)
          }
          break
        }

        case 'leaderboard_update':
          setLeaderboard(event.leaderboard)
          // Find my rank
          const myEntry = event.leaderboard.find((e) => e.playerId === playerId)
          if (myEntry) {
            setMyRank(myEntry.rank)
            setMyScore(myEntry.score)
          }
          setPlayerState('LEADERBOARD')
          break

        case 'quiz_finished':
          setLeaderboard(event.finalLeaderboard)
          const finalEntry = event.finalLeaderboard.find((e) => e.playerId === playerId)
          if (finalEntry) {
            setMyRank(finalEntry.rank)
            setMyScore(finalEntry.score)
          }
          setPlayerState('FINISHED')
          break
      }
    },
    [playerId, offsetMs, selectedAnswer]
  )

  // Handle answer selection
  const handleAnswer = useCallback(
    async (key: 'A' | 'B' | 'C' | 'D') => {
      if (!canAnswer || selectedAnswer !== null || !currentQuestion) return

      const clientSentAt = Date.now()
      const estimatedHostAt = getEstimatedHostTime(clientSentAt, offsetMs)

      setSelectedAnswer(key)
      setPlayerState('ANSWERED')

      // Convert key to index (A=0, B=1, C=2, D=3)
      const answerIndex = ['A', 'B', 'C', 'D'].indexOf(key)

      // Check if answer is correct and calculate progressive points based on time
      const currentQ = quizState?.questions[currentQuestion.index]
      const isCorrect = currentQ && answerIndex === currentQ.correctAnswer

      // Calculate time used (totalTimeMs - timeLeftMs = time used)
      const timeUsedMs = totalTimeMs - timeLeftMs
      answerTimeRef.current = timeUsedMs

      // Calculate progressive points based on response time
      const basePoints = currentQ?.points || 10
      let pointsEarned = 0
      let speedBonus = ''

      if (isCorrect) {
        const result = calculateProgressivePoints(basePoints, timeUsedMs, totalTimeMs)
        pointsEarned = result.points
        speedBonus = result.bonus
      }

      // Store for display in reveal state
      setLastPointsEarned(pointsEarned)
      setLastSpeedBonus(speedBonus)

      // Save answer to Supabase if using production mode
      if (useSupabase && sessionId) {
        try {
          // Get current answers and participants
          const { data: session } = await supabase
            .from('sessions')
            .select('quiz_answers, quiz_participants')
            .eq('id', sessionId)
            .single()

          // Update answers
          const answers = session?.quiz_answers ? JSON.parse(session.quiz_answers) : []
          answers.push({
            odientId: playerId,
            questionId: currentQuestion.nonce,
            answerIndex,
            timestamp: clientSentAt,
          })

          // Update participant score
          const participants = session?.quiz_participants ? JSON.parse(session.quiz_participants) : []
          const participantIndex = participants.findIndex((p: { odientId: string }) => p.odientId === playerId)

          if (participantIndex >= 0) {
            participants[participantIndex].totalScore += pointsEarned
            if (isCorrect) {
              participants[participantIndex].correctAnswers += 1
            }
          } else {
            // New participant - add them to the list
            participants.push({
              odientId: playerId,
              odientName: decodeURIComponent(playerName),
              totalScore: pointsEarned,
              correctAnswers: isCorrect ? 1 : 0,
            })
          }

          // Save to database
          await supabase
            .from('sessions')
            .update({
              quiz_answers: JSON.stringify(answers),
              quiz_participants: JSON.stringify(participants),
            })
            .eq('id', sessionId)

          // Update local score
          if (isCorrect) {
            setMyScore(prev => prev + pointsEarned)
          }
        } catch (err) {
          console.error('Error saving answer:', err)
        }
      }

      // Also send via BroadcastChannel for demo mode
      clientRef.current.send({
        type: 'answer_submitted',
        playerId,
        timestamp: clientSentAt,
        questionIndex: currentQuestion.index,
        answerKey: key,
        clientSentAt,
        estimatedHostAt,
        nonce: currentQuestion.nonce,
      })
    },
    [canAnswer, selectedAnswer, currentQuestion, playerId, offsetMs, useSupabase, sessionId, supabase, quizState, calculateProgressivePoints, totalTimeMs, timeLeftMs]
  )

  // Render based on state
  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-b from-[#0a0a1a] via-[#12121f] to-[#0a0a1a] flex flex-col overflow-hidden">
      {/* Premium ambient halos */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-[-20%] left-[-30%] w-[60%] h-[40%] rounded-full blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)' }}
          animate={{ x: [0, 20, 0], y: [0, 15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[-15%] right-[-20%] w-[50%] h-[35%] rounded-full blur-[80px]"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)' }}
          animate={{ x: [0, -15, 0], y: [0, -10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(0,0,0,0.5)_100%)]" />
      </div>

      {/* Header premium */}
      <header className="relative z-10 px-4 py-3 flex items-center justify-between bg-gradient-to-r from-black/40 via-black/30 to-black/40 backdrop-blur-md border-b border-[#D4AF37]/20">
        <div className="flex items-center gap-3">
          {connected ? (
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40">
              <Wifi className="h-4 w-4 text-green-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
            </div>
          ) : (
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40">
              <WifiOff className="h-4 w-4 text-red-400 animate-pulse" />
            </div>
          )}
          <span className="text-white font-bold text-lg tracking-wide">{decodeURIComponent(playerName)}</span>
        </div>
        <div className="flex items-center gap-3">
          {latency > 0 && (
            <span className="text-gray-600 text-xs font-mono">{latency}ms</span>
          )}
          <motion.div
            key={myScore}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400 }}
            className="flex items-center gap-2 bg-gradient-to-r from-[#D4AF37]/25 to-[#B8860B]/20 text-[#D4AF37] px-4 py-2 rounded-xl text-sm font-black border border-[#D4AF37]/40"
            style={{ boxShadow: '0 0 20px rgba(212, 175, 55, 0.2)' }}
          >
            <Trophy className="w-4 h-4" />
            {myScore} pts
          </motion.div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-3">
        <AnimatePresence mode="wait">
          {/* CONNECTING */}
          {playerState === 'CONNECTING' && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <motion.div
                className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-[#D4AF37]/30 flex items-center justify-center"
                style={{ boxShadow: '0 0 40px rgba(212, 175, 55, 0.2)' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="h-10 w-10 text-[#D4AF37]" />
              </motion.div>
              <p className="text-white text-xl font-bold tracking-wide">Connexion...</p>
              <p className="text-gray-500 text-sm mt-2">Veuillez patienter</p>
            </motion.div>
          )}

          {/* WAITING */}
          {playerState === 'WAITING' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <motion.div
                className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-b from-[#D4AF37]/20 to-transparent border-2 border-[#D4AF37]/40 flex items-center justify-center"
                style={{ boxShadow: '0 0 50px rgba(212, 175, 55, 0.25)' }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Target className="w-12 h-12 text-[#D4AF37]" />
              </motion.div>
              <h2 className="text-3xl font-black text-white mb-3 tracking-wide">Prêt !</h2>
              <p className="text-gray-400 text-lg">En attente de la prochaine question...</p>
              <motion.div
                className="mt-6 flex justify-center gap-1"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-[#D4AF37]"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* ANSWERING / ANSWERED */}
          {(playerState === 'ANSWERING' || playerState === 'ANSWERED') && currentQuestion && (
            <motion.div
              key="answering"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-lg flex flex-col flex-1"
            >
              {/* Timer */}
              <div className="mb-4 px-2">
                <TimerBar timeLeftMs={timeLeftMs} totalMs={totalTimeMs} />
              </div>

              {/* Question (if not hidden) - Hero style */}
              {!currentQuestion.hideQuestion && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="relative bg-gradient-to-b from-[#1a1a2e]/90 to-[#0f0a20]/90 rounded-2xl p-5 mb-4 mx-2 border-2 border-[#D4AF37]/30 backdrop-blur-sm"
                  style={{
                    boxShadow: '0 0 30px rgba(212, 175, 55, 0.15), 0 10px 40px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  <p className="text-white text-xl font-black text-center leading-tight"
                     style={{
                       textShadow: '0 0 20px rgba(255, 255, 255, 0.15), 0 2px 8px rgba(0, 0, 0, 0.5)'
                     }}>
                    {currentQuestion.question}
                  </p>
                </motion.div>
              )}

              {/* Hidden question mode */}
              {currentQuestion.hideQuestion && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center mb-4 py-3"
                >
                  <p className="text-[#D4AF37] text-2xl font-black"
                     style={{ textShadow: '0 0 20px rgba(212, 175, 55, 0.4)' }}>
                    À vous de jouer !
                  </p>
                </motion.div>
              )}

              {/* Answer grid */}
              <div className="flex-1 flex items-center">
                <KahootAnswerGridPlayer
                  answers={currentQuestion.answers}
                  disabled={!canAnswer || playerState === 'ANSWERED'}
                  hideText={currentQuestion.hideQuestion}
                  selectedAnswer={selectedAnswer}
                  onSelect={handleAnswer}
                />
              </div>

              {/* Answered confirmation - Premium style */}
              {playerState === 'ANSWERED' && (
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="mt-4 text-center"
                >
                  <div className="inline-flex items-center gap-3 bg-gradient-to-r from-green-500/25 to-emerald-500/20 text-green-400 px-6 py-3 rounded-2xl border-2 border-green-500/40"
                       style={{ boxShadow: '0 0 25px rgba(34, 197, 94, 0.3), 0 8px 25px rgba(0, 0, 0, 0.3)' }}>
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
                    >
                      <CheckCircle2 className="h-7 w-7" />
                    </motion.div>
                    <span className="font-black text-lg tracking-wide">Réponse envoyée !</span>
                  </div>
                </motion.div>
              )}

              {/* Waiting to answer (anti-cheat) */}
              {playerState === 'ANSWERING' && !canAnswer && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 text-center"
                >
                  <div className="inline-flex items-center gap-3 text-[#D4AF37]/80 px-5 py-2.5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                    <Clock className="h-5 w-5 animate-pulse" />
                    <span className="font-bold">Préparez-vous...</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* REVEAL */}
          {playerState === 'REVEAL' && currentQuestion && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md"
            >
              {/* Result */}
              <motion.div
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="text-center mb-6"
              >
                {lastAnswerCorrect === true ? (
                  <div className="inline-flex flex-col items-center">
                    <motion.div
                      className="w-20 h-20 rounded-full bg-gradient-to-b from-green-500/30 to-green-600/10 border-2 border-green-500/50 flex items-center justify-center mb-4"
                      style={{ boxShadow: '0 0 40px rgba(34, 197, 94, 0.4)' }}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </motion.div>
                    <div className="text-2xl font-black text-green-400 tracking-wide">Correct !</div>
                    {lastSpeedBonus && (
                      <motion.div
                        className="text-yellow-300 text-sm font-bold mt-1"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        {lastSpeedBonus}
                      </motion.div>
                    )}
                    <motion.div
                      className="text-[#D4AF37] text-xl font-bold mt-2"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, type: 'spring', stiffness: 400 }}
                    >
                      +{lastPointsEarned} pts
                    </motion.div>
                  </div>
                ) : lastAnswerCorrect === false ? (
                  <div className="inline-flex flex-col items-center">
                    <motion.div
                      className="w-20 h-20 rounded-full bg-gradient-to-b from-red-500/30 to-red-600/10 border-2 border-red-500/50 flex items-center justify-center mb-4"
                      style={{ boxShadow: '0 0 40px rgba(239, 68, 68, 0.3)' }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <XCircle className="w-10 h-10 text-red-400" />
                    </motion.div>
                    <div className="text-2xl font-black text-red-400 tracking-wide">Raté !</div>
                  </div>
                ) : (
                  <div className="inline-flex flex-col items-center">
                    <motion.div
                      className="w-20 h-20 rounded-full bg-gradient-to-b from-gray-500/30 to-gray-600/10 border-2 border-gray-500/50 flex items-center justify-center mb-4"
                      style={{ boxShadow: '0 0 30px rgba(156, 163, 175, 0.2)' }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <Clock className="w-10 h-10 text-gray-400" />
                    </motion.div>
                    <div className="text-2xl font-black text-gray-400 tracking-wide">Temps écoulé</div>
                  </div>
                )}
              </motion.div>

              {/* Answer grid with result */}
              <KahootAnswerGridPlayer
                answers={currentQuestion.answers}
                disabled={true}
                selectedAnswer={selectedAnswer}
                correctKey={correctKey}
                onSelect={() => {}}
              />
            </motion.div>
          )}

          {/* LEADERBOARD */}
          {playerState === 'LEADERBOARD' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-sm text-center"
            >
              <motion.div
                className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-b from-[#D4AF37]/25 to-transparent border-2 border-[#D4AF37]/40 flex items-center justify-center"
                style={{ boxShadow: '0 0 50px rgba(212, 175, 55, 0.3)' }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Trophy className="h-10 w-10 text-[#D4AF37]" />
              </motion.div>
              <h2 className="text-2xl font-black text-white mb-4 tracking-wide">Classement</h2>

              {myRank && (
                <motion.div
                  className="bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] rounded-2xl p-6 mb-5 border-2 border-[#D4AF37]/40"
                  style={{ boxShadow: '0 0 30px rgba(212, 175, 55, 0.15)' }}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className="text-gray-400 text-sm mb-2">Votre position</p>
                  <p className="text-[#D4AF37] text-4xl font-black mb-2">#{myRank}</p>
                  <p className="text-white text-xl font-bold">{myScore} pts</p>
                </motion.div>
              )}

              <p className="text-gray-500">En attente de la prochaine question...</p>
              <motion.div
                className="mt-4 flex justify-center gap-1"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-[#D4AF37]"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* FINISHED - Écran spécial pour le gagnant */}
          {playerState === 'FINISHED' && myRank === 1 && (
            <motion.div
              key="finished-winner"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm text-center"
            >
              {/* Grande couronne animée */}
              <motion.div
                className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-b from-[#D4AF37]/40 to-[#B8860B]/20 border-4 border-[#D4AF37] flex items-center justify-center"
                style={{ boxShadow: '0 0 80px rgba(212, 175, 55, 0.5)' }}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Crown className="w-16 h-16 text-[#D4AF37]" />
                </motion.div>
              </motion.div>

              {/* TU AS GAGNÉ ! */}
              <motion.h2
                className="text-4xl font-black mb-2 tracking-wide"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37 0%, #F4D03F 50%, #D4AF37 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                TU AS GAGNÉ !
              </motion.h2>

              <motion.div
                className="flex items-center justify-center gap-2 mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                <span className="text-[#D4AF37] font-bold text-lg">1ère place</span>
                <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              </motion.div>

              {/* Score */}
              <motion.div
                className="bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] rounded-2xl p-6 border-2 border-[#D4AF37]"
                style={{ boxShadow: '0 0 50px rgba(212, 175, 55, 0.3)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-white text-3xl font-black">{myScore} points</p>
                <p className="text-[#D4AF37] text-sm mt-2">Champion du Quiz !</p>
              </motion.div>
            </motion.div>
          )}

          {/* FINISHED - Écran normal pour les autres */}
          {playerState === 'FINISHED' && myRank !== 1 && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm text-center"
            >
              <motion.div
                className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-b from-[#D4AF37]/30 to-[#B8860B]/10 border-2 border-[#D4AF37]/50 flex items-center justify-center"
                style={{ boxShadow: '0 0 60px rgba(212, 175, 55, 0.4)' }}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <Trophy className="w-12 h-12 text-[#D4AF37]" />
              </motion.div>
              <h2 className="text-3xl font-black text-white mb-6 tracking-wide">Quiz terminé !</h2>

              {myRank && (
                <motion.div
                  className="bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] rounded-2xl p-8 border-2 border-[#D4AF37]/50"
                  style={{ boxShadow: '0 0 40px rgba(212, 175, 55, 0.2)' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <p className="text-gray-400 mb-3 text-sm tracking-wide uppercase">Classement final</p>
                  <motion.p
                    className="text-5xl font-black mb-3"
                    style={{
                      background: 'linear-gradient(135deg, #D4AF37 0%, #F4D03F 50%, #D4AF37 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                    animate={myRank <= 3 ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    #{myRank}
                  </motion.p>
                  <p className="text-white text-2xl font-bold">{myScore} points</p>
                </motion.div>
              )}

              {myRank === 2 && (
                <motion.p
                  className="mt-4 text-[#C0C0C0] font-bold"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  Excellente 2ème place !
                </motion.p>
              )}

              {myRank === 3 && (
                <motion.p
                  className="mt-4 text-[#CD7F32] font-bold"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  Bravo, sur le podium !
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
