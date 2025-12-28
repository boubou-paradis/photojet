'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize, Minimize, Trophy, Users, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { QuizQuestion, QuizParticipant } from '@/types/database'
import QuizPodium from './QuizPodium'

interface QuizGameProps {
  questions: QuizQuestion[]
  currentQuestionIndex: number
  isAnswering: boolean
  showResults: boolean
  timeLeft: number | null
  participants: QuizParticipant[]
  answerStats: number[]
  isFinished?: boolean
  onClosePodium?: () => void
}

// Couleurs pour les réponses (style Kahoot)
const ANSWER_COLORS = [
  { bg: 'from-red-600 to-red-700', border: 'border-red-500', text: 'text-white', icon: '▲' },
  { bg: 'from-blue-600 to-blue-700', border: 'border-blue-500', text: 'text-white', icon: '◆' },
  { bg: 'from-yellow-500 to-yellow-600', border: 'border-yellow-400', text: 'text-black', icon: '●' },
  { bg: 'from-green-600 to-green-700', border: 'border-green-500', text: 'text-white', icon: '■' },
]

// Particules flottantes
function FloatingParticle({ delay, duration, x, size, windowHeight }: { delay: number; duration: number; x: number; size: number; windowHeight: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-[#D4AF37]"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        bottom: '-20px',
      }}
      initial={{ y: 0, opacity: 0 }}
      animate={{
        y: [0, -(windowHeight || 800) - 100],
        opacity: [0, 0.4, 0.4, 0],
        x: [0, Math.sin(x) * 20, -Math.sin(x) * 15, Math.sin(x) * 10],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  )
}

// Particules pré-générées
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  delay: Math.random() * 5,
  duration: 10 + Math.random() * 8,
  x: Math.random() * 100,
  size: 3 + Math.random() * 6,
}))

