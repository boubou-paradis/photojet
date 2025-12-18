'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WheelSegment, WheelAudioSettings } from '@/types/database'

interface WheelGameProps {
  segments: WheelSegment[]
  isSpinning: boolean
  result: string | null
  spinToIndex?: number
  usedSegmentIds?: string[]
  isGameFinished?: boolean
  audioSettings?: WheelAudioSettings
  spinMode?: 'auto' | 'manual'
}

const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i, delay: Math.random() * 5, duration: 8 + Math.random() * 6,
  x: Math.random() * 100, size: 4 + Math.random() * 8,
}))

const CONFETTI_COLORS = ['#D4AF37', '#F4D03F', '#FFFFFF', '#FFD700', '#FFA500']

export default function WheelGame({ segments, isSpinning, result, spinToIndex, usedSegmentIds = [], isGameFinished = false, audioSettings, spinMode = 'auto' }: WheelGameProps) {
  const [rotation, setRotation] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFinished, setShowFinished] = useState(false)
  const [isInfiniteSpinning, setIsInfiniteSpinning] = useState(false)
  const previousSpinning = useRef(false)
  const previousSpinToIndex = useRef<number | undefined>(undefined)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const customAudioRef = useRef<HTMLAudioElement | null>(null)
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const infiniteRotationRef = useRef(0)
  const [windowHeight, setWindowHeight] = useState(800)

  // Fade out audio smoothly
  const fadeOutAudio = useCallback((audio: HTMLAudioElement, duration: number = 500) => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current)
    }

    const initialVolume = audio.volume
    const steps = 20
    const stepTime = duration / steps
    const volumeStep = initialVolume / steps

    fadeIntervalRef.current = setInterval(() => {
      if (audio.volume > volumeStep) {
        audio.volume = Math.max(0, audio.volume - volumeStep)
      } else {
        audio.volume = 0
        audio.pause()
        audio.currentTime = 0
        audio.volume = initialVolume // Reset for next time
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current)
          fadeIntervalRef.current = null
        }
      }
    }, stepTime)
  }, [])

  // Filtrer les segments disponibles (non utilisés)
  const availableSegments = useMemo(() =>
    segments.filter(s => !usedSegmentIds.includes(s.id)),
    [segments, usedSegmentIds]
  )

  useEffect(() => { setWindowHeight(window.innerHeight) }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current)
      }
      if (customAudioRef.current) {
        customAudioRef.current.pause()
      }
    }
  }, [])

  // Afficher l'écran de fin quand le jeu est terminé (avec délai pour voir le dernier résultat)
  useEffect(() => {
    if (isGameFinished) {
      // Attendre 6 secondes pour que l'utilisateur voie le dernier résultat
      const timer = setTimeout(() => {
        setShowFinished(true)
        setShowConfetti(true)
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [isGameFinished])

  // Handle spin start
  useEffect(() => {
    if (isSpinning && !previousSpinning.current) {
      setShowResult(false)
      setShowConfetti(false)

      // Play custom audio if enabled and available
      if (audioSettings?.enabled && audioSettings?.url && customAudioRef.current) {
        customAudioRef.current.currentTime = 0
        customAudioRef.current.volume = 1
        customAudioRef.current.loop = true
        customAudioRef.current.play().catch(() => {})
      } else if (audioRef.current) {
        // Fallback to tick sound
        audioRef.current.play().catch(() => {})
      }

      // If spinToIndex is defined, animate to target (auto mode or manual stop)
      if (spinToIndex !== undefined) {
        setIsInfiniteSpinning(false)
        const segmentAngle = 360 / availableSegments.length
        const targetAngle = 360 - (spinToIndex * segmentAngle) - segmentAngle / 2
        const fullRotations = 5 + Math.floor(Math.random() * 3)
        setRotation(rotation + (fullRotations * 360) + targetAngle - (rotation % 360))
      } else {
        // Manual mode without target - spin infinitely
        setIsInfiniteSpinning(true)
      }
    } else if (!isSpinning && previousSpinning.current) {
      // Spin stopped
      setIsInfiniteSpinning(false)
      // Fade out custom audio when stopping
      if (customAudioRef.current && !customAudioRef.current.paused) {
        fadeOutAudio(customAudioRef.current, 500)
      }
      setTimeout(() => { setShowResult(true); setShowConfetti(true) }, 300)
    }
    previousSpinning.current = isSpinning
  }, [isSpinning, availableSegments.length, rotation, audioSettings, fadeOutAudio])

  // Handle spinToIndex change during spinning (manual mode stop)
  useEffect(() => {
    if (isSpinning && spinToIndex !== undefined && previousSpinToIndex.current === undefined) {
      // User clicked stop - animate to target
      setIsInfiniteSpinning(false)
      const segmentAngle = 360 / availableSegments.length
      const targetAngle = 360 - (spinToIndex * segmentAngle) - segmentAngle / 2
      const fullRotations = 2 + Math.floor(Math.random() * 2) // Fewer rotations for deceleration
      setRotation(rotation + (fullRotations * 360) + targetAngle - (rotation % 360))
    }
    previousSpinToIndex.current = spinToIndex
  }, [spinToIndex, isSpinning, availableSegments.length, rotation])

  const wheelSegments = useMemo(() => {
    const cx = 200, cy = 200, r = 170, count = availableSegments.length
    if (count === 0) return []
    const anglePerSegment = (2 * Math.PI) / count
    return availableSegments.map((segment, index) => {
      const startAngle = index * anglePerSegment - Math.PI / 2
      const endAngle = startAngle + anglePerSegment
      const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle)
      const largeArcFlag = anglePerSegment > Math.PI ? 1 : 0
      const pathData = [`M ${cx} ${cy}`, `L ${x1} ${y1}`, `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`, 'Z'].join(' ')
      const textAngle = startAngle + anglePerSegment / 2
      const textRadius = r * 0.6
      const textX = cx + textRadius * Math.cos(textAngle)
      const textY = cy + textRadius * Math.sin(textAngle)
      const textRotation = (textAngle * 180) / Math.PI + 90
      return { id: segment.id, pathData, color: segment.color, text: segment.text, textX, textY, textRotation }
    })
  }, [availableSegments])

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* FOND PREMIUM */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2a] to-[#0a1a2a]">
        {/* Particules */}
        {PARTICLES.map((p) => (
          <motion.div key={p.id} className="absolute rounded-full bg-[#D4AF37]"
            style={{ width: p.size, height: p.size, left: `${p.x}%`, bottom: '-20px' }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: [0, -windowHeight - 100], opacity: [0, 0.6, 0.6, 0] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }} />
        ))}
        {/* Halo central */}
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.3) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }} />
      </div>

      {/* CONTENU PRINCIPAL */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center py-8">
        {/* TITRE PREMIUM */}
        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-black tracking-wider"
            style={{ textShadow: '0 0 10px #D4AF37, 0 0 20px #D4AF37, 0 0 40px #D4AF37, 0 0 80px #D4AF37' }}>
            <span className="text-white">ROUE DE LA</span>
            <span className="text-[#D4AF37]"> DESTINÉE</span>
          </h1>
          <p className="text-gray-300 mt-3 text-base md:text-lg tracking-widest uppercase">
            Tournez la roue et découvrez votre défi !
          </p>
        </motion.div>

        {/* ROUE */}
        <div className="relative">
          {/* Ombre */}
          <div className="absolute inset-0 rounded-full blur-3xl opacity-50"
            style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.8) 0%, transparent 70%)', transform: 'translateY(20px) scale(1.1)' }} />

          {/* Fleche premium */}
          <motion.div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 z-30"
            animate={isSpinning ? { y: [-6, 0, -6] } : {}}
            transition={{ duration: 0.3, repeat: Infinity }}>
            <div className="absolute inset-0 blur-md"
              style={{ background: 'linear-gradient(to bottom, #D4AF37, #FFD700)', clipPath: 'polygon(50% 100%, 0 0, 100% 0)', width: '60px', height: '75px' }} />
            <div className="relative w-14 h-[70px]"
              style={{ background: 'linear-gradient(to bottom, #F4D03F, #D4AF37, #B8960C)', clipPath: 'polygon(50% 100%, 0 0, 100% 0)', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} />
          </motion.div>

          {/* LA ROUE SVG */}
          <motion.div
            animate={{ rotate: isInfiniteSpinning ? [rotation, rotation + 360] : rotation }}
            transition={
              isInfiniteSpinning
                ? { duration: 1, repeat: Infinity, ease: 'linear' }
                : { duration: isSpinning ? 3 : 0, ease: isSpinning ? [0.2, 0.8, 0.2, 1] : 'linear' }
            }
            className="relative">
            <svg width="550" height="550" viewBox="0 0 400 400" className="drop-shadow-2xl">
              <defs>
                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F4D03F" />
                  <stop offset="50%" stopColor="#D4AF37" />
                  <stop offset="100%" stopColor="#B8960C" />
                </linearGradient>
                <radialGradient id="centerGradient" cx="50%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#F4D03F" />
                  <stop offset="50%" stopColor="#D4AF37" />
                  <stop offset="100%" stopColor="#8B7500" />
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {/* Bordure doree */}
              <circle cx="200" cy="200" r="198" fill="none" stroke="#1a1a1a" strokeWidth="4" />
              <circle cx="200" cy="200" r="192" fill="none" stroke="url(#goldGradient)" strokeWidth="12" filter="url(#glow)" />
              <circle cx="200" cy="200" r="182" fill="none" stroke="#0a0a0a" strokeWidth="6" />
              {/* LEDs */}
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * 15 - 90) * (Math.PI / 180)
                const x = 200 + 188 * Math.cos(angle)
                const y = 200 + 188 * Math.sin(angle)
                return <circle key={i} cx={x} cy={y} r="4" fill={i % 2 === 0 ? '#D4AF37' : '#FFD700'} opacity={isSpinning ? 1 : 0.6} />
              })}
              {/* Segments */}
              {wheelSegments.map((seg) => (
                <g key={seg.id}>
                  <path d={seg.pathData} fill={seg.color} stroke="#1A1A1E" strokeWidth="2" />
                  <text x={seg.textX} y={seg.textY} fill="white" fontSize="13" fontWeight="bold"
                    textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(${seg.textRotation}, ${seg.textX}, ${seg.textY})`}
                    style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.9)', fontFamily: 'Arial Black, sans-serif' }}>
                    {seg.text.length > 12 ? seg.text.substring(0, 12) + '...' : seg.text}
                  </text>
                </g>
              ))}
              {/* Centre premium */}
              <circle cx="200" cy="200" r="45" fill="#1a1a1a" />
              <circle cx="200" cy="200" r="40" fill="url(#centerGradient)" filter="url(#glow)" />
              <ellipse cx="195" cy="190" rx="20" ry="12" fill="rgba(255,255,255,0.3)" />
              <circle cx="200" cy="200" r="20" fill="#1a1a1a" />
              <circle cx="200" cy="200" r="15" fill="url(#centerGradient)" />
            </svg>
          </motion.div>

          {/* Effet brillance rotatif */}
          <motion.div className="absolute inset-0 pointer-events-none" animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-40 opacity-30"
              style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.8), transparent)', filter: 'blur(10px)' }} />
          </motion.div>

          {/* Indicateur rotation */}
          <AnimatePresence>
            {isSpinning && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="absolute -bottom-20 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-3 px-6 py-3 rounded-full"
                  style={{ background: 'linear-gradient(to right, rgba(212,175,55,0.2), rgba(212,175,55,0.3), rgba(212,175,55,0.2))', border: '2px solid #D4AF37', boxShadow: '0 0 20px rgba(212,175,55,0.4)' }}>
                  <motion.div className="w-3 h-3 bg-green-500 rounded-full"
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    style={{ boxShadow: '0 0 10px #22c55e' }} />
                  <span className="text-white font-bold uppercase tracking-wider">Rotation en cours...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* CONFETTIS */}
      <AnimatePresence>
        {showConfetti && (
          <>
            {[...Array(80)].map((_, i) => {
              const randX = Math.random() * 100
              const randW = 8 + Math.random() * 8
              const randH = 8 + Math.random() * 8
              const randRot = Math.random() * 720
              const randDur = 3 + Math.random() * 2
              const randDelay = Math.random() * 1.5
              const isRound = Math.random() > 0.5
              return (
                <motion.div key={i} className="absolute"
                  style={{ left: `${randX}%`, top: '-20px', width: randW, height: randH,
                    backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length], borderRadius: isRound ? '50%' : '0%' }}
                  initial={{ y: -50, rotate: 0, opacity: 1 }}
                  animate={{ y: windowHeight + 100, rotate: randRot, opacity: [1, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: randDur, delay: randDelay, ease: 'linear' }} />
              )
            })}
          </>
        )}
      </AnimatePresence>

      {/* POPUP RESULTAT */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50">
            <motion.div className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%]"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, transparent 50%)' }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }} />
            <motion.div initial={{ scale: 0.5, y: 100 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 15 }} className="relative z-10 mx-4">
              <div className="relative bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a] rounded-3xl p-8 md:p-12 text-center max-w-lg"
                style={{ boxShadow: '0 0 60px rgba(212,175,55,0.5)', border: '4px solid #D4AF37' }}>
                <motion.div className="absolute inset-0 rounded-3xl" style={{ border: '4px solid #D4AF37' }}
                  animate={{ boxShadow: ['0 0 0 0 rgba(212, 175, 55, 0)', '0 0 0 20px rgba(212, 175, 55, 0.3)', '0 0 0 40px rgba(212, 175, 55, 0)'] }}
                  transition={{ duration: 1.5, repeat: Infinity }} />
                <motion.div initial={{ scale: 0 }} animate={{ rotate: [0, -15, 15, -10, 10, 0], scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }} className="text-7xl md:text-8xl mb-6">🎉</motion.div>
                <motion.p className="text-gray-400 text-sm md:text-base uppercase tracking-[0.3em] mb-3"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>Le sort a choisi</motion.p>
                <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  className="text-3xl md:text-4xl font-black"
                  style={{ color: '#D4AF37', textShadow: '0 0 20px rgba(212,175,55,0.8), 0 0 40px rgba(212,175,55,0.4)' }}>{result}</motion.h2>
                <motion.div className="flex justify-center gap-2 mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                  {[...Array(5)].map((_, i) => (
                    <motion.div key={i} className="w-2 h-2 rounded-full bg-[#D4AF37]"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }} />
                  ))}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ÉCRAN DE FIN - TOUS LES SEGMENTS UTILISÉS */}
      <AnimatePresence>
        {showFinished && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50">
            <motion.div className="absolute inset-0 bg-black/90 backdrop-blur-md"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} />

            {/* Effet radial doré */}
            <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%]"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.3) 0%, transparent 40%)' }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }} />

            <motion.div className="relative z-10 text-center px-8" initial={{ scale: 0.5, y: 50 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 12 }}>

              {/* Trophée animé */}
              <motion.div className="text-[120px] md:text-[180px] mb-4"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2, damping: 10 }}>
                🏆
              </motion.div>

              {/* Titre */}
              <motion.h1 className="text-5xl md:text-7xl font-black mb-4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{ color: '#D4AF37', textShadow: '0 0 30px #D4AF37, 0 0 60px #D4AF37, 0 0 90px #D4AF37' }}>
                FÉLICITATIONS !
              </motion.h1>

              <motion.p className="text-2xl md:text-3xl text-white mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
                Tous les défis ont été relevés !
              </motion.p>

              <motion.p className="text-lg text-gray-400 uppercase tracking-widest"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}>
                La roue de la destinée est terminée
              </motion.p>

              {/* Étoiles décoratives */}
              <motion.div className="flex justify-center gap-4 mt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}>
                {[...Array(5)].map((_, i) => (
                  <motion.span key={i} className="text-4xl"
                    animate={{ scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}>
                    ⭐
                  </motion.span>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Default tick sound (fallback) */}
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/tick.mp3" type="audio/mpeg" />
      </audio>

      {/* Custom audio for wheel spin */}
      {audioSettings?.url && (
        <audio ref={customAudioRef} preload="auto" src={audioSettings.url} />
      )}
    </div>
  )
}
