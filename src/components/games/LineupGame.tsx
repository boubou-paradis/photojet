'use client'

import { useEffect, useState, useRef } from 'react'
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
  const [showNumberAnimation, setShowNumberAnimation] = useState(false)
  const prevNumberRef = useRef(currentNumber)

  // Animate number changes
  useEffect(() => {
    if (currentNumber && currentNumber !== prevNumberRef.current && currentNumber !== displayNumber) {
      setShowNumberAnimation(true)
      setTimeout(() => {
        setDisplayNumber(currentNumber)
        setTimeout(() => {
          setShowNumberAnimation(false)
        }, 500)
      }, 300)
    } else {
      setDisplayNumber(currentNumber)
    }
    prevNumberRef.current = currentNumber
  }, [currentNumber])

  // Get winner info
  const getWinner = () => {
    if (team1Score > team2Score) {
      return { name: team1Name, score: team1Score }
    } else if (team2Score > team1Score) {
      return { name: team2Name, score: team2Score }
    }
    return { name: 'Égalité', score: Math.max(team1Score, team2Score) }
  }

  // Generate confetti elements
  const confettiColors = ['#D4AF37', '#F4D03F', '#FFFFFF', '#FFD700', '#FFA500']

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#1A1A1E] to-[#0D0D0F] flex flex-col items-center justify-center overflow-hidden">
      {/* Logo du jeu en haut */}
      <div className="absolute top-8 text-center">
        <h1 className="text-4xl font-bold">
          <span className="text-white">LE BON</span>
          <span className="text-[#D4AF37]"> ORDRE</span>
        </h1>
        <p className="text-gray-400 mt-1">Placez-vous dans l&apos;ordre affiché !</p>
      </div>

      {/* Panneau d'affichage des numéros - Style tableau mécanique */}
      <div className="relative mt-8">
        {/* Cadre doré */}
        <div className="bg-gradient-to-b from-[#D4AF37] to-[#B8960C] p-2 rounded-2xl shadow-2xl">
          <div className="bg-[#0A0A0A] rounded-xl p-6 flex gap-2">
            {(displayNumber || Array(teamSize).fill('')).toString().split('').slice(0, teamSize).map((digit, index) => (
              <motion.div
                key={index}
                initial={{ rotateX: 90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className="w-24 h-32 bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] rounded-lg flex items-center justify-center border border-[#3A3A3A] shadow-inner"
              >
                <span
                  className="text-7xl font-bold text-white font-mono"
                  style={{ textShadow: '0 0 20px rgba(255,255,255,0.3)' }}
                >
                  {digit || '-'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Décorations latérales (style mécanique) */}
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-16 bg-gradient-to-r from-[#3A3A3A] to-[#2A2A2A] rounded-l-lg"></div>
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-16 bg-gradient-to-l from-[#3A3A3A] to-[#2A2A2A] rounded-r-lg"></div>
      </div>

      {/* Chronomètre circulaire au centre-bas */}
      <div className="mt-12 relative">
        {/* Cercle extérieur */}
        <div className="w-48 h-48 rounded-full bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] border-4 border-[#D4AF37] flex items-center justify-center shadow-2xl relative">
          {/* Graduations SVG */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
            {[...Array(12)].map((_, i) => {
              const thresholdIndex = Math.ceil((timeLeft / clockDuration) * 12)
              return (
                <line
                  key={i}
                  x1="50"
                  y1="8"
                  x2="50"
                  y2="14"
                  stroke={i < thresholdIndex ? '#D4AF37' : '#3A3A3A'}
                  strokeWidth="2"
                  transform={`rotate(${i * 30} 50 50)`}
                />
              )
            })}
          </svg>

          {/* Aiguille */}
          <motion.div
            className="absolute w-1 h-16 bg-red-500 origin-bottom rounded-full"
            style={{
              bottom: '50%',
              left: 'calc(50% - 2px)',
            }}
            animate={{
              rotate: (1 - timeLeft / clockDuration) * 360,
            }}
            transition={{ duration: 0.5, ease: 'linear' }}
          />

          {/* Centre */}
          <div className="w-4 h-4 rounded-full bg-[#D4AF37] absolute z-10"></div>

          {/* Temps digital */}
          <div className="absolute bottom-8">
            <motion.span
              className={`text-3xl font-bold font-mono ${
                timeLeft <= 10 ? 'text-red-500' : 'text-white'
              }`}
              animate={timeLeft <= 10 && isRunning ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5, repeat: timeLeft <= 10 && isRunning ? Infinity : 0 }}
            >
              {timeLeft}
            </motion.span>
          </div>
        </div>

        {/* Points en jeu sous le chrono */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <motion.span
            className={`text-3xl font-bold ${
              currentPoints === 30 ? 'text-green-400' :
              currentPoints === 20 ? 'text-yellow-400' :
              'text-orange-400'
            }`}
            animate={isRunning ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1, repeat: isRunning ? Infinity : 0 }}
          >
            {currentPoints} POINTS
          </motion.span>
        </div>
      </div>

      {/* Scores des équipes - en bas à gauche et droite */}
      <motion.div
        className="absolute bottom-8 left-8"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="bg-[#242428] border-2 border-[#D4AF37] rounded-xl p-6 min-w-[200px]">
          <p className="text-[#D4AF37] text-lg font-bold text-center mb-2">{team1Name}</p>
          <p className="text-6xl font-bold text-white text-center font-mono">{team1Score}</p>
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-8 right-8"
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="bg-[#242428] border-2 border-[#D4AF37] rounded-xl p-6 min-w-[200px]">
          <p className="text-[#D4AF37] text-lg font-bold text-center mb-2">{team2Name}</p>
          <p className="text-6xl font-bold text-white text-center font-mono">{team2Score}</p>
        </div>
      </motion.div>

      {/* Indicateur de statut */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            className="absolute top-1/2 left-8 -translate-y-1/2"
          >
            <div className="bg-green-500 text-white px-4 py-2 rounded-full font-bold animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full"></span>
              EN COURS
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animation de nouveau numéro */}
      <AnimatePresence>
        {showNumberAnimation && currentNumber && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/80"
          >
            <motion.div
              className="text-[200px] font-bold text-[#D4AF37] font-mono"
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 0.5 }}
            >
              {currentNumber}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Écran de victoire */}
      <AnimatePresence>
        {showWinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/90"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="text-center relative"
            >
              <motion.div
                className="text-8xl mb-6"
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                🏆
              </motion.div>
              <h2 className="text-5xl font-bold text-[#D4AF37] mb-4">VICTOIRE !</h2>
              <p className="text-4xl font-bold text-white">{getWinner().name}</p>
              <p className="text-2xl text-gray-400 mt-4">{getWinner().score} points</p>

              {/* Confettis animation */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(50)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-3 h-3 rounded-sm"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: '-20px',
                      backgroundColor: confettiColors[i % confettiColors.length],
                    }}
                    initial={{ y: -50, rotate: 0, opacity: 1 }}
                    animate={{
                      y: window.innerHeight + 100,
                      rotate: Math.random() * 720,
                      opacity: [1, 1, 0],
                    }}
                    transition={{
                      duration: 2 + Math.random() * 2,
                      delay: Math.random() * 2,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
