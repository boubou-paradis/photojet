'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Wifi, WifiOff, CheckCircle2, XCircle, Trophy, Clock } from 'lucide-react'

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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [myScore, setMyScore] = useState(0)

  // Anti-cheat
  const [antiCheatEnabled, setAntiCheatEnabled] = useState(false)
  const [canAnswer, setCanAnswer] = useState(false)

  // Refs
  const clientRef = useRef(getLocalClient())
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Subscribe to Supabase quiz channel
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
      .subscribe((status) => {
        console.log('Supabase channel status:', status)
        if (status === 'SUBSCRIBED') {
          setConnected(true)
          setPlayerState('WAITING')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionCode, supabase])

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
    (key: 'A' | 'B' | 'C' | 'D') => {
      if (!canAnswer || selectedAnswer !== null || !currentQuestion) return

      const clientSentAt = Date.now()
      const estimatedHostAt = getEstimatedHostTime(clientSentAt, offsetMs)

      setSelectedAnswer(key)
      setPlayerState('ANSWERED')

      // Send answer
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
    [canAnswer, selectedAnswer, currentQuestion, playerId, offsetMs]
  )

  // Render based on state
  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-b from-[#0a0a1a] via-[#1a0a2e] to-[#0f0a20] flex flex-col overflow-hidden">
      {/* Mobile background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[50%] bg-purple-600/15 rounded-full blur-[80px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[40%] bg-blue-600/10 rounded-full blur-[60px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_50%,_rgba(0,0,0,0.3)_100%)]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 py-3 flex items-center justify-between bg-black/20 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-2.5">
          {connected ? (
            <div className="relative">
              <Wifi className="h-5 w-5 text-green-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
          ) : (
            <WifiOff className="h-5 w-5 text-red-400 animate-pulse" />
          )}
          <span className="text-white font-bold text-lg">{decodeURIComponent(playerName)}</span>
        </div>
        <div className="flex items-center gap-3">
          {latency > 0 && (
            <span className="text-gray-500 text-xs font-mono">{latency}ms</span>
          )}
          <motion.div
            key={myScore}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="bg-gradient-to-r from-[#D4AF37]/30 to-[#F4D03F]/20 text-[#D4AF37] px-4 py-1.5 rounded-full text-sm font-black border border-[#D4AF37]/30 shadow-lg shadow-[#D4AF37]/10"
          >
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
              <Loader2 className="h-12 w-12 text-[#D4AF37] animate-spin mx-auto mb-4" />
              <p className="text-white text-lg">Connexion...</p>
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
                className="text-6xl mb-4"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                ✋
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">Prêt !</h2>
              <p className="text-gray-400">En attente de la prochaine question...</p>
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
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="text-center mb-6"
              >
                {lastAnswerCorrect === true ? (
                  <div className="inline-flex flex-col items-center">
                    <div className="text-6xl mb-2">🎉</div>
                    <div className="text-2xl font-bold text-green-400">Correct !</div>
                    <div className="text-[#D4AF37]">+{currentQuestion.points} pts</div>
                  </div>
                ) : lastAnswerCorrect === false ? (
                  <div className="inline-flex flex-col items-center">
                    <div className="text-6xl mb-2">😢</div>
                    <div className="text-2xl font-bold text-red-400">Raté !</div>
                  </div>
                ) : (
                  <div className="inline-flex flex-col items-center">
                    <div className="text-6xl mb-2">⏰</div>
                    <div className="text-2xl font-bold text-gray-400">Temps écoulé</div>
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
              <Trophy className="h-12 w-12 text-[#D4AF37] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Classement</h2>

              {myRank && (
                <div className="bg-[#D4AF37]/20 rounded-xl p-4 mb-4 border border-[#D4AF37]/50">
                  <p className="text-[#D4AF37] text-lg">
                    Vous êtes <span className="font-bold text-2xl">#{myRank}</span>
                  </p>
                  <p className="text-white text-2xl font-bold">{myScore} pts</p>
                </div>
              )}

              <p className="text-gray-400">En attente de la prochaine question...</p>
            </motion.div>
          )}

          {/* FINISHED */}
          {playerState === 'FINISHED' && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm text-center"
            >
              <motion.div
                className="text-6xl mb-4"
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                🏆
              </motion.div>
              <h2 className="text-3xl font-bold text-white mb-4">Quiz terminé !</h2>

              {myRank && (
                <div className="bg-gradient-to-r from-[#D4AF37]/20 to-[#F4D03F]/20 rounded-xl p-6 border border-[#D4AF37]/50">
                  <p className="text-gray-400 mb-2">Votre classement final</p>
                  <p className="text-[#D4AF37] text-4xl font-black mb-2">#{myRank}</p>
                  <p className="text-white text-2xl font-bold">{myScore} points</p>
                </div>
              )}

              {myRank === 1 && (
                <motion.p
                  className="text-2xl mt-4"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  🥇 Champion ! 🥇
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