export default function QuizGame({
  questions,
  currentQuestionIndex,
  isAnswering,
  showResults,
  timeLeft,
  participants,
  answerStats,
  isFinished = false,
  onClosePodium,
}: QuizGameProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [windowHeight, setWindowHeight] = useState(800)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const currentQuestion = questions[currentQuestionIndex]
  const totalAnswers = answerStats.reduce((a, b) => a + b, 0)
  const sortedParticipants = [...participants].sort((a, b) => b.totalScore - a.totalScore).slice(0, 10)

  // Prepare winners for podium
  const podiumWinners = sortedParticipants.slice(0, 3).map((p, i) => ({
    name: p.odientName,
    score: p.totalScore,
    rank: i + 1,
  }))

  // Fullscreen toggle
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

  useEffect(() => {
    setWindowHeight(window.innerHeight)
    const handleResize = () => setWindowHeight(window.innerHeight)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Afficher le leaderboard quand on révèle les résultats
  useEffect(() => {
    if (showResults && participants.length > 0) {
      const timer = setTimeout(() => setShowLeaderboard(true), 2000)
      return () => clearTimeout(timer)
    } else {
      setShowLeaderboard(false)
    }
  }, [showResults, participants.length])

  // Écran d'attente si pas de question
  if (!currentQuestion) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2a] to-[#0a1a2a] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            className="text-8xl mb-6"
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ❓
          </motion.div>
          <h1
            className="text-5xl font-black text-white mb-4"
            style={{ textShadow: '0 0 30px rgba(212, 175, 55, 0.5)' }}
          >
            QUIZ
          </h1>
          <p className="text-xl text-gray-400">En attente de la prochaine question...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Bouton plein écran */}
      <motion.button
        onClick={toggleFullscreen}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.3 }}
        className="absolute top-4 right-4 z-50 p-3 bg-black/50 hover:bg-black/70 border border-[#D4AF37]/30 rounded-full transition-colors backdrop-blur-sm"
        title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
      >
        {isFullscreen ? (
          <Minimize className="h-6 w-6 text-[#D4AF37]" />
        ) : (
          <Maximize className="h-6 w-6 text-[#D4AF37]" />
        )}
      </motion.button>

      {/* FOND ANIMÉ */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2a] to-[#0a1a2a]">
        {/* Particules flottantes */}
        {PARTICLES.map((particle) => (
          <FloatingParticle key={particle.id} {...particle} windowHeight={windowHeight} />
        ))}

        {/* Halo central */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* CONTENU PRINCIPAL */}
      <div className="relative z-10 h-full flex flex-col p-6">
        {/* HEADER - Numéro question + Timer */}
        <div className="flex items-center justify-between mb-6">
          {/* Numéro de question */}
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="bg-[#D4AF37] text-black font-black text-xl px-4 py-2 rounded-xl">
              {currentQuestionIndex + 1}/{questions.length}
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl">
              <Users className="h-5 w-5 text-[#D4AF37]" />
              <span className="text-white font-bold">{participants.length}</span>
            </div>
          </motion.div>

          {/* Timer */}
          {timeLeft !== null && (
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="relative"
            >
              <div
                className={`flex items-center gap-3 px-6 py-3 rounded-2xl ${
                  timeLeft <= 5
                    ? 'bg-red-500/30 border-2 border-red-500'
                    : timeLeft <= 10
                    ? 'bg-yellow-500/30 border-2 border-yellow-500'
                    : 'bg-white/10 border-2 border-[#D4AF37]'
                }`}
              >
                <Clock className={`h-6 w-6 ${
                  timeLeft <= 5 ? 'text-red-500' : timeLeft <= 10 ? 'text-yellow-500' : 'text-[#D4AF37]'
                }`} />
                <motion.span
                  className={`text-4xl font-black font-mono ${
                    timeLeft <= 5 ? 'text-red-500' : timeLeft <= 10 ? 'text-yellow-400' : 'text-white'
                  }`}
                  animate={timeLeft <= 5 ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  style={{ textShadow: timeLeft <= 5 ? '0 0 20px rgba(239, 68, 68, 0.8)' : 'none' }}
                >
                  {timeLeft}
                </motion.span>
              </div>
            </motion.div>
          )}
        </div>

        {/* QUESTION ET RÉPONSES - Affichées seulement quand la question est lancée */}
        {(isAnswering || showResults) ? (
          <>
            {/* QUESTION */}
            <motion.div
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex-shrink-0 mb-8"
            >
              <div
                className="bg-gradient-to-b from-[#242428] to-[#1a1a1e] rounded-3xl p-8 border-2 border-[#D4AF37]/30"
                style={{
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(212, 175, 55, 0.1)',
                }}
              >
                <h2
                  className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center leading-tight"
                  style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
                >
                  {currentQuestion.question}
                </h2>
              </div>
            </motion.div>

            {/* RÉPONSES */}
          <div className="flex-1 grid grid-cols-2 gap-4 mb-6">
            {currentQuestion.answers.map((answer, index) => {
              const color = ANSWER_COLORS[index]
              const isCorrect = index === currentQuestion.correctAnswer
              const percentage = totalAnswers > 0 ? (answerStats[index] / totalAnswers * 100) : 0

              return (
                <motion.div
                  key={index}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="relative"
                >
                  <div
                    className={`relative h-full min-h-[120px] rounded-2xl overflow-hidden transition-all duration-300 ${
                      showResults
                        ? isCorrect
                          ? 'ring-4 ring-green-400 ring-offset-4 ring-offset-[#0a0a1a]'
                          : 'opacity-60'
                        : ''
                    }`}
                  >
                    {/* Fond avec gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${color.bg}`} />

                    {/* Barre de progression (quand résultats affichés) */}
                    {showResults && (
                      <motion.div
                        className="absolute inset-0 bg-black/40"
                        initial={{ width: '100%' }}
                        animate={{ width: `${100 - percentage}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        style={{ right: 0, left: 'auto' }}
                      />
                    )}

                    {/* Contenu */}
                    <div className="relative h-full flex items-center justify-between p-6">
                      {/* Icône de forme */}
                      <span className={`text-4xl ${color.text} opacity-50`}>
                        {color.icon}
                      </span>

                      {/* Texte de la réponse */}
                      <span className={`flex-1 text-xl md:text-2xl lg:text-3xl font-bold ${color.text} text-center px-4`}>
                        {answer}
                      </span>

                      {/* Indicateur correct/incorrect ou stats */}
                      {showResults ? (
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl font-bold ${color.text}`}>
                            {answerStats[index]}
                          </span>
                          {isCorrect ? (
                            <CheckCircle2 className="h-8 w-8 text-green-300" />
                          ) : answerStats[index] > 0 ? (
                            <XCircle className="h-8 w-8 text-red-300 opacity-70" />
                          ) : null}
                        </div>
                      ) : (
                        <span className={`text-4xl ${color.text} opacity-50`}>
                          {color.icon}
                        </span>
                      )}
                    </div>

                    {/* Badge "Bonne réponse" */}
                    {showResults && isCorrect && (
                      <motion.div
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 1, type: 'spring', stiffness: 200 }}
                        className="absolute -top-2 -right-2 bg-green-500 text-white font-bold px-3 py-1 rounded-full text-sm shadow-lg"
                      >
                        ✓ Bonne réponse
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
          </>
        ) : (
          /* Écran d'attente avant lancement de la question */
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                className="text-8xl mb-6"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                🎯
              </motion.div>
              <p className="text-3xl text-[#D4AF37] font-bold">Préparez-vous !</p>
              <p className="text-xl text-gray-400 mt-2">La question va bientôt commencer...</p>
            </motion.div>
          </div>
        )}

        {/* POINTS - Affichés seulement quand la question est lancée */}
        {(isAnswering || showResults) && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex justify-center"
          >
            <div className="bg-[#D4AF37]/20 border border-[#D4AF37] rounded-full px-6 py-2">
              <span className="text-[#D4AF37] font-bold text-lg">
                {currentQuestion.points} points
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* LEADERBOARD OVERLAY */}
      <AnimatePresence>
        {showLeaderboard && sortedParticipants.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              className="bg-gradient-to-b from-[#242428] to-[#1a1a1e] rounded-3xl p-8 max-w-lg w-full mx-4 border-2 border-[#D4AF37]"
              style={{ boxShadow: '0 0 60px rgba(212, 175, 55, 0.3)' }}
            >
              <div className="flex items-center justify-center gap-3 mb-6">
                <Trophy className="h-8 w-8 text-[#D4AF37]" />
                <h3 className="text-2xl font-bold text-white">Classement</h3>
              </div>

              <div className="space-y-3">
                {sortedParticipants.map((p, index) => (
                  <motion.div
                    key={p.odientId}
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-center gap-4 p-4 rounded-xl ${
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500'
                        : index === 1
                        ? 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border border-gray-400'
                        : index === 2
                        ? 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border border-amber-600'
                        : 'bg-white/5'
                    }`}
                  >
                    <span className={`text-2xl font-black w-8 text-center ${
                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-500' : 'text-gray-500'
                    }`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                    </span>
                    <span className="flex-1 text-white font-semibold truncate">
                      {p.odientName}
                    </span>
                    <span className="text-[#D4AF37] font-bold text-xl">
                      {p.totalScore} pts
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INDICATEUR EN COURS */}
      {isAnswering && (
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-4 left-4 z-30"
        >
          <div className="flex items-center gap-2 bg-green-500/20 border border-green-500 rounded-full px-4 py-2 backdrop-blur-sm">
            <motion.div
              className="w-3 h-3 bg-green-500 rounded-full"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-green-400 font-bold uppercase tracking-wider">
              Répondez !
            </span>
          </div>
        </motion.div>
      )}

      {/* PODIUM - Affiché à la fin du quiz */}
      <AnimatePresence>
        {isFinished && podiumWinners.length > 0 && (
          <QuizPodium winners={podiumWinners} onClose={onClosePodium} />
        )}
      </AnimatePresence>
    </div>
  )
}
