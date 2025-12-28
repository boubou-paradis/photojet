'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Wifi, WifiOff, CheckCircle2, XCircle, Trophy, Clock } from 'lucide-react'

// Lib
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

export default function PlayQuizPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = params.sessionId as string
  const sessionCode = searchParams.get('code') || ''
  const playerId = searchParams.get('playerId') || ''
  const playerName = searchParams.get('name') || 'Joueur'

  // Connection state
  const [connected, setConnected] = useState(false)
  const [playerState, setPlayerState] = useState<PlayerState>('CONNECTING')

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

  // Connect and setup listeners
  useEffect(() => {
    const client = clientRef.current

    client.connect(sessionId, 'player').then(() => {
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
    })

    // Listen for host events
    const unsubscribe = client.onHostEvent((event: HostEventType) => {
      handleHostEvent(event)
    })

    return () => {
      unsubscribe()
      client.disconnect()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [sessionId, playerId, playerName, sessionCode])

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
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2a] to-[#0a1a2a] flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {connected ? (
            <Wifi className="h-5 w-5 text-green-400" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-400" />
          )}
          <span className="text-white font-semibold">{decodeURIComponent(playerName)}</span>
        </div>
        <div className="flex items-center gap-3">
          {latency > 0 && (
            <span className="text-gray-500 text-sm">{latency}ms</span>
          )}
          <div className="bg-[#D4AF37]/20 text-[#D4AF37] px-3 py-1 rounded-full text-sm font-bold">
            {myScore} pts
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
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
              className="w-full max-w-md"
            >
              {/* Timer */}
              <div className="mb-6">
                <TimerBar timeLeftMs={timeLeftMs} totalMs={totalTimeMs} />
              </div>

              {/* Question (if not hidden) */}
              {!currentQuestion.hideQuestion && (
                <div className="bg-[#1a1a2e]/80 rounded-xl p-4 mb-6 border border-white/10">
                  <p className="text-white text-lg font-semibold text-center">
                    {currentQuestion.question}
                  </p>
                </div>
              )}

              {/* Answer grid */}
              <KahootAnswerGridPlayer
                answers={currentQuestion.answers}
                disabled={!canAnswer || playerState === 'ANSWERED'}
                hideText={currentQuestion.hideQuestion}
                selectedAnswer={selectedAnswer}
                onSelect={handleAnswer}
              />

              {/* Answered confirmation */}
              {playerState === 'ANSWERED' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 text-center"
                >
                  <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">Réponse envoyée !</span>
                  </div>
                </motion.div>
              )}

              {/* Waiting to answer (anti-cheat) */}
              {playerState === 'ANSWERING' && !canAnswer && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 text-center"
                >
                  <div className="inline-flex items-center gap-2 text-gray-400">
                    <Clock className="h-5 w-5 animate-pulse" />
                    <span>Préparez-vous...</span>
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
