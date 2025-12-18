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

// Couleurs casino alternées: bordeaux, orange, bleu royal, argenté
const CASINO_COLORS = ['#8B0000', '#FF8C00', '#1E40AF', '#E8E8E8']

const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  id: i, delay: Math.random() * 5, duration: 6 + Math.random() * 4,
  x: Math.random() * 100, size: 2 + Math.random() * 4,
}))

const CONFETTI_COLORS = ['#D4AF37', '#F4D03F', '#FFFFFF', '#FFD700', '#FF6B6B', '#8B0000']

// Ampoules autour du cadre
const BULBS = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  angle: (i * 360 / 32 - 90) * (Math.PI / 180),
}))

export default function WheelGame({ segments, isSpinning, result, spinToIndex, usedSegmentIds = [], isGameFinished = false, audioSettings, spinMode = 'auto' }: WheelGameProps) {
  const [rotation, setRotation] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFinished, setShowFinished] = useState(false)
  const [isInfiniteSpinning, setIsInfiniteSpinning] = useState(false)
  const [bulbPhase, setBulbPhase] = useState(0)
  const previousSpinning = useRef(false)
  const previousSpinToIndex = useRef<number | undefined>(undefined)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const customAudioRef = useRef<HTMLAudioElement | null>(null)
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const infiniteRotationRef = useRef(0)
  const [windowHeight, setWindowHeight] = useState(800)

  // Animation des ampoules
  useEffect(() => {
    const interval = setInterval(() => {
      setBulbPhase(prev => (prev + 1) % 4)
    }, 300)
    return () => clearInterval(interval)
  }, [])

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
        audio.volume = initialVolume
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

  // Afficher l'écran de fin quand le jeu est terminé
  useEffect(() => {
    if (isGameFinished) {
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

      if (audioSettings?.enabled && audioSettings?.url && customAudioRef.current) {
        customAudioRef.current.currentTime = 0
        customAudioRef.current.volume = 1
        customAudioRef.current.loop = true
        customAudioRef.current.play().catch(() => {})
      } else if (audioRef.current) {
        audioRef.current.play().catch(() => {})
      }

      if (spinToIndex !== undefined) {
        setIsInfiniteSpinning(false)
        const segmentAngle = 360 / availableSegments.length
        const targetAngle = 360 - (spinToIndex * segmentAngle) - segmentAngle / 2
        const fullRotations = 5 + Math.floor(Math.random() * 3)
        setRotation(rotation + (fullRotations * 360) + targetAngle - (rotation % 360))
      } else {
        setIsInfiniteSpinning(true)
      }
    } else if (!isSpinning && previousSpinning.current) {
      setIsInfiniteSpinning(false)
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
      setIsInfiniteSpinning(false)
      const segmentAngle = 360 / availableSegments.length
      const targetAngle = 360 - (spinToIndex * segmentAngle) - segmentAngle / 2
      const fullRotations = 2 + Math.floor(Math.random() * 2)
      setRotation(rotation + (fullRotations * 360) + targetAngle - (rotation % 360))
    }
    previousSpinToIndex.current = spinToIndex
  }, [spinToIndex, isSpinning, availableSegments.length, rotation])

  const wheelSegments = useMemo(() => {
    const cx = 200, cy = 200, r = 160, count = availableSegments.length
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
      // Utiliser les couleurs casino alternées
      const casinoColor = CASINO_COLORS[index % CASINO_COLORS.length]
      return { id: segment.id, pathData, color: casinoColor, text: segment.text, textX, textY, textRotation }
    })
  }, [availableSegments])

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* FOND VIOLET/MAUVE GRADIENT */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #2D1B4E 0%, #4A1F6E 25%, #6B2D8E 50%, #4A1F6E 75%, #2D1B4E 100%)' }}>
        {/* Étoiles scintillantes */}
        {PARTICLES.map((p) => (
          <motion.div key={p.id} className="absolute"
            style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${Math.random() * 100}%` }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0, 1, 1, 0],
              rotate: [0, 180, 360]
            }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}>
            <svg viewBox="0 0 24 24" fill="#FFD700" className="w-full h-full drop-shadow-[0_0_4px_#FFD700]">
              <path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41L12 0Z" />
            </svg>
          </motion.div>
        ))}

        {/* Halo lumineux central */}
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.15) 0%, rgba(139,0,0,0.1) 40%, transparent 70%)' }}
          animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 3, repeat: Infinity }} />
      </div>

      {/* CONTENU PRINCIPAL */}
      <div className="relative z-10 h-full flex flex-col items-center justify-start pt-6 pb-8">
        {/* TITRE PREMIUM */}
        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-6">
          <h1 className="text-4xl md:text-6xl font-black tracking-wider"
            style={{
              color: '#FFD700',
              textShadow: '0 0 10px #FFD700, 0 0 20px #FFD700, 0 0 40px #FF6B00, 0 4px 0 #8B6914, 0 5px 10px rgba(0,0,0,0.5)'
            }}>
            ROUE DE LA DESTINÉE
          </h1>
          <p className="text-white/80 mt-2 text-base md:text-lg tracking-widest uppercase"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
            Tournez et découvrez votre destin !
          </p>
        </motion.div>

        {/* CONTAINER ROUE AVEC SOCLE */}
        <div className="relative mt-4">
          {/* SOCLE/PIED ROUGE */}
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-80 h-20">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-16"
              style={{
                background: 'linear-gradient(to bottom, #8B0000 0%, #5C0000 50%, #3D0000 100%)',
                borderRadius: '0 0 20px 20px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.2)'
              }} />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-8"
              style={{
                background: 'linear-gradient(to bottom, #A00000 0%, #6B0000 100%)',
                borderRadius: '0 0 10px 10px',
                boxShadow: '0 5px 15px rgba(0,0,0,0.4)'
              }} />
            {/* Vis décoratives */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-40">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#8B7500] shadow-lg" />
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#8B7500] shadow-lg" />
            </div>
          </div>

          {/* CADRE ROUGE AVEC AMPOULES */}
          <div className="relative">
            {/* Ombre de la roue */}
            <div className="absolute inset-0 rounded-full blur-3xl opacity-40"
              style={{ background: 'radial-gradient(circle, rgba(139,0,0,0.8) 0%, transparent 70%)', transform: 'translateY(30px) scale(1.15)' }} />

            {/* Cadre extérieur rouge */}
            <div className="absolute -inset-8 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #B22222 0%, #8B0000 30%, #5C0000 70%, #8B0000 100%)',
                boxShadow: '0 0 40px rgba(139,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.5)'
              }}>
              {/* Ampoules lumineuses */}
              {BULBS.map((bulb, i) => {
                const x = 50 + 47 * Math.cos(bulb.angle)
                const y = 50 + 47 * Math.sin(bulb.angle)
                const isLit = (i + bulbPhase) % 2 === 0
                return (
                  <motion.div key={bulb.id}
                    className="absolute w-4 h-4 rounded-full"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      background: isLit
                        ? 'radial-gradient(circle, #FFFF00 0%, #FFD700 50%, #FFA500 100%)'
                        : 'radial-gradient(circle, #8B7500 0%, #5C4000 50%, #3D2900 100%)',
                      boxShadow: isLit
                        ? '0 0 15px #FFD700, 0 0 30px #FFA500, 0 0 45px rgba(255,165,0,0.5)'
                        : '0 0 5px rgba(139,117,0,0.3)',
                    }}
                    animate={isLit ? {
                      boxShadow: [
                        '0 0 15px #FFD700, 0 0 30px #FFA500',
                        '0 0 20px #FFD700, 0 0 40px #FFA500',
                        '0 0 15px #FFD700, 0 0 30px #FFA500'
                      ]
                    } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )
              })}
            </div>

            {/* Flèche/Indicateur doré premium */}
            <motion.div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-10 z-30"
              animate={isSpinning ? { y: [-10, -6, -10] } : {}}
              transition={{ duration: 0.15, repeat: Infinity }}>
              {/* Glow de la flèche */}
              <div className="absolute inset-0 blur-lg opacity-70"
                style={{
                  background: 'linear-gradient(to bottom, #FFD700, #D4AF37)',
                  clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                  width: '70px',
                  height: '85px',
                  transform: 'translateX(-5px)'
                }} />
              {/* Flèche principale */}
              <div className="relative w-[60px] h-[75px]"
                style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 40%, #B8960C 70%, #8B7500 100%)',
                  clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                  filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.6))',
                  border: '3px solid #8B7500'
                }}>
                {/* Reflet sur la flèche */}
                <div className="absolute top-2 left-2 w-4 h-8 opacity-50"
                  style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.8), transparent)', clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
              </div>
            </motion.div>

            {/* LA ROUE SVG */}
            <motion.div
              animate={{ rotate: isInfiniteSpinning ? [rotation, rotation + 360] : rotation }}
              transition={
                isInfiniteSpinning
                  ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
                  : { duration: isSpinning ? 8 : 0, ease: isSpinning ? [0.2, 0.8, 0.2, 1] : 'linear' }
              }
              className="relative">
              <svg width="550" height="550" viewBox="0 0 400 400" className="drop-shadow-2xl">
                <defs>
                  <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFD700" />
                    <stop offset="50%" stopColor="#D4AF37" />
                    <stop offset="100%" stopColor="#B8960C" />
                  </linearGradient>
                  <radialGradient id="centerGradient" cx="50%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#FFD700" />
                    <stop offset="40%" stopColor="#D4AF37" />
                    <stop offset="100%" stopColor="#8B7500" />
                  </radialGradient>
                  <radialGradient id="centerHighlight" cx="30%" cy="30%" r="60%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <filter id="innerShadow">
                    <feOffset dx="0" dy="2"/>
                    <feGaussianBlur stdDeviation="3"/>
                    <feComposite operator="out" in="SourceGraphic"/>
                    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.4 0"/>
                    <feBlend in2="SourceGraphic" mode="normal"/>
                  </filter>
                </defs>

                {/* Bordure extérieure métallique */}
                <circle cx="200" cy="200" r="185" fill="none" stroke="#2a2a2a" strokeWidth="6" />
                <circle cx="200" cy="200" r="180" fill="none" stroke="url(#goldGradient)" strokeWidth="10" filter="url(#glow)" />
                <circle cx="200" cy="200" r="172" fill="none" stroke="#1a1a1a" strokeWidth="4" />

                {/* Segments de la roue */}
                {wheelSegments.map((seg, i) => (
                  <g key={seg.id}>
                    <path d={seg.pathData} fill={seg.color} stroke="#1A1A1E" strokeWidth="2" />
                    {/* Effet de brillance sur chaque segment */}
                    <path d={seg.pathData} fill="url(#centerHighlight)" opacity="0.3" />
                    {/* Numéro du segment au lieu du texte */}
                    <text x={seg.textX} y={seg.textY}
                      fill={seg.color === '#E8E8E8' ? '#1A1A1E' : 'white'}
                      fontSize="28"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${seg.textRotation}, ${seg.textX}, ${seg.textY})`}
                      style={{
                        textShadow: seg.color === '#E8E8E8' ? 'none' : '2px 2px 4px rgba(0,0,0,0.9)',
                        fontFamily: 'Arial Black, sans-serif'
                      }}>
                      {i + 1}
                    </text>
                  </g>
                ))}

                {/* Centre de la roue - Bouton doré 3D */}
                <circle cx="200" cy="200" r="55" fill="#1a1a1a" />
                <circle cx="200" cy="200" r="50" fill="url(#centerGradient)" filter="url(#glow)" />
                {/* Reflet 3D */}
                <ellipse cx="190" cy="185" rx="25" ry="15" fill="rgba(255,255,255,0.35)" />
                {/* Cercle central */}
                <circle cx="200" cy="200" r="28" fill="#1a1a1a" />
                <circle cx="200" cy="200" r="23" fill="url(#centerGradient)" />
                <ellipse cx="195" cy="193" rx="12" ry="8" fill="rgba(255,255,255,0.3)" />
                {/* Point central */}
                <circle cx="200" cy="200" r="8" fill="#1a1a1a" />
                <circle cx="200" cy="200" r="5" fill="#D4AF37" />
              </svg>
            </motion.div>
          </div>

          {/* Indicateur rotation */}
          <AnimatePresence>
            {isSpinning && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="absolute -bottom-24 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-3 px-6 py-3 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139,0,0,0.8), rgba(90,0,0,0.9))',
                    border: '2px solid #D4AF37',
                    boxShadow: '0 0 20px rgba(212,175,55,0.4), 0 5px 15px rgba(0,0,0,0.4)'
                  }}>
                  <motion.div className="w-3 h-3 bg-[#FFD700] rounded-full"
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.4, repeat: Infinity }}
                    style={{ boxShadow: '0 0 10px #FFD700' }} />
                  <span className="text-white font-bold uppercase tracking-wider">La roue tourne...</span>
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
            {[...Array(100)].map((_, i) => {
              const randX = Math.random() * 100
              const randW = 8 + Math.random() * 12
              const randH = 8 + Math.random() * 12
              const randRot = Math.random() * 720
              const randDur = 3 + Math.random() * 2
              const randDelay = Math.random() * 1.5
              const isRound = Math.random() > 0.6
              const isStar = Math.random() > 0.85
              return (
                <motion.div key={i} className="absolute"
                  style={{ left: `${randX}%`, top: '-20px', width: randW, height: randH,
                    backgroundColor: isStar ? 'transparent' : CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    borderRadius: isRound ? '50%' : '0%' }}
                  initial={{ y: -50, rotate: 0, opacity: 1 }}
                  animate={{ y: windowHeight + 100, rotate: randRot, opacity: [1, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: randDur, delay: randDelay, ease: 'linear' }}>
                  {isStar && (
                    <svg viewBox="0 0 24 24" fill="#FFD700" className="w-full h-full">
                      <path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41L12 0Z" />
                    </svg>
                  )}
                </motion.div>
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
            <motion.div className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%]"
              style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(139,0,0,0.2) 30%, transparent 50%)' }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }} />
            <motion.div initial={{ scale: 0.5, y: 100 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 15 }} className="relative z-10 mx-4">
              <div className="relative rounded-3xl p-8 md:p-12 text-center max-w-lg"
                style={{
                  background: 'linear-gradient(135deg, #4A1F6E 0%, #2D1B4E 50%, #1A0F2E 100%)',
                  boxShadow: '0 0 60px rgba(212,175,55,0.5), 0 0 100px rgba(139,0,0,0.3)',
                  border: '4px solid #D4AF37'
                }}>
                <motion.div className="absolute inset-0 rounded-3xl" style={{ border: '4px solid #D4AF37' }}
                  animate={{ boxShadow: ['0 0 0 0 rgba(212, 175, 55, 0)', '0 0 0 20px rgba(212, 175, 55, 0.3)', '0 0 0 40px rgba(212, 175, 55, 0)'] }}
                  transition={{ duration: 1.5, repeat: Infinity }} />
                <motion.div initial={{ scale: 0 }} animate={{ rotate: [0, -15, 15, -10, 10, 0], scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }} className="text-7xl md:text-8xl mb-6">🎰</motion.div>
                <motion.p className="text-white/70 text-sm md:text-base uppercase tracking-[0.3em] mb-3"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>Le destin a choisi</motion.p>
                <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  className="text-3xl md:text-4xl font-black"
                  style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255,215,0,0.8), 0 0 40px rgba(255,215,0,0.4)' }}>{result}</motion.h2>
                <motion.div className="flex justify-center gap-2 mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                  {[...Array(5)].map((_, i) => (
                    <motion.div key={i} className="text-2xl"
                      animate={{ scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}>
                      ⭐
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ÉCRAN DE FIN */}
      <AnimatePresence>
        {showFinished && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50">
            <motion.div className="absolute inset-0 bg-black/90 backdrop-blur-md"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} />

            <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%]"
              style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.25) 0%, rgba(139,0,0,0.15) 30%, transparent 50%)' }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }} />

            <motion.div className="relative z-10 text-center px-8" initial={{ scale: 0.5, y: 50 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 12 }}>

              <motion.div className="text-[120px] md:text-[180px] mb-4"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2, damping: 10 }}>
                🎰
              </motion.div>

              <motion.h1 className="text-5xl md:text-7xl font-black mb-4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{ color: '#FFD700', textShadow: '0 0 30px #FFD700, 0 0 60px #FFD700, 0 0 90px #FF6B00' }}>
                FÉLICITATIONS !
              </motion.h1>

              <motion.p className="text-2xl md:text-3xl text-white mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
                Tous les défis ont été relevés !
              </motion.p>

              <motion.p className="text-lg text-white/60 uppercase tracking-widest"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}>
                La roue de la destinée est terminée
              </motion.p>

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
