'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WheelSegment } from '@/types/database'

interface WheelGameProps {
  segments: WheelSegment[]
  isSpinning: boolean
  result: string | null
  spinToIndex?: number
}

export default function WheelGame({ segments, isSpinning, result, spinToIndex }: WheelGameProps) {
  const [rotation, setRotation] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const previousSpinning = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Calculate wheel rotation when spinning
  useEffect(() => {
    if (isSpinning && !previousSpinning.current) {
      // Start spinning
      setShowResult(false)

      // Play tick sound during spin
      if (audioRef.current) {
        audioRef.current.play().catch(() => {})
      }

      // Calculate final rotation
      const segmentAngle = 360 / segments.length
      const targetAngle = spinToIndex !== undefined
        ? 360 - (spinToIndex * segmentAngle) - segmentAngle / 2 // Point to middle of segment
        : Math.random() * 360

      // Add multiple full rotations + target
      const fullRotations = 5 + Math.floor(Math.random() * 3) // 5-7 full rotations
      const newRotation = rotation + (fullRotations * 360) + targetAngle - (rotation % 360)

      setRotation(newRotation)
    } else if (!isSpinning && previousSpinning.current) {
      // Spin ended
      setTimeout(() => setShowResult(true), 300)
    }
    previousSpinning.current = isSpinning
  }, [isSpinning, spinToIndex, segments.length])

  // Generate wheel segments as SVG paths
  const generateWheel = () => {
    const cx = 200 // center x
    const cy = 200 // center y
    const r = 180 // radius
    const count = segments.length
    const anglePerSegment = (2 * Math.PI) / count

    return segments.map((segment, index) => {
      const startAngle = index * anglePerSegment - Math.PI / 2 // Start from top
      const endAngle = startAngle + anglePerSegment

      const x1 = cx + r * Math.cos(startAngle)
      const y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle)
      const y2 = cy + r * Math.sin(endAngle)

      const largeArcFlag = anglePerSegment > Math.PI ? 1 : 0

      const pathData = [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ')

      // Calculate text position (middle of segment)
      const textAngle = startAngle + anglePerSegment / 2
      const textRadius = r * 0.65
      const textX = cx + textRadius * Math.cos(textAngle)
      const textY = cy + textRadius * Math.sin(textAngle)
      const textRotation = (textAngle * 180) / Math.PI + 90

      return (
        <g key={segment.id}>
          <path
            d={pathData}
            fill={segment.color}
            stroke="#1A1A1E"
            strokeWidth="2"
          />
          <text
            x={textX}
            y={textY}
            fill="white"
            fontSize="12"
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${textRotation}, ${textX}, ${textY})`}
            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
          >
            {segment.text.length > 15 ? segment.text.substring(0, 15) + '...' : segment.text}
          </text>
        </g>
      )
    })
  }

  return (
    <div className="min-h-screen bg-[#1A1A1E] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        {/* Animated dots */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-[#D4AF37]/30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center z-10"
      >
        <h1 className="text-4xl font-bold text-white flex items-center gap-3">
          <span className="text-5xl">🎡</span>
          Roue de la Fortune
        </h1>
      </motion.div>

      {/* Wheel container */}
      <div className="relative z-10">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20">
          <div className="w-0 h-0 border-l-[20px] border-r-[20px] border-t-[40px] border-l-transparent border-r-transparent border-t-[#D4AF37]"
               style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }} />
        </div>

        {/* Wheel */}
        <motion.div
          animate={{ rotate: rotation }}
          transition={{
            duration: isSpinning ? 5 : 0,
            ease: isSpinning ? [0.2, 0.8, 0.2, 1] : 'linear'
          }}
          className="relative"
          style={{
            filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))'
          }}
        >
          <svg width="400" height="400" viewBox="0 0 400 400">
            {/* Outer ring */}
            <circle cx="200" cy="200" r="195" fill="none" stroke="#D4AF37" strokeWidth="8" />
            <circle cx="200" cy="200" r="185" fill="none" stroke="#1A1A1E" strokeWidth="4" />

            {/* Segments */}
            {generateWheel()}

            {/* Center circle */}
            <circle cx="200" cy="200" r="30" fill="#242428" stroke="#D4AF37" strokeWidth="4" />
            <circle cx="200" cy="200" r="15" fill="#D4AF37" />
          </svg>
        </motion.div>

        {/* Spinning indicator */}
        <AnimatePresence>
          {isSpinning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -bottom-16 left-1/2 -translate-x-1/2"
            >
              <div className="flex items-center gap-2 bg-[#242428] px-4 py-2 rounded-full border border-[#D4AF37]">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-white font-medium">Rotation en cours...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Result popup */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(212, 175, 55, 0)',
                  '0 0 0 20px rgba(212, 175, 55, 0.3)',
                  '0 0 0 40px rgba(212, 175, 55, 0)',
                ]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="bg-[#242428] border-4 border-[#D4AF37] rounded-2xl p-8 text-center max-w-lg mx-4"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
              }}
            >
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-6xl mb-4"
              >
                🎉
              </motion.div>
              <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Le défi est...</p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-[#D4AF37]"
              >
                {result}
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden audio for tick sound (optional) */}
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/tick.mp3" type="audio/mpeg" />
      </audio>
    </div>
  )
}
