'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LineupGameProps {
  currentNumber: string
  timeLeft: number
  clockDuration: number
  isRunning: boolean
  isPaused: boolean
  isGameOver: boolean
  currentPoints: number
  team1Name: string
  team2Name: string
  team1Score: number
  team2Score: number
  showWinner: boolean
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

// Rolling digit component for odometer effect
function RollingDigit({ digit, isRolling, delay }: { digit: string; isRolling: boolean; delay: number }) {
  const [displayDigit, setDisplayDigit] = useState(digit)

  useEffect(() => {
    if (isRolling && digit !== '-') {
      // Generate random rolling sequence
      const sequence: string[] = []
      for (let i = 0; i < 15; i++) {
        sequence.push(Math.floor(Math.random() * 10).toString())
      }
      sequence.push(digit) // End with the actual digit

      let index = 0
      const interval = setInterval(() => {
        if (index < sequence.length) {
          setDisplayDigit(sequence[index])
          index++
        } else {
          clearInterval(interval)
        }
      }, 80 + delay * 20) // Stagger the rolls

      return () => clearInterval(interval)
    } else {
      setDisplayDigit(digit)
    }
  }, [digit, isRolling, delay])

  const isEmpty = digit === '-'

  return (
    <motion.div
      className="relative w-20 h-28 sm:w-24 sm:h-32 md:w-28 md:h-36 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] rounded-xl overflow-hidden"
      style={{
        boxShadow:
          'inset 0 -5px 15px rgba(0,0,0,0.5), inset 0 5px 15px rgba(255,255,255,0.05), 0 5px 15px rgba(0,0,0,0.3)',
        border: '1px solid #3a3a3a',
        transformStyle: 'preserve-3d',
      }}
      animate={isRolling && !isEmpty ? {
        y: [0, -2, 2, -1, 1, 0],
      } : {}}
      transition={{ duration: 0.1, repeat: isRolling && !isEmpty ? Infinity : 0 }}
    >
      {/* Reflet en haut */}
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />

      {/* Ligne de séparation (style flip) */}
      <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-black shadow-lg z-10" />

      {/* Le chiffre */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          key={displayDigit}
          initial={!isEmpty ? { y: -20, opacity: 0 } : {}}
          animate={{ y: 0, opacity: 1 }}
          className={`text-6xl sm:text-7xl md:text-8xl font-black ${isEmpty ? 'text-gray-600' : 'text-white'}`}
          style={{
            textShadow: isEmpty ? 'none' : '0 0 30px rgba(255,255,255,0.5), 0 4px 0 #000',
            fontFamily: 'Arial Black, sans-serif',
          }}
        >
          {displayDigit}
        </motion.span>
      </div>

      {/* Rivets décoratifs */}
      <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-gradient-to-br from-[#4a4a4a] to-[#2a2a2a]" />
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gradient-to-br from-[#4a4a4a] to-[#2a2a2a]" />
      <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-gradient-to-br from-[#4a4a4a] to-[#2a2a2a]" />
      <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-gradient-to-br from-[#4a4a4a] to-[#2a2a2a]" />
    </motion.div>
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

// Confetti colors
const CONFETTI_COLORS = ['#D4AF37', '#F4D03F', '#FFFFFF', '#FFD700', '#FFA500']

export default function LineupGame({
  currentNumber,
  timeLeft,
  clockDuration,
  isRunning,
  isPaused,
  isGameOver,
  currentPoints,
  team1Name,
  team2Name,
  team1Score,
  team2Score,
  showWinner,
}: LineupGameProps) {
  const [displayNumber, setDisplayNumber] = useState(currentNumber)
  const [isRolling, setIsRolling] = useState(false)
  const prevNumberRef = useRef(currentNumber)

  // Animate number changes with rolling effect
  useEffect(() => {
    if (currentNumber !== prevNumberRef.current && currentNumber !== '') {
      // Start rolling animation
      setIsRolling(true)

      // After 1.5 seconds, stop rolling and show final number
      setTimeout(() => {
        setDisplayNumber(currentNumber)
        setIsRolling(false)
      }, 1500)
    } else if (currentNumber === '') {
      setDisplayNumber('')
      setIsRolling(false)
    }
    prevNumberRef.current = currentNumber
  }, [currentNumber])

  // Get winner info
  const winner = useMemo(() => {
    if (team1Score > team2Score) {
      return { name: team1Name, score: team1Score, isTeam1: true }
    } else if (team2Score > team1Score) {
      return { name: team2Name, score: team2Score, isTeam1: false }
    }
    return { name: 'Égalité', score: team1Score, isTeam1: null }
  }, [team1Score, team2Score, team1Name, team2Name])

  // Display digits - TOUJOURS afficher 5 cases (vides ou avec chiffres)
  const displayDigits = useMemo(() => {
    if (isRolling && currentNumber) {
      return currentNumber.split('')
    }
    if (displayNumber) {
      return displayNumber.split('')
    }
    // Afficher 5 cases vides par défaut
    return ['-', '-', '-', '-', '-']
  }, [displayNumber, currentNumber, isRolling])

  // Timer progress (0 to 1)
  const timerProgress = timeLeft / clockDuration

  // Game is active (running or paused but not over)
  const gameActive = isRunning || isPaused

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

      {/* CONTENU PRINCIPAL - Layout en colonne avec espacement */}
      <div className="relative z-10 h-full flex flex-col items-center justify-start pt-6 pb-8">
        {/* TITRE DU JEU - Style néon/brillant */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8"
        >
          <h1
            className="text-4xl md:text-5xl font-black tracking-wider"
            style={{
              textShadow: '0 0 10px #D4AF37, 0 0 20px #D4AF37, 0 0 40px #D4AF37, 0 0 80px #D4AF37',
            }}
          >
            <span className="text-white">LE BON</span>
            <span className="text-[#D4AF37]"> ORDRE</span>
          </h1>
          <p className="text-gray-300 mt-2 text-base md:text-lg tracking-widest uppercase">
            Placez-vous dans l&apos;ordre affiché !
          </p>
        </motion.div>

        {/* ZONE CENTRALE - Panneau des numéros (TOUJOURS VISIBLE) */}
        <div className="flex-1 flex items-center justify-center w-full px-4">
          <div className="relative">
            {/* Ombre portée */}
            <div className="absolute inset-0 bg-black blur-3xl opacity-50 translate-y-4" />

            {/* Cadre doré avec biseaux */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative bg-gradient-to-b from-[#F4D03F] via-[#D4AF37] to-[#B8960C] p-2 md:p-3 rounded-2xl"
              style={{
                boxShadow: '0 0 60px rgba(212, 175, 55, 0.5), inset 0 2px 0 rgba(255,255,255,0.3)',
              }}
            >
              {/* Intérieur noir */}
              <div
                className="bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded-xl p-3 md:p-4 flex gap-2 md:gap-3"
                style={{ boxShadow: 'inset 0 5px 20px rgba(0,0,0,0.8)' }}
              >
                {/* Chaque digit avec effet compteur kilométrique */}
                {displayDigits.map((digit, index) => (
                  <RollingDigit
                    key={index}
                    digit={digit}
                    isRolling={isRolling}
                    delay={index}
                  />
                ))}
              </div>
            </motion.div>

            {/* Supports latéraux style mécanique */}
            <div
              className="absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 w-6 md:w-10 h-16 md:h-24 bg-gradient-to-r from-[#3a3a3a] to-[#2a2a2a] rounded-l-xl"
              style={{ boxShadow: '-5px 0 15px rgba(0,0,0,0.5)' }}
            />
            <div
              className="absolute -right-4 md:-right-6 top-1/2 -translate-y-1/2 w-6 md:w-10 h-16 md:h-24 bg-gradient-to-l from-[#3a3a3a] to-[#2a2a2a] rounded-r-xl"
              style={{ boxShadow: '5px 0 15px rgba(0,0,0,0.5)' }}
            />
          </div>
        </div>

        {/* ZONE CHRONOMÈTRE - Style Game Show spectaculaire */}
        <div className="mb-4">
          <div className="relative">
            {/* ANNEAU EXTÉRIEUR ROTATIF */}
            <motion.div
              className="absolute inset-0 w-48 h-48 md:w-56 md:h-56 rounded-full"
              style={{
                border: '3px solid transparent',
                borderTopColor: '#D4AF37',
                borderRightColor: '#F4D03F',
              }}
              animate={isRunning ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 2, repeat: isRunning ? Infinity : 0, ease: 'linear' }}
            />

            {/* CERCLE PRINCIPAL */}
            <div
              className="relative w-48 h-48 md:w-56 md:h-56 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, #1a1a2a, #0a0a1a)',
                boxShadow: '0 0 40px rgba(212, 175, 55, 0.4), inset 0 0 40px rgba(0,0,0,0.9)',
              }}
            >
              {/* BARRE DE PROGRESSION CIRCULAIRE */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                {/* Fond gris */}
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  fill="none"
                  stroke="#2a2a3a"
                  strokeWidth="8"
                />
                {/* Progression dorée */}
                <motion.circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  fill="none"
                  stroke={timeLeft <= 10 ? '#ef4444' : '#D4AF37'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 45}%`}
                  strokeDashoffset={`${(1 - timerProgress) * 2 * Math.PI * 45}%`}
                  style={{
                    filter: `drop-shadow(0 0 10px ${timeLeft <= 10 ? '#ef4444' : '#D4AF37'})`,
                  }}
                />
              </svg>

              {/* 60 GRADUATIONS */}
              {[...Array(60)].map((_, i) => {
                const isActive = i < Math.floor(timerProgress * 60)
                const isMajor = i % 5 === 0
                return (
                  <div
                    key={i}
                    className="absolute"
                    style={{
                      width: isMajor ? '3px' : '2px',
                      height: isMajor ? '10px' : '6px',
                      background: isActive
                        ? (timeLeft <= 10 ? '#ef4444' : '#D4AF37')
                        : '#3a3a3a',
                      top: isMajor ? '6px' : '8px',
                      left: '50%',
                      transformOrigin: `50% ${isMajor ? '106px' : '104px'}`,
                      transform: `translateX(-50%) rotate(${i * 6}deg)`,
                      boxShadow: isActive ? `0 0 4px ${timeLeft <= 10 ? '#ef4444' : '#D4AF37'}` : 'none',
                    }}
                  />
                )
              })}

              {/* CENTRE AVEC TEMPS */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {/* Temps digital grand */}
                <motion.div
                  animate={timeLeft <= 10 && isRunning ? {
                    scale: [1, 1.15, 1],
                  } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <span
                    className={`text-5xl md:text-6xl font-black font-mono ${
                      timeLeft <= 10 ? 'text-red-500' : timeLeft <= 20 ? 'text-yellow-400' : 'text-white'
                    }`}
                    style={{
                      textShadow: timeLeft <= 10
                        ? '0 0 20px rgba(239, 68, 68, 0.8)'
                        : '0 0 15px rgba(255,255,255,0.5)'
                    }}
                  >
                    {timeLeft}
                  </span>
                </motion.div>
                <span className="text-gray-400 text-sm uppercase tracking-widest mt-1">secondes</span>
              </div>

              {/* INDICATEUR LUMINEUX EN HAUT */}
              <motion.div
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full"
                style={{
                  background: isRunning
                    ? (timeLeft <= 10 ? '#ef4444' : '#22c55e')
                    : isPaused
                    ? '#f59e0b'
                    : '#6b7280',
                  boxShadow: isRunning
                    ? `0 0 15px ${timeLeft <= 10 ? '#ef4444' : '#22c55e'}`
                    : isPaused
                    ? '0 0 15px #f59e0b'
                    : 'none',
                }}
                animate={isRunning ? { opacity: [1, 0.5, 1] } : isPaused ? { opacity: [1, 0.3, 1] } : {}}
                transition={{ duration: isPaused ? 1 : 0.5, repeat: Infinity }}
              />
            </div>
          </div>

          {/* Points en jeu - sous le chrono */}
          {gameActive && (
            <div className="text-center mt-4">
              <motion.div
                className={`inline-block px-6 py-2 rounded-full ${
                  currentPoints === 30
                    ? 'bg-green-500/20 border-2 border-green-500'
                    : currentPoints === 20
                    ? 'bg-yellow-500/20 border-2 border-yellow-500'
                    : 'bg-orange-500/20 border-2 border-orange-500'
                }`}
                animate={isRunning ? { scale: [1, 1.03, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <span
                  className={`text-3xl md:text-4xl font-black ${
                    currentPoints === 30
                      ? 'text-green-400'
                      : currentPoints === 20
                      ? 'text-yellow-400'
                      : 'text-orange-400'
                  }`}
                  style={{ textShadow: '0 0 20px currentColor' }}
                >
                  {currentPoints} POINTS
                </span>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* SCORES DES ÉQUIPES - Positionnés en bas à gauche et droite */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="fixed bottom-6 left-6 z-20"
      >
        <div
          className="relative bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a] rounded-2xl p-4 md:p-6 min-w-[160px] md:min-w-[200px]"
          style={{
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            border: '2px solid #D4AF37',
          }}
        >
          {/* LED en haut */}
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 md:w-4 md:h-4 rounded-full bg-green-500"
            style={{ boxShadow: '0 0 15px #22c55e' }}
          />

          <p className="text-[#D4AF37] text-base md:text-xl font-bold text-center mb-1 md:mb-2 uppercase tracking-wider truncate">
            {team1Name}
          </p>
          <motion.p
            className="text-5xl md:text-7xl font-black text-white text-center"
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
        className="fixed bottom-6 right-6 z-20"
      >
        <div
          className="relative bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a] rounded-2xl p-4 md:p-6 min-w-[160px] md:min-w-[200px]"
          style={{
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            border: '2px solid #D4AF37',
          }}
        >
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 md:w-4 md:h-4 rounded-full bg-green-500"
            style={{ boxShadow: '0 0 15px #22c55e' }}
          />

          <p className="text-[#D4AF37] text-base md:text-xl font-bold text-center mb-1 md:mb-2 uppercase tracking-wider truncate">
            {team2Name}
          </p>
          <motion.p
            className="text-5xl md:text-7xl font-black text-white text-center"
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

      {/* INDICATEUR EN COURS / PAUSE */}
      <AnimatePresence>
        {(isRunning || isPaused) && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute top-6 right-6 z-20"
          >
            <div className={`flex items-center gap-2 ${
              isPaused
                ? 'bg-orange-500/20 border border-orange-500'
                : 'bg-red-500/20 border border-red-500'
            } rounded-full px-4 py-2 backdrop-blur-sm`}>
              <motion.div
                className={`w-3 h-3 ${isPaused ? 'bg-orange-500' : 'bg-red-500'} rounded-full`}
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className={`${isPaused ? 'text-orange-400' : 'text-red-400'} font-bold uppercase tracking-wider`}>
                {isPaused ? 'Pause' : 'En direct'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ÉCRAN DE FIN DE PARTIE - TEMPS ÉCOULÉ */}
      <AnimatePresence>
        {showWinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          >
            {/* Fond avec explosion de lumière */}
            <div className="absolute inset-0 bg-black/95">
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
                  backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
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
              className="relative text-center z-10 px-4"
            >
              <motion.div
                className="text-8xl md:text-9xl mb-4"
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                🏆
              </motion.div>

              <h2
                className="text-3xl md:text-4xl font-bold text-gray-400 mb-4"
              >
                TEMPS ÉCOULÉ !
              </h2>

              <h1
                className="text-5xl md:text-6xl font-black text-[#D4AF37] mb-4"
                style={{ textShadow: '0 0 30px #D4AF37, 0 0 60px #D4AF37' }}
              >
                {winner.isTeam1 === null ? 'ÉGALITÉ !' : 'VICTOIRE !'}
              </h1>

              {winner.isTeam1 !== null && (
                <motion.p
                  className="text-4xl md:text-5xl font-bold text-white mb-8"
                  style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {winner.name}
                </motion.p>
              )}

              {/* Scores finaux côte à côte */}
              <motion.div
                className="flex gap-6 md:gap-8 justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className={`p-4 md:p-6 rounded-xl ${
                  winner.isTeam1 === true
                    ? 'bg-[#D4AF37]/20 border-2 border-[#D4AF37]'
                    : 'bg-gray-800/50'
                }`}>
                  <p className="text-lg md:text-xl text-gray-400 mb-1">{team1Name}</p>
                  <p className="text-4xl md:text-5xl font-bold text-white">{team1Score}</p>
                </div>
                <div className={`p-4 md:p-6 rounded-xl ${
                  winner.isTeam1 === false
                    ? 'bg-[#D4AF37]/20 border-2 border-[#D4AF37]'
                    : 'bg-gray-800/50'
                }`}>
                  <p className="text-lg md:text-xl text-gray-400 mb-1">{team2Name}</p>
                  <p className="text-4xl md:text-5xl font-bold text-white">{team2Score}</p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
