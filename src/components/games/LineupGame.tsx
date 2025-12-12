'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LineupGameProps {
  currentNumber: string
  timeLeft: number
  clockDuration: number
  isRunning: boolean
  currentPoints: number
  team1Name: string
  team2Name: string
  team1Score: number
  team2Score: number
  showWinner: boolean
  teamSize: number
}

// Floating particle component
function FloatingParticle({ delay, duration, x, size }: { delay: number; duration: number; x: number; size: number }) {
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
        y: [0, -window.innerHeight - 100],
        opacity: [0, 0.6, 0.6, 0],
        x: [0, Math.sin(x) * 30, -Math.sin(x) * 20, Math.sin(x) * 10],
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

// Pre-generated particle data
const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  delay: Math.random() * 5,
  duration: 8 + Math.random() * 6,
  x: Math.random() * 100,
  size: 4 + Math.random() * 8,
}))

export default function LineupGame({
  currentNumber,
  timeLeft,
  clockDuration,
  isRunning,
  currentPoints,
  team1Name,
  team2Name,
  team1Score,
  team2Score,
  showWinner,
  teamSize,
}: LineupGameProps) {
  const [displayNumber, setDisplayNumber] = useState(currentNumber)
  const [digitAnimations, setDigitAnimations] = useState<boolean[]>([])
  const prevNumberRef = useRef(currentNumber)

  // Animate number changes
  useEffect(() => {
    if (currentNumber !== prevNumberRef.current) {
      // Trigger flip animation for each digit
      const newAnimations = currentNumber.split('').map(() => true)
      setDigitAnimations(newAnimations)

      setTimeout(() => {
        setDisplayNumber(currentNumber)
        setTimeout(() => {
          setDigitAnimations([])
        }, 400)
      }, 100)
    } else {
      setDisplayNumber(currentNumber)
    }
    prevNumberRef.current = currentNumber
  }, [currentNumber])

  // Get winner info
  const winner = useMemo(() => {
    if (team1Score > team2Score) {
      return { name: team1Name, score: team1Score }
    } else if (team2Score > team1Score) {
      return { name: team2Name, score: team2Score }
    }
    return { name: 'Égalité', score: Math.max(team1Score, team2Score) }
  }, [team1Score, team2Score, team1Name, team2Name])

  // Confetti colors
  const confettiColors = ['#D4AF37', '#F4D03F', '#FFFFFF', '#FFD700', '#FFA500']

  // Display digits (pad with dashes if empty)
  const digits = displayNumber || Array(teamSize).fill('-').join('')

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* FOND ANIMÉ - Gradient dynamique */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2a] to-[#0a1a2a]">
        {/* Particules flottantes dorées */}
        {PARTICLES.map((particle) => (
          <FloatingParticle key={particle.id} {...particle} />
        ))}

        {/* Rayons lumineux en arrière-plan */}
        <div className="absolute inset-0 opacity-20 overflow-hidden">
          <motion.div
            className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-[#D4AF37] to-transparent"
            animate={{ rotate: [12, 15, 12], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-0 right-1/4 w-1 h-full bg-gradient-to-b from-[#D4AF37] to-transparent"
            animate={{ rotate: [-12, -15, -12], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
        </div>

        {/* Halo central */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(212,175,55,0.3) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* TITRE DU JEU - Style néon/brillant */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-6 left-1/2 -translate-x-1/2 text-center z-10"
      >
        <h1
          className="text-5xl font-black tracking-wider"
          style={{
            textShadow: '0 0 10px #D4AF37, 0 0 20px #D4AF37, 0 0 40px #D4AF37, 0 0 80px #D4AF37',
          }}
        >
          <span className="text-white">LE BON</span>
          <span className="text-[#D4AF37]"> ORDRE</span>
        </h1>
        <p className="text-gray-300 mt-2 text-lg tracking-widest uppercase">
          Placez-vous dans l&apos;ordre affiché !
        </p>
      </motion.div>

      {/* PANNEAU DES NUMÉROS - Style tableau mécanique premium */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="relative">
          {/* Ombre portée */}
          <div className="absolute inset-0 bg-black blur-3xl opacity-50 translate-y-4" />

          {/* Cadre doré avec biseaux */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-gradient-to-b from-[#F4D03F] via-[#D4AF37] to-[#B8960C] p-3 rounded-2xl"
            style={{
              boxShadow: '0 0 60px rgba(212, 175, 55, 0.5), inset 0 2px 0 rgba(255,255,255,0.3)',
            }}
          >
            {/* Intérieur noir */}
            <div
              className="bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded-xl p-4 flex gap-3"
              style={{ boxShadow: 'inset 0 5px 20px rgba(0,0,0,0.8)' }}
            >
              {/* Chaque digit */}
              {digits.split('').map((digit, index) => (
                <motion.div
                  key={index}
                  initial={digitAnimations[index] ? { rotateX: 90 } : {}}
                  animate={{ rotateX: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="relative w-28 h-36 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] rounded-xl overflow-hidden"
                  style={{
                    boxShadow:
                      'inset 0 -5px 15px rgba(0,0,0,0.5), inset 0 5px 15px rgba(255,255,255,0.05), 0 5px 15px rgba(0,0,0,0.3)',
                    border: '1px solid #3a3a3a',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Reflet en haut */}
                  <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />

                  {/* Ligne de séparation (style flip) */}
                  <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-black shadow-lg" />

                  {/* Le chiffre */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="text-8xl font-black text-white"
                      style={{
                        textShadow: '0 0 30px rgba(255,255,255,0.5), 0 4px 0 #000',
                        fontFamily: 'Arial Black, sans-serif',
                      }}
                    >
                      {digit}
                    </span>
                  </div>

                  {/* Rivets décoratifs */}
                  <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-gradient-to-br from-[#4a4a4a] to-[#2a2a2a]" />
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gradient-to-br from-[#4a4a4a] to-[#2a2a2a]" />
                  <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-gradient-to-br from-[#4a4a4a] to-[#2a2a2a]" />
                  <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-gradient-to-br from-[#4a4a4a] to-[#2a2a2a]" />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Supports latéraux style mécanique */}
          <div
            className="absolute -left-6 top-1/2 -translate-y-1/2 w-10 h-24 bg-gradient-to-r from-[#3a3a3a] to-[#2a2a2a] rounded-l-xl"
            style={{ boxShadow: '-5px 0 15px rgba(0,0,0,0.5)' }}
          />
          <div
            className="absolute -right-6 top-1/2 -translate-y-1/2 w-10 h-24 bg-gradient-to-l from-[#3a3a3a] to-[#2a2a2a] rounded-r-xl"
            style={{ boxShadow: '5px 0 15px rgba(0,0,0,0.5)' }}
          />
        </div>
      </div>

      {/* CHRONOMÈTRE - Style horloge de jeu TV */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10">
        <div className="relative">
          {/* Cercle extérieur lumineux */}
          <motion.div
            className="w-44 h-44 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, #D4AF37, #F4D03F, #D4AF37)',
              boxShadow: '0 0 40px rgba(212, 175, 55, 0.6), inset 0 0 30px rgba(0,0,0,0.8)',
              padding: '4px',
            }}
            animate={isRunning ? { boxShadow: ['0 0 40px rgba(212, 175, 55, 0.6)', '0 0 60px rgba(212, 175, 55, 0.8)', '0 0 40px rgba(212, 175, 55, 0.6)'] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {/* Cercle intérieur */}
            <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1a1a2a] to-[#0a0a1a] flex items-center justify-center relative overflow-hidden">
              {/* Graduations */}
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-4"
                  style={{
                    background: i < Math.ceil((timeLeft / clockDuration) * 12) ? '#D4AF37' : '#3a3a3a',
                    top: '8px',
                    left: '50%',
                    transformOrigin: '50% 80px',
                    transform: `translateX(-50%) rotate(${i * 30}deg)`,
                  }}
                />
              ))}

              {/* Aiguille */}
              <motion.div
                className="absolute w-2 h-20 origin-bottom rounded-full"
                style={{
                  background: 'linear-gradient(to top, #ff0000, #ff4444)',
                  bottom: '50%',
                  left: 'calc(50% - 4px)',
                  boxShadow: '0 0 10px rgba(255,0,0,0.5)',
                }}
                animate={{
                  rotate: (1 - timeLeft / clockDuration) * 360,
                }}
                transition={{ duration: 1, ease: 'linear' }}
              />

              {/* Centre doré */}
              <div
                className="absolute w-6 h-6 rounded-full bg-gradient-to-br from-[#F4D03F] to-[#B8960C] z-10"
                style={{ boxShadow: '0 0 15px rgba(212, 175, 55, 0.8)' }}
              />

              {/* Temps digital */}
              <motion.div
                className="absolute bottom-6"
                animate={timeLeft <= 10 && isRunning ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <span
                  className={`text-3xl font-black font-mono ${timeLeft <= 10 ? 'text-red-500' : 'text-white'}`}
                  style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}
                >
                  {timeLeft}
                </span>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Points en jeu - avec animation pulse */}
        <div className="text-center mt-4">
          <motion.span
            className={`text-4xl font-black ${
              currentPoints === 30
                ? 'text-green-400'
                : currentPoints === 20
                ? 'text-yellow-400'
                : 'text-orange-400'
            }`}
            style={{ textShadow: '0 0 20px currentColor' }}
            animate={isRunning ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            {currentPoints} POINTS
          </motion.span>
        </div>
      </div>

      {/* SCORES DES ÉQUIPES - Style tableaux de score lumineux */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-8 left-8 z-10"
      >
        <div
          className="relative bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a] rounded-2xl p-6 min-w-[220px]"
          style={{
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            border: '2px solid #D4AF37',
          }}
        >
          {/* LED en haut */}
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-green-500"
            style={{ boxShadow: '0 0 15px #22c55e' }}
          />

          <p className="text-[#D4AF37] text-xl font-bold text-center mb-2 uppercase tracking-wider">
            {team1Name}
          </p>
          <motion.p
            className="text-7xl font-black text-white text-center"
            style={{
              textShadow: '0 0 20px rgba(255,255,255,0.5)',
              fontFamily: 'Arial Black, sans-serif',
            }}
            key={team1Score}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {team1Score}
          </motion.p>
        </div>
      </motion.div>

      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-8 right-8 z-10"
      >
        <div
          className="relative bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a] rounded-2xl p-6 min-w-[220px]"
          style={{
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            border: '2px solid #D4AF37',
          }}
        >
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-green-500"
            style={{ boxShadow: '0 0 15px #22c55e' }}
          />

          <p className="text-[#D4AF37] text-xl font-bold text-center mb-2 uppercase tracking-wider">
            {team2Name}
          </p>
          <motion.p
            className="text-7xl font-black text-white text-center"
            style={{
              textShadow: '0 0 20px rgba(255,255,255,0.5)',
              fontFamily: 'Arial Black, sans-serif',
            }}
            key={team2Score}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {team2Score}
          </motion.p>
        </div>
      </motion.div>

      {/* INDICATEUR EN COURS - Clignotant */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute top-6 right-6 z-20"
          >
            <div className="flex items-center gap-2 bg-red-500/20 border border-red-500 rounded-full px-4 py-2 backdrop-blur-sm">
              <motion.div
                className="w-3 h-3 bg-red-500 rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-red-400 font-bold uppercase tracking-wider">En direct</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ÉCRAN DE VICTOIRE - SPECTACULAIRE */}
      <AnimatePresence>
        {showWinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          >
            {/* Fond avec explosion de lumière */}
            <div className="absolute inset-0 bg-black">
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%]"
                style={{
                  background: 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, transparent 50%)',
                }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>

            {/* Confettis dorés */}
            {[...Array(100)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-4 h-4"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-20px',
                  backgroundColor: confettiColors[i % confettiColors.length],
                  borderRadius: Math.random() > 0.5 ? '50%' : '0%',
                }}
                initial={{ y: -50, rotate: 0, opacity: 1 }}
                animate={{
                  y: window.innerHeight + 100,
                  rotate: Math.random() * 720,
                  opacity: [1, 1, 0],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  delay: Math.random() * 2,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            ))}

            {/* Contenu victoire */}
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="relative text-center z-10"
            >
              <motion.div
                className="text-9xl mb-6"
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                🏆
              </motion.div>
              <h2
                className="text-6xl font-black text-[#D4AF37] mb-4"
                style={{ textShadow: '0 0 30px #D4AF37, 0 0 60px #D4AF37' }}
              >
                VICTOIRE !
              </h2>
              <motion.p
                className="text-5xl font-bold text-white mb-4"
                style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {winner.name}
              </motion.p>
              <motion.p
                className="text-3xl text-[#D4AF37]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {winner.score} points
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
