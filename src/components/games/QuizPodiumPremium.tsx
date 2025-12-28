'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, RotateCcw, ListOrdered } from 'lucide-react'

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

// LED Bar component - DJ style
function LEDBar({
  rank,
  maxScore,
  score,
  delay,
}: {
  rank: 1 | 2 | 3
  maxScore: number
  score: number
  delay: number
}) {
  const colors = {
    1: '#F5C97A', // Gold
    2: '#C0C0C0', // Silver
    3: '#CD7F32', // Bronze
  }

  const widths = {
    1: '100%',
    2: '75%',
    3: '55%',
  }

  return (
    <motion.div
      className="flex items-center gap-4"
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <span
        className="text-sm font-bold w-20 text-right"
        style={{ color: colors[rank] }}
      >
        {rank === 1 ? 'OR' : rank === 2 ? 'ARGENT' : 'BRONZE'}
      </span>
      <div className="flex-1 h-6 rounded-sm overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <motion.div
          className="h-full rounded-sm"
          style={{
            backgroundColor: colors[rank],
            boxShadow: `0 0 20px ${colors[rank]}40`,
          }}
          initial={{ width: 0 }}
          animate={{ width: widths[rank] }}
          transition={{ duration: 0.8, delay: delay + 0.2, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

// Podium card
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
      size: 'w-48 py-8',
      medal: '1er',
      medalColor: '#F5C97A',
      nameSize: 'text-xl',
      scoreSize: 'text-3xl',
    },
    2: {
      size: 'w-40 py-6',
      medal: '2e',
      medalColor: '#C0C0C0',
      nameSize: 'text-lg',
      scoreSize: 'text-2xl',
    },
    3: {
      size: 'w-40 py-6',
      medal: '3e',
      medalColor: '#CD7F32',
      nameSize: 'text-lg',
      scoreSize: 'text-2xl',
    },
  }

  const c = config[rank]

  return (
    <motion.div
      className={`${c.size} flex flex-col items-center justify-center rounded-xl border`}
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: `${c.medalColor}40`,
        boxShadow: `0 0 30px ${c.medalColor}15`,
      }}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      {/* Medal indicator */}
      <span
        className="text-sm font-black tracking-wider mb-2"
        style={{ color: c.medalColor }}
      >
        {c.medal}
      </span>

      {/* Name */}
      <h3
        className={`${c.nameSize} font-bold text-center px-4 mb-1 truncate max-w-full`}
        style={{ color: '#FFFFFF' }}
      >
        {winner.name}
      </h3>

      {/* Score */}
      <span
        className={`${c.scoreSize} font-black`}
        style={{ color: c.medalColor }}
      >
        {winner.score}
      </span>
    </motion.div>
  )
}

// Ranking row for full list
function RankingRow({ winner, index }: { winner: Winner; index: number }) {
  const colors = ['#F5C97A', '#C0C0C0', '#CD7F32']
  const color = index < 3 ? colors[index] : '#B5B8C5'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      className="flex items-center gap-4 py-3 px-4 rounded-lg border"
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.1)',
      }}
    >
      <span
        className="w-8 text-center font-bold"
        style={{ color }}
      >
        {index + 1}
      </span>
      <span className="flex-1 font-medium truncate" style={{ color: '#FFFFFF' }}>
        {winner.name}
      </span>
      <span className="font-bold" style={{ color: '#F5C97A' }}>
        {winner.score} pts
      </span>
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

  const top3 = winners.slice(0, 3)
  const hasEnoughPlayers = top3.length >= 1
  const maxScore = top3[0]?.score || 1

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#0B0F1A' }}
    >
      {/* Subtle glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[200px] opacity-15"
          style={{ background: '#F5C97A' }}
        />
        <div
          className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full blur-[150px] opacity-10"
          style={{ background: '#6D5DF6' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center max-w-4xl w-full px-8">

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4 mb-12"
        >
          <Trophy className="w-10 h-10" style={{ color: '#F5C97A' }} />
          <h1
            className="text-4xl md:text-5xl font-black tracking-tight"
            style={{ color: '#FFFFFF' }}
          >
            CLASSEMENT FINAL
          </h1>
        </motion.div>

        {/* Podium cards */}
        {hasEnoughPlayers && !showFullRanking && (
          <div className="flex items-end justify-center gap-6 mb-12">
            {/* 2nd place - left */}
            {top3[1] && (
              <PodiumCard winner={top3[1]} rank={2} delay={0.3} />
            )}

            {/* 1st place - center (larger) */}
            {top3[0] && (
              <PodiumCard winner={top3[0]} rank={1} delay={0.1} />
            )}

            {/* 3rd place - right */}
            {top3[2] && (
              <PodiumCard winner={top3[2]} rank={3} delay={0.5} />
            )}
          </div>
        )}

        {/* LED Bars - DJ style */}
        {hasEnoughPlayers && !showFullRanking && (
          <div className="w-full max-w-lg space-y-3 mb-12">
            {top3[0] && <LEDBar rank={1} maxScore={maxScore} score={top3[0].score} delay={0.6} />}
            {top3[1] && <LEDBar rank={2} maxScore={maxScore} score={top3[1].score} delay={0.7} />}
            {top3[2] && <LEDBar rank={3} maxScore={maxScore} score={top3[2].score} delay={0.8} />}
          </div>
        )}

        {/* Full ranking list */}
        {showFullRanking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-md mb-8 max-h-[400px] overflow-y-auto"
          >
            <div className="space-y-2">
              {allParticipants.map((p, i) => (
                <RankingRow key={i} winner={p} index={i} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="flex items-center gap-4"
        >
          {/* Full ranking toggle */}
          {allParticipants.length > 3 && (
            <button
              onClick={() => setShowFullRanking(!showFullRanking)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border transition-colors hover:bg-white/10"
              style={{
                borderColor: 'rgba(255,255,255,0.2)',
                color: '#FFFFFF',
              }}
            >
              <ListOrdered className="w-5 h-5" />
              {showFullRanking ? 'Voir le podium' : 'Classement complet'}
            </button>
          )}

          {/* Restart button */}
          {onRestart && (
            <button
              onClick={onRestart}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors"
              style={{
                backgroundColor: '#F5C97A',
                color: '#0B0F1A',
              }}
            >
              <RotateCcw className="w-5 h-5" />
              Relancer le jeu
            </button>
          )}

          {/* New game button */}
          {onNewGame && (
            <button
              onClick={onNewGame}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors"
              style={{
                backgroundColor: '#6D5DF6',
                color: '#FFFFFF',
              }}
            >
              Nouvelle partie
            </button>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
