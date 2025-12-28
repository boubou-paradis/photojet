'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize, Minimize, Trophy, Users } from 'lucide-react'
import QRCode from 'react-qr-code'

// Lib
import { getLocalClient } from '@/lib/realtime'
import {
  QuizState,
  AnswerStats,
  LeaderboardEntry,
  PlayerEventType,
  HostEventType,
} from '@/lib/realtime/types'
import { QuizEngine } from '@/lib/quiz/quizEngine'
import { getDemoQuestions } from '@/lib/quiz/demoQuestions'
import { SuspectEntry } from '@/lib/quiz/antiCheat'

// Components
import QuestionCard from '@/components/quiz/QuestionCard'
import KahootAnswerGridHost from '@/components/quiz/KahootAnswerGridHost'
import TimerBar from '@/components/quiz/TimerBar'
import QRJoinBanner from '@/components/quiz/QRJoinBanner'
import HostFooterBar from '@/components/quiz/HostFooterBar'
import AntiCheatPanel from '@/components/quiz/AntiCheatPanel'
import { useClientOrigin, getJoinUrl } from '@/components/quiz/useClientOrigin'

export default function HostQuizPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = params.sessionId as string
  const sessionCode = searchParams.get('code') || sessionId.slice(-4)
  const isDemo = searchParams.get('demo') === 'true'

  const origin = useClientOrigin()
  const joinUrl = getJoinUrl(origin, sessionCode)

  // Engine ref
  const engineRef = useRef<QuizEngine | null>(null)

  // State
  const [quizState, setQuizState] = useState<QuizState>('LOBBY')
  const [questionIndex, setQuestionIndex] = useState(-1)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState<{
    question: string
    answers: { A: string; B: string; C: string; D: string }
    points: number
  } | null>(null)
  const [timeLeftMs, setTimeLeftMs] = useState(0)
  const [totalTimeMs, setTotalTimeMs] = useState(20000)
  const [stats, setStats] = useState<AnswerStats>({ A: 0, B: 0, C: 0, D: 0, total: 0 })
  const [correctKey, setCorrectKey] = useState<'A' | 'B' | 'C' | 'D' | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [playerCount, setPlayerCount] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  // Settings
  const [isAntiCheatEnabled, setIsAntiCheatEnabled] = useState(true)
  const [isHideQuestionEnabled, setIsHideQuestionEnabled] = useState(false)
  const [suspects, setSuspects] = useState<SuspectEntry[]>([])
  const [suspectCount, setSuspectCount] = useState(0)

  // UI
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  // Initialize engine and realtime
  useEffect(() => {
    const client = getLocalClient()
    const questions = getDemoQuestions(10)
    setTotalQuestions(questions.length)

    // Create engine with callbacks
    const engine = new QuizEngine(
      sessionId,
      sessionCode,
      questions,
      {
        onBroadcast: (event: HostEventType) => {
          client.broadcast(event)
        },
        onStateChange: (state: QuizState) => {
          setQuizState(state)
          if (state === 'RUNNING') {
            setShowResult(false)
            setCorrectKey(null)
          }
          if (state === 'LEADERBOARD') {
            setShowLeaderboard(true)
          }
        },
        onTimerTick: (timeLeft: number) => {
          setTimeLeftMs(timeLeft)
        },
        onQuestionEnd: (endStats: AnswerStats, correct: string) => {
          setStats(endStats)
          setCorrectKey(correct as 'A' | 'B' | 'C' | 'D')
          setShowResult(true)
        },
        onPlayerJoin: () => {
          setPlayerCount(engine.getPlayerCount())
        },
        onPlayerLeave: () => {
          setPlayerCount(engine.getPlayerCount())
        },
        onAnswerReceived: () => {
          setStats(engine.getCurrentStats())
        },
        onSuspectDetected: () => {
          setSuspects(engine.getSuspects())
          setSuspectCount(engine.getSuspectCount())
        },
      },
      { antiCheatEnabled: isAntiCheatEnabled, hideQuestionOnMobile: isHideQuestionEnabled },
      { enabled: isAntiCheatEnabled }
    )

    engineRef.current = engine

    // Connect to realtime
    client.connect(sessionId, 'host').then(() => {
      // Listen for player events
      client.onPlayerEvent((event: PlayerEventType) => {
        engine.handlePlayerEvent(event)
      })
    })

    // Sync ping interval
    const syncInterval = setInterval(() => {
      engine.broadcastSyncPing()
    }, 5000)

    return () => {
      clearInterval(syncInterval)
      engine.destroy()
      client.disconnect()
    }
  }, [sessionId, sessionCode])

  // Update engine settings when changed
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setAntiCheatEnabled(isAntiCheatEnabled)
    }
  }, [isAntiCheatEnabled])

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setHideQuestionOnMobile(isHideQuestionEnabled)
    }
  }, [isHideQuestionEnabled])

  // Update current question display
  useEffect(() => {
    if (engineRef.current) {
      const q = engineRef.current.getCurrentQuestion()
      if (q) {
        setCurrentQuestion({
          question: q.question,
          answers: q.answers,
          points: q.points,
        })
        setTotalTimeMs(q.durationMs)
        setTimeLeftMs(q.durationMs)
      }
      setQuestionIndex(engineRef.current.getCurrentQuestionIndex())
      setLeaderboard(engineRef.current.getLeaderboard())
    }
  }, [quizState, questionIndex])

  // Handlers
  const handleStart = useCallback(() => {
    engineRef.current?.startQuiz()
  }, [])

  const handleNext = useCallback(() => {
    setShowLeaderboard(false)
    engineRef.current?.nextQuestion()
  }, [])

  const handleShowLeaderboard = useCallback(() => {
    setShowLeaderboard(true)
    engineRef.current?.showLeaderboard()
  }, [])

  const handleFinish = useCallback(() => {
    // Show final leaderboard
    setShowLeaderboard(true)
  }, [])

  const handleReset = useCallback(() => {
    engineRef.current?.reset()
    setShowLeaderboard(false)
    setShowResult(false)
    setCorrectKey(null)
    setStats({ A: 0, B: 0, C: 0, D: 0, total: 0 })
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2a] to-[#0a1a2a] flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4AF37]/5 rounded-full blur-3xl" />
      </div>

      {/* Fullscreen button */}
      <motion.button
        onClick={toggleFullscreen}
        className="fixed top-4 right-4 z-50 p-3 bg-black/50 hover:bg-black/70 border border-white/10 rounded-full transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {isFullscreen ? (
          <Minimize className="h-6 w-6 text-white" />
        ) : (
          <Maximize className="h-6 w-6 text-white" />
        )}
      </motion.button>

      {/* Anti-cheat panel */}
      <div className="fixed top-4 left-4 z-50">
        <AntiCheatPanel
          enabled={isAntiCheatEnabled}
          suspectCount={suspectCount}
          suspects={suspects}
          debug={isDemo}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {/* LOBBY STATE */}
        <AnimatePresence mode="wait">
          {quizState === 'LOBBY' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl"
            >
              {/* Title */}
              <div className="text-center mb-8">
                <motion.div
                  className="text-6xl mb-4 inline-block"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🎯
                </motion.div>
                <h1 className="text-5xl font-black text-white">
                  Quiz <span className="text-[#D4AF37]">Live</span>
                </h1>
              </div>

              {/* Main content: QR Code + Instructions */}
              <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16">
                {/* QR Code Section */}
                <motion.div
                  className="bg-white p-6 rounded-3xl shadow-2xl shadow-[#D4AF37]/20"
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                >
                  {joinUrl && (
                    <QRCode
                      value={joinUrl}
                      size={280}
                      level="M"
                      bgColor="white"
                      fgColor="#1a1a2e"
                    />
                  )}
                </motion.div>

                {/* Instructions Section */}
                <motion.div
                  className="text-center lg:text-left space-y-6"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {/* Step 1 */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37] text-[#1a1a2e] flex items-center justify-center font-black text-xl">
                      1
                    </div>
                    <p className="text-white text-xl">Scannez le QR code</p>
                  </div>

                  {/* Or */}
                  <div className="flex items-center gap-4 pl-4">
                    <div className="text-gray-500 text-lg">ou</div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37] text-[#1a1a2e] flex items-center justify-center font-black text-xl">
                      2
                    </div>
                    <div>
                      <p className="text-white text-xl">Allez sur</p>
                      <p className="text-[#D4AF37] text-lg font-mono">
                        {joinUrl.replace(/^https?:\/\//, '')}
                      </p>
                    </div>
                  </div>

                  {/* PIN Code */}
                  <motion.div
                    className="bg-[#1a1a2e]/80 backdrop-blur-xl rounded-2xl p-6 border-2 border-[#D4AF37]/50 mt-8"
                    animate={{
                      borderColor: ['rgba(212, 175, 55, 0.5)', 'rgba(212, 175, 55, 1)', 'rgba(212, 175, 55, 0.5)'],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Code PIN</p>
                    <p className="text-5xl font-black text-white tracking-[0.3em]">{sessionCode}</p>
                  </motion.div>
                </motion.div>
              </div>

              {/* Player Counter */}
              <motion.div
                className="mt-12 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <div className="inline-flex items-center gap-4 bg-[#1a1a2e]/60 backdrop-blur-xl rounded-full px-8 py-4 border border-white/10">
                  <Users className="h-8 w-8 text-[#D4AF37]" />
                  <div className="flex items-baseline gap-2">
                    <motion.span
                      key={playerCount}
                      className="text-5xl font-black text-white"
                      initial={{ scale: 1.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      {playerCount}
                    </motion.span>
                    <span className="text-xl text-gray-400">
                      joueur{playerCount !== 1 ? 's' : ''} connecté{playerCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Player dots animation */}
                {playerCount > 0 && (
                  <div className="flex justify-center gap-2 mt-6">
                    {[...Array(Math.min(playerCount, 20))].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-3 h-3 rounded-full bg-[#D4AF37]"
                        initial={{ scale: 0, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ delay: i * 0.05, type: 'spring', stiffness: 500 }}
                      />
                    ))}
                    {playerCount > 20 && (
                      <span className="text-[#D4AF37] font-bold ml-2">+{playerCount - 20}</span>
                    )}
                  </div>
                )}

                {playerCount === 0 && (
                  <motion.p
                    className="text-gray-500 mt-4"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    En attente des joueurs...
                  </motion.p>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* RUNNING STATE */}
          {(quizState === 'RUNNING' || quizState === 'ANSWER_REVEAL') && currentQuestion && !showLeaderboard && (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-5xl space-y-6"
            >
              {/* Timer */}
              {quizState === 'RUNNING' && (
                <TimerBar timeLeftMs={timeLeftMs} totalMs={totalTimeMs} />
              )}

              {/* Question */}
              <QuestionCard
                questionNumber={questionIndex + 1}
                totalQuestions={totalQuestions}
                questionText={currentQuestion.question}
                points={currentQuestion.points}
              />

              {/* Answers */}
              <KahootAnswerGridHost
                answers={currentQuestion.answers}
                stats={stats}
                correctKey={correctKey || undefined}
                showResult={showResult}
              />
            </motion.div>
          )}

          {/* LEADERBOARD STATE */}
          {(showLeaderboard || quizState === 'LEADERBOARD' || quizState === 'FINISHED') && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl"
            >
              <div className="text-center mb-8">
                <Trophy className="h-16 w-16 text-[#D4AF37] mx-auto mb-4" />
                <h2 className="text-4xl font-black text-white">
                  {quizState === 'FINISHED' ? 'Résultats finaux' : 'Classement'}
                </h2>
              </div>

              <div className="space-y-3">
                {leaderboard.slice(0, 10).map((entry, index) => (
                  <motion.div
                    key={entry.playerId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-center gap-4 p-4 rounded-xl ${
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500'
                        : index === 1
                        ? 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border border-gray-400'
                        : index === 2
                        ? 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border border-amber-600'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <span
                      className={`text-3xl font-black w-12 text-center ${
                        index === 0
                          ? 'text-yellow-400'
                          : index === 1
                          ? 'text-gray-300'
                          : index === 2
                          ? 'text-amber-500'
                          : 'text-gray-500'
                      }`}
                    >
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : entry.rank}
                    </span>
                    <span className="flex-1 text-white font-semibold text-lg truncate">
                      {entry.playerName}
                    </span>
                    <span className="text-[#D4AF37] font-bold text-2xl">{entry.score}</span>
                  </motion.div>
                ))}

                {leaderboard.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Aucun joueur n&apos;a encore répondu</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* QR Join Banner (bottom) - hidden in LOBBY since we have a big QR code */}
      {origin && quizState !== 'LOBBY' && (
        <QRJoinBanner joinUrl={joinUrl} sessionCode={sessionCode} playerCount={playerCount} />
      )}

      {/* Host controls */}
      <HostFooterBar
        quizState={quizState}
        questionIndex={questionIndex}
        totalQuestions={totalQuestions}
        playerCount={playerCount}
        onStart={handleStart}
        onNext={handleNext}
        onShowLeaderboard={handleShowLeaderboard}
        onFinish={handleFinish}
        onReset={handleReset}
        isAntiCheatEnabled={isAntiCheatEnabled}
        onToggleAntiCheat={setIsAntiCheatEnabled}
        isHideQuestionEnabled={isHideQuestionEnabled}
        onToggleHideQuestion={setIsHideQuestionEnabled}
      />
    </div>
  )
}
