'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Crown, Medal, RotateCcw, ListOrdered } from 'lucide-react'

interface Winner {
  name: string
  score: number
  rank: number
}

interface QuizPodiumPremiumProps {
  winners: Winner[]
  allParticipants?: Winner[]
  onRestart?: () => void
  onNewGame?: () => void
}

// Confetti léger - une seule fois au reveal
function LightConfetti() {
  const [show, setShow] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  const pieces = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 1,
      color: ['#D4AF37', '#C0C0C0', '#CD7F32', '#FFFFFF'][Math.floor(Math.random() * 4)],
      size: 4 + Math.random() * 4,
    }))
  }, [])

  if (!show) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          className="absolute rounded-sm"
          style={{
            left: `${piece.x}%`,
            top: -10,
            width: piece.size,
            height: piece.size * 0.6,
            backgroundColor: piece.color,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{
            y: '100vh',
            opacity: [1, 1, 0],
            rotate: 360,
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  )
}

// Carte podium premium
function PodiumCard({
  winner,
  rank,
  delay,
}: {
  winner: Winner
  rank: 1 | 2 | 3
  delay: number
}) {
  const config = {
    1: {
      gradient: 'from-[#D4AF37] via-[#F4D03F] to-[#B8860B]',
      glow: 'shadow-[0_0_60px_rgba(212,175,55,0.4)]',
      border: 'border-[#D4AF37]',
      size: 'h-72 w-64',
      iconSize: 'w-16 h-16',
      nameSize: 'text-2xl',
      scoreSize: 'text-4xl',
      label: '1ER',
      icon: Crown,
    },
    2: {
      gradient: 'from-[#C0C0C0] via-[#E8E8E8] to-[#A0A0A0]',
      glow: 'shadow-[0_0_40px_rgba(192,192,192,0.3)]',
      border: 'border-[#C0C0C0]',
      size: 'h-60 w-56',
      iconSize: 'w-12 h-12',
      nameSize: 'text-xl',
      scoreSize: 'text-3xl',
      label: '2ÈME',
      icon: Medal,
    },
    3: {
      gradient: 'from-[#CD7F32] via-[#E6A55A] to-[#8B4513]',
      glow: 'shadow-[0_0_40px_rgba(205,127,50,0.3)]',
      border: 'border-[#CD7F32]',
      size: 'h-52 w-52',
      iconSize: 'w-10 h-10',
      nameSize: 'text-lg',
      scoreSize: 'text-2xl',
      label: '3ÈME',
      icon: Medal,
    },
  }

  const c = config[rank]
  const Icon = c.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: 'easeOut' }}
      className={`relative flex flex-col items-center justify-center ${c.size} rounded-2xl bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] border-2 ${c.border} ${c.glow}`}
    >
      {/* Badge rang */}
      <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r ${c.gradient}`}>
        <span className="text-black font-black text-sm tracking-wider">{c.label}</span>
      </div>

      {/* Icône */}
      <div className={`mb-4 ${c.iconSize}`}>
        <Icon className={`w-full h-full ${rank === 1 ? 'text-[#D4AF37]' : rank === 2 ? 'text-[#C0C0C0]' : 'text-[#CD7F32]'}`} />
      </div>

      {/* Nom du joueur */}
      <h3 className={`${c.nameSize} font-bold text-white text-center px-4 mb-2 truncate max-w-full`}>
        {winner.name}
      </h3>

      {/* Score */}
      <div className={`${c.scoreSize} font-black bg-gradient-to-r ${c.gradient} bg-clip-text text-transparent`}>
        {winner.score}
      </div>
      <span className="text-gray-400 text-sm font-medium">points</span>
    </motion.div>
  )
}

// Ligne classement complet
function RankingRow({ winner, index }: { winner: Winner; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * index }}
      className="flex items-center gap-4 py-3 px-4 bg-white/5 rounded-lg border border-white/10"
    >
      <span className={`w-8 text-center font-bold ${
        index === 0 ? 'text-[#D4AF37]' : index === 1 ? 'text-[#C0C0C0]' : index === 2 ? 'text-[#CD7F32]' : 'text-gray-500'
      }`}>
        {index + 1}
      </span>
      <span className="flex-1 text-white font-medium truncate">{winner.name}</span>
      <span className="text-[#D4AF37] font-bold">{winner.score} pts</span>
    </motion.div>
  )
}

export default function QuizPodiumPremium({
  winners,
  allParticipants = [],
  onRestart,
  onNewGame,
}: QuizPodiumPremiumProps) {
  const [showFullRanking, setShowFullRanking] = useState(false)

  // S'assurer qu'on a 3 gagnants max
  const top3 = winners.slice(0, 3)
  const hasEnoughPlayers = top3.length >= 1

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#0a0a1a] via-[#12121f] to-[#0a0a1a] overflow-hidden"
    >
      {/* Confetti léger au reveal */}
      <LightConfetti />

      {/* Glow ambiant */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl bg-[#D4AF37]" />

      {/* Contenu principal */}
      <div className="relative z-10 flex flex-col items-center max-w-5xl w-full px-4">
        {/* Titre */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-4 mb-2">
            <Trophy className="w-10 h-10 text-[#D4AF37]" />
            <h1 className="text-4xl md:text-5xl font-black text-white">
              Classement final
            </h1>
            <Trophy className="w-10 h-10 text-[#D4AF37]" />
          </div>
          <p className="text-gray-400 text-lg">Félicitations aux gagnants !</p>
        </motion.div>

        {/* Podium */}
        {hasEnoughPlayers && !showFullRanking && (
          <div className="flex items-end justify-center gap-4 md:gap-8 mb-12">
            {/* 2ème place */}
            {top3[1] && (
              <PodiumCard winner={top3[1]} rank={2} delay={0.5} />
            )}

            {/* 1ère place */}
            {top3[0] && (
              <PodiumCard winner={top3[0]} rank={1} delay={0.3} />
            )}

            {/* 3ème place */}
            {top3[2] && (
              <PodiumCard winner={top3[2]} rank={3} delay={0.7} />
            )}
          </div>
        )}

        {/* Classement complet */}
        <AnimatePresence>
          {showFullRanking && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full max-w-md mb-8 max-h-[400px] overflow-y-auto"
            >
              <div className="space-y-2">
                {allParticipants.map((p, i) => (
                  <RankingRow key={i} winner={p} index={i} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Boutons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          {/* Afficher classement complet */}
          {allParticipants.length > 3 && (
            <button
              onClick={() => setShowFullRanking(!showFullRanking)}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors"
            >
              <ListOrdered className="w-5 h-5" />
              {showFullRanking ? 'Voir le podium' : 'Classement complet'}
            </button>
          )}

          {/* Relancer le jeu */}
          {onRestart && (
            <button
              onClick={onRestart}
              className="flex items-center gap-2 px-6 py-3 bg-[#D4AF37] hover:bg-[#F4D03F] text-black font-bold rounded-xl transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              Relancer le jeu
            </button>
          )}

          {/* Nouvelle partie */}
          {onNewGame && (
            <button
              onClick={onNewGame}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold rounded-xl transition-colors"
            >
              Nouvelle partie
            </button>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
