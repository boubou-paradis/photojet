'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize, Minimize } from 'lucide-react'
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

// Rouge, violet, noir, bleu, gris — style casino photo
const CASINO_COLORS = ['#C0392B', '#4A1993', '#0D0D1A', '#1A3A8A', '#C8C8C8']

const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i, delay: Math.random() * 5, duration: 5 + Math.random() * 4,
  x: Math.random() * 100, size: 4 + Math.random() * 8,
}))

// Ampoules autour du cadre doré
const BULBS = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  angle: (i * 360 / 28 - 90) * (Math.PI / 180),
}))

const CONFETTI_COLORS = ['#D4AF37', '#F4D03F', '#FFFFFF', '#FFD700', '#FF6B6B', '#8B0000']

export default function WheelGame({ segments, isSpinning, result, spinToIndex, usedSegmentIds = [], isGameFinished = false, audioSettings, spinMode = 'auto' }: WheelGameProps) {
  const [rotation, setRotation] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFinished, setShowFinished] = useState(false)
  const [isInfiniteSpinning, setIsInfiniteSpinning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [bulbPhase, setBulbPhase] = useState(0)
  const previousSpinning = useRef(false)
  const previousSpinToIndex = useRef<number | undefined>(undefined)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const customAudioRef = useRef<HTMLAudioElement | null>(null)
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const infiniteRotationRef = useRef(0)
  const [windowHeight, setWindowHeight] = useState(800)

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
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Clignotement des ampoules
  useEffect(() => {
    const interval = setInterval(() => setBulbPhase(prev => (prev + 1) % 4), 350)
    return () => clearInterval(interval)
  }, [])

  const fadeOutAudio = useCallback((audio: HTMLAudioElement, duration: number = 500) => {
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
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
        if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null }
      }
    }, stepTime)
  }, [])

  const availableSegments = useMemo(() =>
    segments.filter(s => !usedSegmentIds.includes(s.id)),
    [segments, usedSegmentIds]
  )

  useEffect(() => { setWindowHeight(window.innerHeight) }, [])

  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
      if (customAudioRef.current) customAudioRef.current.pause()
    }
  }, [])

  useEffect(() => {
    if (isGameFinished) {
      const timer = setTimeout(() => { setShowFinished(true); setShowConfetti(true) }, 6000)
      return () => clearTimeout(timer)
    }
  }, [isGameFinished])

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
      if (customAudioRef.current && !customAudioRef.current.paused && spinMode !== 'manual') {
        fadeOutAudio(customAudioRef.current, 500)
      }
      setTimeout(() => { setShowResult(true); setShowConfetti(true) }, 100)
    }
    previousSpinning.current = isSpinning
  }, [isSpinning, availableSegments.length, rotation, audioSettings, fadeOutAudio, spinMode])

  const [isManualStop, setIsManualStop] = useState(false)
  useEffect(() => {
    if (isSpinning && spinToIndex !== undefined && previousSpinToIndex.current === undefined) {
      setIsInfiniteSpinning(false)
      setIsManualStop(true)
      const segmentAngle = 360 / availableSegments.length
      const targetAngle = 360 - (spinToIndex * segmentAngle) - segmentAngle / 2
      const fullRotations = 1 + Math.floor(Math.random() * 1)
      setRotation(rotation + (fullRotations * 360) + targetAngle - (rotation % 360))
      if (customAudioRef.current && !customAudioRef.current.paused) {
        customAudioRef.current.pause()
        customAudioRef.current.currentTime = 0
      }
    }
    if (!isSpinning) setIsManualStop(false)
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
      return { id: segment.id, pathData, color: CASINO_COLORS[index % CASINO_COLORS.length], text: segment.text, textX, textY, textRotation }
    })
  }, [availableSegments])

  return (
    <div className="fixed inset-0 overflow-hidden">

      {/* FOND VIOLET FONCÉ + PROJECTEURS */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a0040 0%, #0a0018 50%, #05000e 100%)' }}>

        {/* Projecteur gauche */}
        <div className="absolute bottom-0 left-0 pointer-events-none"
          style={{
            width: '50%', height: '85%',
            background: 'linear-gradient(to top right, rgba(100,0,200,0.25) 0%, transparent 60%)',
            clipPath: 'polygon(0% 100%, 40% 100%, 100% 0%, 0% 0%)',
          }} />
        {/* Projecteur droit */}
        <div className="absolute bottom-0 right-0 pointer-events-none"
          style={{
            width: '50%', height: '85%',
            background: 'linear-gradient(to top left, rgba(100,0,200,0.25) 0%, transparent 60%)',
            clipPath: 'polygon(60% 100%, 100% 100%, 100% 0%, 0% 0%)',
          }} />

        {/* Reflet sol */}
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(100,0,200,0.12), transparent)' }} />

        {/* Confettis dorés flottants */}
        {PARTICLES.map((p) => (
          <motion.div key={p.id} className="absolute rounded-sm"
            style={{ width: p.size * 0.6, height: p.size, left: `${p.x}%`, top: `-${p.size}px`, backgroundColor: CONFETTI_COLORS[p.id % CONFETTI_COLORS.length], opacity: 0.7 }}
            animate={{ y: windowHeight + 50, rotate: [0, 180, 360], x: [0, 30, -20, 0] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }} />
        ))}
      </div>

      {/* Bouton plein écran */}
      <motion.button onClick={toggleFullscreen} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        whileHover={{ scale: 1.1 }} transition={{ duration: 0.3 }}
        className="absolute top-4 right-4 z-50 p-3 bg-black/50 hover:bg-black/70 border border-[#D4AF37]/30 rounded-full transition-colors backdrop-blur-sm"
        title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
        {isFullscreen ? <Minimize className="h-6 w-6 text-[#D4AF37]" /> : <Maximize className="h-6 w-6 text-[#D4AF37]" />}
      </motion.button>

      {/* CONTENU PRINCIPAL */}
      <div className="relative z-10 h-full flex flex-col items-center justify-start pt-6 pb-8">

        {/* TITRE */}
        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-6">
          <h1 className="text-4xl md:text-6xl font-black tracking-wider"
            style={{ color: '#FFD700', textShadow: '0 0 10px #FFD700, 0 0 20px #FFD700, 0 0 40px #FF6B00, 0 4px 0 #8B6914, 0 5px 10px rgba(0,0,0,0.5)' }}>
            ROUE DE LA DESTINÉE
          </h1>
          <p className="text-white/80 mt-2 text-base md:text-lg tracking-widest uppercase"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
            Tournez et découvrez votre destin !
          </p>
        </motion.div>

        {/* ROUE + SOCLE */}
        <div className="relative mt-4">

          {/* SOCLE CIRCULAIRE DORÉ */}
          <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center">
            {/* Disque supérieur */}
            <div style={{
              width: '320px', height: '36px',
              background: 'linear-gradient(to bottom, #F0D060 0%, #C9A227 40%, #A07A10 100%)',
              borderRadius: '50%',
              boxShadow: '0 6px 24px rgba(212,175,55,0.5), inset 0 2px 0 rgba(255,255,255,0.3)',
              border: '2px solid #E5C84A',
            }} />
            {/* Disque inférieur plus large */}
            <div style={{
              width: '380px', height: '28px',
              marginTop: '-10px',
              background: 'linear-gradient(to bottom, #D4AF37 0%, #9A7A10 60%, #6B5500 100%)',
              borderRadius: '50%',
              boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            }} />
          </div>

          {/* CADRE DORÉ AVEC AMPOULES */}
          <div className="relative">
            {/* Ombre portée */}
            <div className="absolute inset-0 rounded-full blur-3xl opacity-50"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, transparent 70%)', transform: 'translateY(30px) scale(1.2)' }} />

            {/* Anneau doré + ampoules */}
            <div className="absolute -inset-8 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #F0D060 0%, #D4AF37 25%, #A07810 55%, #D4AF37 80%, #F0D060 100%)',
                boxShadow: '0 0 40px rgba(212,175,55,0.5), 0 0 80px rgba(212,175,55,0.15), inset 0 0 20px rgba(0,0,0,0.4)'
              }}>
              {/* Filets décoratifs intérieurs */}
              <div className="absolute inset-3 rounded-full border-2 border-[#8B7500]/40" />

              {/* Ampoules ambrées */}
              {BULBS.map((bulb, i) => {
                const x = 50 + 47 * Math.cos(bulb.angle)
                const y = 50 + 47 * Math.sin(bulb.angle)
                const isLit = (i + bulbPhase) % 2 === 0
                return (
                  <div key={bulb.id} className="absolute rounded-full"
                    style={{
                      width: '13px', height: '13px',
                      left: `${x}%`, top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      background: isLit
                        ? 'radial-gradient(circle, #FFF176 0%, #FFB300 55%, #FF8F00 100%)'
                        : 'radial-gradient(circle, #6B5200 0%, #3D2F00 100%)',
                      boxShadow: isLit ? '0 0 8px #FFB300, 0 0 18px rgba(255,179,0,0.6)' : 'none',
                      transition: 'all 0.15s ease',
                    }} />
                )
              })}
            </div>

            {/* Flèche dorée */}
            <motion.div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-10 z-30"
              animate={isSpinning ? { y: [-10, -6, -10] } : {}}
              transition={{ duration: 0.15, repeat: Infinity }}>
              <div className="absolute inset-0 blur-lg opacity-70"
                style={{ background: 'linear-gradient(to bottom, #FFD700, #D4AF37)', clipPath: 'polygon(50% 100%, 0 0, 100% 0)', width: '70px', height: '85px', transform: 'translateX(-5px)' }} />
              <div className="relative w-[60px] h-[75px]"
                style={{ background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 40%, #B8960C 70%, #8B7500 100%)', clipPath: 'polygon(50% 100%, 0 0, 100% 0)', filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.7))' }}>
                <div className="absolute top-2 left-2 w-4 h-8 opacity-50"
                  style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.8), transparent)', clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
              </div>
            </motion.div>

            {/* ROUE SVG */}
            <motion.div
              animate={{ rotate: isInfiniteSpinning ? [rotation, rotation + 360] : rotation }}
              transition={
                isInfiniteSpinning
                  ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
                  : { duration: isSpinning ? (isManualStop ? 3 : 8) : 0, ease: isSpinning ? [0.2, 0.8, 0.2, 1] : 'linear' }
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
                    <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>

                {/* Anneaux SVG extérieurs */}
                <circle cx="200" cy="200" r="178" fill="none" stroke="url(#goldGradient)" strokeWidth="12" filter="url(#glow)" />
                <circle cx="200" cy="200" r="168" fill="none" stroke="#7A6200" strokeWidth="2" />

                {/* Segments */}
                {wheelSegments.map((seg, i) => (
                  <g key={seg.id}>
                    <path d={seg.pathData} fill={seg.color} stroke="#D4AF37" strokeWidth="2.5" />
                    <path d={seg.pathData} fill="url(#centerHighlight)" opacity="0.12" />
                    <text
                      x={seg.textX} y={seg.textY}
                      fill={seg.color === '#C8C8C8' ? '#1a1a1a' : 'white'}
                      fontSize="26"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${seg.textRotation}, ${seg.textX}, ${seg.textY})`}
                      style={{ fontFamily: 'Arial Black, sans-serif', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))' }}>
                      {i + 1}
                    </text>
                  </g>
                ))}

                {/* Centre doré 3D */}
                <circle cx="200" cy="200" r="55" fill="#0a0014" />
                <circle cx="200" cy="200" r="50" fill="url(#centerGradient)" filter="url(#glow)" />
                <ellipse cx="190" cy="185" rx="24" ry="14" fill="rgba(255,255,255,0.35)" />
                <circle cx="200" cy="200" r="28" fill="#0a0014" />
                <circle cx="200" cy="200" r="23" fill="url(#centerGradient)" />
                <ellipse cx="195" cy="193" rx="11" ry="7" fill="rgba(255,255,255,0.3)" />
                <circle cx="200" cy="200" r="8" fill="#0a0014" />
                <circle cx="200" cy="200" r="5" fill="#FFD700" />
              </svg>
            </motion.div>
          </div>

          {/* Indicateur rotation */}
          <AnimatePresence>
            {isSpinning && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="absolute -bottom-24 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-3 px-6 py-3 rounded-full"
                  style={{ background: 'linear-gradient(135deg, rgba(50,0,100,0.9), rgba(20,0,50,0.95))', border: '2px solid #D4AF37', boxShadow: '0 0 20px rgba(212,175,55,0.4)' }}>
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
                  style={{ left: `${randX}%`, top: '-20px', width: randW, height: randH, backgroundColor: isStar ? 'transparent' : CONFETTI_COLORS[i % CONFETTI_COLORS.length], borderRadius: isRound ? '50%' : '0%' }}
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

      {/* POPUP RÉSULTAT */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50">
            <motion.div className="absolute inset-0 bg-black/85 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%]"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.25) 0%, rgba(80,0,160,0.15) 30%, transparent 50%)' }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }} />
            <motion.div initial={{ scale: 0.5, y: 100 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 15 }} className="relative z-10 mx-4">
              <div className="relative rounded-3xl p-8 md:p-12 text-center max-w-lg"
                style={{ background: 'linear-gradient(135deg, #1a0035 0%, #0d001f 50%, #080012 100%)', boxShadow: '0 0 60px rgba(212,175,55,0.5), 0 0 100px rgba(80,0,160,0.3)', border: '4px solid #D4AF37' }}>
                <motion.div className="absolute inset-0 rounded-3xl" style={{ border: '4px solid #D4AF37' }}
                  animate={{ boxShadow: ['0 0 0 0 rgba(212,175,55,0)', '0 0 0 20px rgba(212,175,55,0.3)', '0 0 0 40px rgba(212,175,55,0)'] }}
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
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}>⭐</motion.div>
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
            <motion.div className="absolute inset-0 bg-black/90 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            <motion.div className="relative z-10 text-center px-8" initial={{ scale: 0.5, y: 50 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 12 }}>
              <motion.div className="text-[120px] md:text-[180px] mb-4" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2, damping: 10 }}>🎰</motion.div>
              <motion.h1 className="text-5xl md:text-7xl font-black mb-4" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{ color: '#FFD700', textShadow: '0 0 30px #FFD700, 0 0 60px #FFD700, 0 0 90px #FF6B00' }}>
                FÉLICITATIONS !
              </motion.h1>
              <motion.p className="text-2xl md:text-3xl text-white mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }} style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
                Tous les défis ont été relevés !
              </motion.p>
              <motion.p className="text-lg text-white/60 uppercase tracking-widest" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}>La roue de la destinée est terminée</motion.p>
              <motion.div className="flex justify-center gap-4 mt-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                {[...Array(5)].map((_, i) => (
                  <motion.span key={i} className="text-4xl"
                    animate={{ scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}>⭐</motion.span>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={audioRef} preload="auto">
        <source src="/sounds/tick.mp3" type="audio/mpeg" />
      </audio>
      {audioSettings?.url && <audio ref={customAudioRef} preload="auto" src={audioSettings.url} />}
    </div>
  )
}
