'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Crown, Medal, Star } from 'lucide-react'

interface Winner {
  name: string
  score: number
  rank: number
}

interface QuizPodiumProps {
  winners: Winner[]
  onClose?: () => void
}

// Couleurs des personnages
const AVATAR_COLORS = [
  { body: '#FFD700', skin: '#FDBF60', hair: '#8B4513' }, // Or - 1er
  { body: '#C0C0C0', skin: '#FDBF60', hair: '#2C1810' }, // Argent - 2ème
  { body: '#CD7F32', skin: '#FDBF60', hair: '#1a1a1a' }, // Bronze - 3ème
]

// Personnage dansant style Mii/Playmobil
function DancingAvatar({ color, delay, intensity = 1 }: { color: typeof AVATAR_COLORS[0], delay: number, intensity?: number }) {
  return (
    <motion.div
      className="relative"
      style={{ width: 80 * intensity, height: 120 * intensity }}
    >
      {/* Corps */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        animate={{
          y: [0, -10 * intensity, 0],
          rotate: [-5, 5, -5],
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          delay,
          ease: 'easeInOut',
        }}
      >
        {/* Tête */}
        <motion.div
          className="relative mx-auto rounded-full"
          style={{
            width: 40 * intensity,
            height: 40 * intensity,
            backgroundColor: color.skin,
            boxShadow: 'inset -3px -3px 8px rgba(0,0,0,0.2)',
          }}
          animate={{ rotate: [-3, 3, -3] }}
          transition={{ duration: 0.3, repeat: Infinity, delay }}
        >
          {/* Cheveux */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-t-full"
            style={{
              width: 35 * intensity,
              height: 20 * intensity,
              backgroundColor: color.hair,
              top: -2 * intensity,
            }}
          />
          {/* Yeux */}
          <motion.div
            className="absolute flex gap-2"
            style={{ top: 12 * intensity, left: '50%', transform: 'translateX(-50%)' }}
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{ duration: 3, repeat: Infinity, delay: delay + 1 }}
          >
            <div className="w-2 h-2 bg-[#2C1810] rounded-full" style={{ width: 4 * intensity, height: 4 * intensity }} />
            <div className="w-2 h-2 bg-[#2C1810] rounded-full" style={{ width: 4 * intensity, height: 4 * intensity }} />
          </motion.div>
          {/* Sourire */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 rounded-b-full bg-[#E74C3C]"
            style={{
              width: 12 * intensity,
              height: 6 * intensity,
              bottom: 8 * intensity,
            }}
            animate={{ scaleX: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity, delay }}
          />
        </motion.div>

        {/* Corps */}
        <motion.div
          className="mx-auto rounded-t-2xl rounded-b-lg"
          style={{
            width: 35 * intensity,
            height: 45 * intensity,
            backgroundColor: color.body,
            marginTop: 2 * intensity,
            boxShadow: 'inset -3px -3px 8px rgba(0,0,0,0.2)',
          }}
        />

        {/* Bras gauche */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 12 * intensity,
            height: 35 * intensity,
            backgroundColor: color.body,
            left: -8 * intensity,
            top: 45 * intensity,
            transformOrigin: 'top center',
            boxShadow: 'inset -2px -2px 5px rgba(0,0,0,0.2)',
          }}
          animate={{ rotate: [-45, 45, -45] }}
          transition={{ duration: 0.4, repeat: Infinity, delay }}
        />

        {/* Bras droit */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 12 * intensity,
            height: 35 * intensity,
            backgroundColor: color.body,
            right: -8 * intensity,
            top: 45 * intensity,
            transformOrigin: 'top center',
            boxShadow: 'inset -2px -2px 5px rgba(0,0,0,0.2)',
          }}
          animate={{ rotate: [45, -45, 45] }}
          transition={{ duration: 0.4, repeat: Infinity, delay: delay + 0.2 }}
        />

        {/* Jambes */}
        <div className="flex justify-center gap-1" style={{ marginTop: 2 * intensity }}>
          <motion.div
            className="rounded-b-lg"
            style={{
              width: 14 * intensity,
              height: 25 * intensity,
              backgroundColor: '#2C3E50',
              boxShadow: 'inset -2px -2px 5px rgba(0,0,0,0.3)',
            }}
            animate={{ rotate: [-10, 10, -10] }}
            transition={{ duration: 0.3, repeat: Infinity, delay }}
          />
          <motion.div
            className="rounded-b-lg"
            style={{
              width: 14 * intensity,
              height: 25 * intensity,
              backgroundColor: '#2C3E50',
              boxShadow: 'inset -2px -2px 5px rgba(0,0,0,0.3)',
            }}
            animate={{ rotate: [10, -10, 10] }}
            transition={{ duration: 0.3, repeat: Infinity, delay: delay + 0.15 }}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}

// Confetti
function Confetti({ count = 100 }: { count?: number }) {
  const confettiPieces = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 2,
      color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'][Math.floor(Math.random() * 8)],
      rotation: Math.random() * 360,
      size: 8 + Math.random() * 8,
    }))
  }, [count])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {confettiPieces.map((piece) => (
        <motion.div
          key={piece.id}
          className="absolute"
          style={{
            left: `${piece.x}%`,
            top: -20,
            width: piece.size,
            height: piece.size * 0.6,
            backgroundColor: piece.color,
            borderRadius: 2,
          }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{
            y: ['0vh', '110vh'],
            rotate: [piece.rotation, piece.rotation + 720],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  )
}

// Feu d'artifice
function Firework({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      angle: (i * 30) * (Math.PI / 180),
      distance: 60 + Math.random() * 40,
    }))
  }, [])

  return (
    <motion.div
      className="absolute"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0, 1, 1], opacity: [0, 1, 0] }}
      transition={{ duration: 1.5, delay, repeat: Infinity, repeatDelay: 2 }}
    >
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ x: 0, y: 0, scale: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance,
            scale: [1, 0],
            opacity: [1, 0],
          }}
          transition={{ duration: 1, delay: delay + 0.3, repeat: Infinity, repeatDelay: 2 }}
        />
      ))}
      {/* Centre lumineux */}
      <motion.div
        className="absolute w-4 h-4 rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{ backgroundColor: 'white', boxShadow: `0 0 20px ${color}` }}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.5, 0] }}
        transition={{ duration: 0.5, delay, repeat: Infinity, repeatDelay: 2 }}
      />
    </motion.div>
  )
}

// Étoiles scintillantes
function SparklingStars() {
  const stars = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 10 + Math.random() * 15,
      delay: Math.random() * 2,
    }))
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute text-yellow-300"
          style={{ left: `${star.x}%`, top: `${star.y}%`, fontSize: star.size }}
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
            rotate: [0, 180],
          }}
          transition={{
            duration: 1.5,
            delay: star.delay,
            repeat: Infinity,
            repeatDelay: 1,
          }}
        >
          ✦
        </motion.div>
      ))}
    </div>
  )
}

export default function QuizPodium({ winners, onClose }: QuizPodiumProps) {
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 500)
    return () => clearTimeout(timer)
  }, [])

  // Ensure we have 3 winners (fill with empty if needed)
  const podiumWinners = [
    winners[1] || { name: '-', score: 0, rank: 2 }, // 2ème (gauche)
    winners[0] || { name: '-', score: 0, rank: 1 }, // 1er (centre)
    winners[2] || { name: '-', score: 0, rank: 3 }, // 3ème (droite)
  ]

  const podiumHeights = [180, 240, 140] // 2ème, 1er, 3ème

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#0a0a1a] via-[#1a0a2e] to-[#0a1a2a]"
    >
      {/* Effets de fond */}
      <Confetti count={150} />
      <SparklingStars />

      {/* Feux d'artifice */}
      <Firework x={15} y={20} delay={0} color="#FFD700" />
      <Firework x={85} y={25} delay={0.7} color="#FF6B6B" />
      <Firework x={50} y={15} delay={1.4} color="#4ECDC4" />
      <Firework x={25} y={30} delay={2.1} color="#DDA0DD" />
      <Firework x={75} y={20} delay={2.8} color="#45B7D1" />

      {/* Halo doré central */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(212,175,55,0.6) 0%, transparent 60%)',
        }}
      />

      {/* Contenu */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Titre */}
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
          className="text-center mb-8"
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block"
          >
            <Trophy className="w-20 h-20 text-[#FFD700] mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.8))' }} />
          </motion.div>
          <h1
            className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#FFF8DC] to-[#FFD700]"
            style={{ textShadow: '0 0 40px rgba(255,215,0,0.5)' }}
          >
            FÉLICITATIONS !
          </h1>
          <p className="text-2xl text-gray-300 mt-2">Voici les champions du quiz</p>
        </motion.div>

        {/* Podium */}
        <AnimatePresence>
          {showContent && (
            <div className="flex items-end justify-center gap-4 md:gap-8">
              {podiumWinners.map((winner, index) => {
                const podiumIndex = index === 1 ? 0 : index === 0 ? 1 : 2 // Réordonner pour affichage
                const avatarColor = AVATAR_COLORS[podiumIndex]
                const height = podiumHeights[index]
                const isFirst = index === 1
                const delay = index === 1 ? 0 : index === 0 ? 0.3 : 0.6

                return (
                  <motion.div
                    key={index}
                    initial={{ y: 200, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay, type: 'spring', stiffness: 80 }}
                    className="flex flex-col items-center"
                  >
                    {/* Avatar dansant */}
                    <div className="mb-4">
                      <DancingAvatar
                        color={avatarColor}
                        delay={delay}
                        intensity={isFirst ? 1.2 : 1}
                      />
                    </div>

                    {/* Marche du podium */}
                    <motion.div
                      className="relative flex flex-col items-center justify-start rounded-t-xl overflow-hidden"
                      style={{
                        width: isFirst ? 160 : 130,
                        height,
                        background: isFirst
                          ? 'linear-gradient(180deg, #FFD700 0%, #B8860B 100%)'
                          : index === 0
                          ? 'linear-gradient(180deg, #C0C0C0 0%, #808080 100%)'
                          : 'linear-gradient(180deg, #CD7F32 0%, #8B4513 100%)',
                        boxShadow: isFirst
                          ? '0 0 40px rgba(255,215,0,0.5), inset 0 2px 10px rgba(255,255,255,0.3)'
                          : 'inset 0 2px 10px rgba(255,255,255,0.2)',
                      }}
                      initial={{ height: 0 }}
                      animate={{ height }}
                      transition={{ delay: delay + 0.3, duration: 0.8, ease: 'easeOut' }}
                    >
                      {/* Rang */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: delay + 0.8, type: 'spring' }}
                        className="mt-4"
                      >
                        {isFirst ? (
                          <Crown className="w-12 h-12 text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                        ) : (
                          <span className="text-4xl font-black text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                            {index === 0 ? '2' : '3'}
                          </span>
                        )}
                      </motion.div>

                      {/* Nom */}
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: delay + 1 }}
                        className="text-white font-bold text-center px-2 mt-2 text-sm md:text-base truncate w-full"
                        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                      >
                        {winner.name}
                      </motion.p>

                      {/* Score */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: delay + 1.2 }}
                        className="mt-2 px-3 py-1 bg-black/20 rounded-full"
                      >
                        <span className="text-white font-bold text-sm">
                          {winner.score} pts
                        </span>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </AnimatePresence>

        {/* Bouton fermer (optionnel) */}
        {onClose && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3 }}
            onClick={onClose}
            className="mt-12 px-8 py-3 bg-[#D4AF37] text-black font-bold rounded-xl hover:bg-[#F4D03F] transition-colors"
          >
            Terminer
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
