'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
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

// 6 pierres précieuses — glossy premium (light = centre, base, dark = bord)
const GEMS = [
  { light: '#ef4d66', base: '#b3122e', dark: '#69091b' }, // 1 — Rubis
  { light: '#ffb24d', base: '#e07b1a', dark: '#964907' }, // 2 — Ambre
  { light: '#5fe0a6', base: '#1f9d63', dark: '#0c5c39' }, // 3 — Émeraude
  { light: '#5fb2f0', base: '#1f74bd', dark: '#0d4170' }, // 4 — Saphir
  { light: '#6a73d6', base: '#2b2f86', dark: '#161a47' }, // 5 — Bleu nuit
  { light: '#cd62e6', base: '#86209c', dark: '#4d0e63' }, // 6 — Améthyste
]

// Ampoules régulièrement espacées autour du cadre doré
const BULB_COUNT = 24
const BULBS = Array.from({ length: BULB_COUNT }, (_, i) => ({
  id: i,
  angle: (i * 360 / BULB_COUNT - 90) * (Math.PI / 180),
}))

const CONFETTI_COLORS = ['#d4af37', '#f4d03f', '#ffe9a3', '#ffffff', '#c9a227']
const SPIN_CSS_DURATION_MS = 8000

export default function WheelGame({ segments, isSpinning, result, spinToIndex, usedSegmentIds = [], isGameFinished = false, audioSettings, spinMode = 'auto' }: WheelGameProps) {
  const [rotation, setRotation] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFinished, setShowFinished] = useState(false)
  const [isInfiniteSpinning, setIsInfiniteSpinning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const previousSpinning = useRef(false)
  const previousSpinToIndex = useRef<number | undefined>(undefined)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const customAudioRef = useRef<HTMLAudioElement | null>(null)
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const spinStartTimeRef = useRef<number>(0)

  const toggleFullscreen = useCallback(async () => {
    // Mac : faux plein écran (le conteneur est déjà fixed inset-0). On n'appelle
    // JAMAIS l'API native qui crée un Space macOS → écran principal noir.
    if (isMac) {
      setIsFullscreen(prev => !prev)
      return
    }
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch { /* refusé par le navigateur */ }
  }, [isMac])

  // Détection Mac côté client (useEffect : navigator absent en SSR)
  useEffect(() => {
    setIsMac(/Mac/i.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent))
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Mac : Échap quitte le faux plein écran (pas de fullscreenchange natif à écouter)
  useEffect(() => {
    if (!isMac) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMac])

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

  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current)
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
      spinStartTimeRef.current = Date.now()
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
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current)
      if (spinMode === 'auto') {
        const elapsed = Date.now() - spinStartTimeRef.current
        const remainingMs = Math.max(0, SPIN_CSS_DURATION_MS - elapsed)
        resultTimeoutRef.current = setTimeout(() => { setShowResult(true); setShowConfetti(true) }, remainingMs + 50)
      } else {
        resultTimeoutRef.current = setTimeout(() => { setShowResult(true); setShowConfetti(true) }, 100)
      }
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
      const fullRotations = spinMode === 'auto' ? 3 : 1
      setRotation(rotation + (fullRotations * 360) + targetAngle - (rotation % 360))
      // En mode auto, l'audio continue pendant la décel et fade à la fin du spin
      if (spinMode !== 'auto' && customAudioRef.current && !customAudioRef.current.paused) {
        customAudioRef.current.pause()
        customAudioRef.current.currentTime = 0
      }
    }
    if (!isSpinning) setIsManualStop(false)
    previousSpinToIndex.current = spinToIndex
  }, [spinToIndex, isSpinning, availableSegments.length, rotation, spinMode])

  // ─── RENDU ────────────────────────────────────────────────────────────────
  const winningIndex = spinToIndex
  const winningNumber = winningIndex !== undefined ? winningIndex + 1 : null
  const winningGem = winningIndex !== undefined ? GEMS[winningIndex % GEMS.length] : GEMS[0]

  // Confettis dorés via canvas-confetti à l'apparition du résultat / de la fin
  useEffect(() => {
    if (!showConfetti) return
    const colors = CONFETTI_COLORS
    confetti({ particleCount: 150, spread: 105, startVelocity: 50, origin: { x: 0.5, y: 0.5 }, colors, scalar: 1.15, ticks: 260 })
    const end = Date.now() + 1500
    let raf = 0
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 72, startVelocity: 60, origin: { x: 0, y: 0.7 }, colors, scalar: 1.1 })
      confetti({ particleCount: 5, angle: 120, spread: 72, startVelocity: 60, origin: { x: 1, y: 0.7 }, colors, scalar: 1.1 })
      if (Date.now() < end) raf = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [showConfetti])

  // Géométrie — 6 parts égales, gros numéros centrés
  const cx = 200, cy = 200, r = 184
  const wheelSegments = useMemo(() => {
    const count = availableSegments.length
    if (count === 0) return []
    const anglePerSegment = (2 * Math.PI) / count
    return availableSegments.map((segment, index) => {
      const startAngle = index * anglePerSegment - Math.PI / 2
      const endAngle = startAngle + anglePerSegment
      const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle)
      const largeArcFlag = anglePerSegment > Math.PI ? 1 : 0
      const pathData = [`M ${cx} ${cy}`, `L ${x1} ${y1}`, `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`, 'Z'].join(' ')
      const midAngle = startAngle + anglePerSegment / 2
      const textRadius = r * 0.66
      const textX = cx + textRadius * Math.cos(midAngle)
      const textY = cy + textRadius * Math.sin(midAngle)
      // Trait de séparation (rayon au bord de départ du segment)
      const dividerX = cx + r * Math.cos(startAngle), dividerY = cy + r * Math.sin(startAngle)
      const gem = GEMS[index % GEMS.length]
      return { id: segment.id, pathData, gem, idx: index, text: segment.text, textX, textY, dividerX, dividerY }
    })
  }, [availableSegments])

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#0c0a12' }}>

      {/* FOND DRAMATIQUE + LUEUR DORÉE RADIALE RENFORCÉE */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 55% at 50% 48%, rgba(212,175,55,0.30) 0%, rgba(212,175,55,0.10) 32%, rgba(20,16,28,0) 60%), radial-gradient(ellipse at 50% 30%, #221b2e 0%, #14101d 45%, #0a0810 100%)' }} />
      {/* Projecteurs scéniques discrets */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'conic-gradient(from 270deg at 50% 0%, transparent 0deg, rgba(212,175,55,0.06) 18deg, transparent 36deg, transparent 324deg, rgba(212,175,55,0.06) 342deg, transparent 360deg)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 58%, rgba(0,0,0,0.6) 100%)' }} />

      {/* Bouton plein écran (discret) */}
      <motion.button onClick={toggleFullscreen} initial={{ opacity: 0 }} animate={{ opacity: 0.25 }}
        whileHover={{ opacity: 0.9, scale: 1.1 }} transition={{ duration: 0.3 }}
        className="absolute top-4 right-4 z-50 p-2.5 bg-black/40 border border-[#d4af37]/30 rounded-full backdrop-blur-sm"
        title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
        {isFullscreen ? <Minimize className="h-5 w-5 text-[#d4af37]" /> : <Maximize className="h-5 w-5 text-[#d4af37]" />}
      </motion.button>

      {/* SCÈNE CENTRÉE */}
      <div className="relative z-10 h-full w-full flex items-center justify-center">
        <div className="relative" style={{ width: 'min(92vmin, 880px)', height: 'min(92vmin, 880px)' }}>

          {/* SOCLE / BASE */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ bottom: '-11%', width: '96%', height: '24%' }}>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-1 rounded-[50%] blur-3xl" style={{ width: '95%', height: '75%', background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.75) 0%, rgba(212,175,55,0.28) 42%, transparent 72%)' }} />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0" style={{
              width: '74%', height: '64%',
              clipPath: 'polygon(18% 0, 82% 0, 100% 100%, 0 100%)',
              background: 'linear-gradient(to bottom, #211b34 0%, #110d1d 100%)',
              borderTop: '2.5px solid rgba(212,175,55,0.95)',
              boxShadow: '0 16px 50px rgba(212,175,55,0.4), inset 0 2px 8px rgba(212,175,55,0.3)',
            }} />
          </div>

          {/* Lueur dorée derrière la roue */}
          <div className="absolute inset-[-6%] rounded-full blur-[60px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.42) 0%, rgba(212,175,55,0.12) 48%, transparent 70%)' }} />

          {/* CADRE DORÉ + AMPOULES (fixe) */}
          <div className="absolute inset-0 rounded-full" style={{
            background: 'conic-gradient(from 210deg, #8a6a14 0%, #f6e6a8 12%, #c9a227 27%, #7a5e10 45%, #f1dd95 62%, #c9a227 78%, #8a6a14 100%)',
            boxShadow: '0 0 34px rgba(212,175,55,0.5), 0 0 90px rgba(212,175,55,0.18), inset 0 3px 8px rgba(255,247,214,0.5), inset 0 -6px 14px rgba(0,0,0,0.55)',
          }}>
            {/* Gorge sombre intérieure */}
            <div className="absolute rounded-full" style={{ inset: '7.5%', background: '#0c0a12', boxShadow: 'inset 0 0 24px rgba(0,0,0,0.9)' }} />
            {/* Filet doré fin */}
            <div className="absolute rounded-full border border-[#f3e2a3]/35" style={{ inset: '3%' }} />

            {/* Ampoules — scintillement au repos / chase pendant la rotation */}
            {BULBS.map((bulb, i) => {
              const x = 50 + 46.2 * Math.cos(bulb.angle)
              const y = 50 + 46.2 * Math.sin(bulb.angle)
              return (
                <motion.div key={bulb.id} className="absolute rounded-full"
                  style={{
                    width: '2.4%', height: '2.4%', left: `${x}%`, top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    background: 'radial-gradient(circle at 35% 30%, #fff7da 0%, #ffe49b 42%, #d4af37 100%)',
                  }}
                  animate={isSpinning
                    ? { opacity: [0.35, 1, 0.35], boxShadow: ['0 0 2px rgba(212,175,55,0.4)', '0 0 12px rgba(255,224,150,1), 0 0 22px rgba(212,175,55,0.7)', '0 0 2px rgba(212,175,55,0.4)'] }
                    : { opacity: [0.5, 1, 0.5], boxShadow: ['0 0 3px rgba(212,175,55,0.4)', '0 0 10px rgba(255,224,150,0.95), 0 0 18px rgba(212,175,55,0.55)', '0 0 3px rgba(212,175,55,0.4)'] }
                  }
                  transition={isSpinning
                    ? { duration: 0.85, repeat: Infinity, ease: 'easeInOut', delay: (i / BULB_COUNT) * 0.85 }
                    : { duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: (i % 6) * 0.28 }
                  }
                />
              )
            })}
          </div>

          {/* POINTEUR (goutte blanche bordée d'or) */}
          <motion.div className="absolute left-1/2 -translate-x-1/2 z-40" style={{ top: '-3.5%', width: '8%' }}
            animate={isSpinning ? { y: ['0%', '-12%', '0%'] } : {}}
            transition={{ duration: 0.18, repeat: Infinity }}>
            <svg viewBox="0 0 40 56" className="w-full h-auto" style={{ filter: 'drop-shadow(0 5px 8px rgba(0,0,0,0.6))' }}>
              <path d="M20 55 C 8 38 2 30 2 18 A 18 18 0 1 1 38 18 C 38 30 32 38 20 55 Z"
                fill="#ffffff" stroke="#d4af37" strokeWidth="3.5" />
              <ellipse cx="14" cy="14" rx="6" ry="8" fill="rgba(255,255,255,0.7)" />
            </svg>
          </motion.div>

          {/* ROUE TOURNANTE */}
          <div className="absolute rounded-full overflow-hidden" style={{ inset: '7.5%' }}>
            <motion.div
              animate={{ rotate: isInfiniteSpinning ? [rotation, rotation + 360] : rotation }}
              transition={
                isInfiniteSpinning
                  ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
                  : { duration: isSpinning ? (isManualStop ? 3 : 8) : 0, ease: isSpinning ? (isManualStop && spinMode === 'auto' ? [0.25, 0.1, 0.8, 1] : [0.25, 1, 0.5, 1]) : 'linear' }
              }
              className="w-full h-full">
              <svg viewBox="0 0 400 400" className="w-full h-full">
                <defs>
                  {GEMS.map((gem, i) => (
                    <radialGradient key={i} id={`gem-${i}`} cx="200" cy="200" r="184" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor={gem.light} />
                      <stop offset="58%" stopColor={gem.base} />
                      <stop offset="100%" stopColor={gem.dark} />
                    </radialGradient>
                  ))}
                  {/* Reflet glossy (lumière venant du haut) */}
                  <radialGradient id="gloss" cx="200" cy="92" r="190" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
                    <stop offset="34%" stopColor="rgba(255,255,255,0.10)" />
                    <stop offset="60%" stopColor="rgba(255,255,255,0)" />
                  </radialGradient>
                  <filter id="winGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="6" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="numShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.55" />
                  </filter>
                </defs>

                {/* Disque de fond */}
                <circle cx={cx} cy={cy} r={r} fill="#0c0a12" />

                {/* Segments pierres précieuses glossy */}
                {wheelSegments.map((seg) => (
                  <path key={`seg-${seg.id}`} d={seg.pathData} fill={`url(#gem-${seg.idx % GEMS.length})`} />
                ))}

                {/* Illumination de la part gagnante */}
                {showResult && winningIndex !== undefined && wheelSegments[winningIndex] && (
                  <motion.g filter="url(#winGlow)"
                    initial={{ opacity: 0.85 }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}>
                    <path d={wheelSegments[winningIndex].pathData} fill="rgba(255,255,255,0.45)" />
                    <path d={wheelSegments[winningIndex].pathData} fill="none" stroke="#ffffff" strokeWidth="4.5" />
                  </motion.g>
                )}

                {/* Reflet glossy global */}
                <circle cx={cx} cy={cy} r={r} fill="url(#gloss)" pointerEvents="none" />

                {/* Traits dorés de séparation */}
                {wheelSegments.map((seg) => (
                  <line key={`div-${seg.id}`} x1={cx} y1={cy} x2={seg.dividerX} y2={seg.dividerY}
                    stroke="#f6e6a8" strokeWidth="1.6" strokeOpacity="0.9" />
                ))}

                {/* Anneau intérieur fin */}
                <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="#f6e6a8" strokeWidth="2" strokeOpacity="0.55" />

                {/* Gros numéros blancs — toujours à l'endroit (contre-rotation) */}
                {wheelSegments.map((seg, i) => (
                  <text key={`txt-${seg.id}`}
                    x={seg.textX} y={seg.textY}
                    fill="#ffffff"
                    fontSize="46"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${-rotation}, ${seg.textX}, ${seg.textY})`}
                    filter="url(#numShadow)"
                    style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 800 }}>
                    {i + 1}
                  </text>
                ))}
              </svg>
            </motion.div>
          </div>

          {/* MOYEU CENTRAL FIXE — titre + ornement */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="rounded-full flex flex-col items-center justify-start text-center"
              style={{
                position: 'relative',
                width: '31%', height: '31%',
                paddingTop: '13%',
                background: 'radial-gradient(circle at 50% 38%, #1a1626 0%, #0b0913 75%, #060409 100%)',
                border: '3px solid transparent',
                backgroundClip: 'padding-box',
                boxShadow: '0 0 0 3px rgba(212,175,55,0.9), 0 0 0 6px rgba(0,0,0,0.6), 0 0 0 8px rgba(212,175,55,0.5), inset 0 0 24px rgba(0,0,0,0.8), 0 0 26px rgba(212,175,55,0.35)',
              }}>
              <span style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700, color: '#e7cd7e', fontSize: 'clamp(10px, 3.2vmin, 24px)', lineHeight: 1.1, letterSpacing: '0.02em' }}>Roue&nbsp;de&nbsp;la</span>
              <span style={{
                fontFamily: 'var(--font-playfair), serif', fontWeight: 800, fontSize: 'clamp(13px, 4.6vmin, 34px)', lineHeight: 1.05, letterSpacing: '0.01em',
                background: 'linear-gradient(180deg, #fbf3d6 0%, #e7cd7e 48%, #c9a227 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Destinée</span>
              {/* Ornement étoile — sous le pivot, dans la zone basse libre */}
              <span style={{ position: 'absolute', left: '50%', top: '70%', transform: 'translateX(-50%)', color: '#d4af37', fontSize: 'clamp(10px, 3vmin, 20px)', lineHeight: 1, filter: 'drop-shadow(0 0 5px rgba(212,175,55,0.6))' }}>✦</span>
            </div>
          </div>

          {/* Pivot central doré (axe de rotation, géométriquement centré, sous le texte) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 rounded-full pointer-events-none"
            style={{ width: '2.6%', height: '2.6%', background: 'radial-gradient(circle at 38% 30%, #fbf0c8 0%, #d4af37 55%, #8a6a14 100%)', boxShadow: '0 0 8px rgba(212,175,55,0.8)' }} />
        </div>
      </div>

      {/* POPUP RÉSULTAT */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50">
            {/* Backdrop retardé pour laisser voir l'illumination + confettis sur la roue */}
            <motion.div className="absolute inset-0" style={{ background: 'rgba(6,5,11,0.9)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.7 }} />
            <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.32) 0%, rgba(212,175,55,0.08) 28%, transparent 52%)' }}
              initial={{ opacity: 0 }}
              animate={{ scale: [1, 1.4, 1], opacity: [0, 0.7, 0.4] }}
              transition={{ duration: 2.4, delay: 0.7, repeat: Infinity, ease: 'easeInOut' }} />

            <motion.div initial={{ scale: 0.6, y: 80, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 16, stiffness: 180, delay: 0.8 }} className="relative z-10 mx-4">
              <div className="relative rounded-[28px] px-10 py-10 md:px-16 md:py-12 text-center max-w-lg"
                style={{ background: 'linear-gradient(160deg, #16121f 0%, #0c0a14 55%, #08070e 100%)', boxShadow: '0 0 50px rgba(212,175,55,0.3), 0 30px 60px rgba(0,0,0,0.6)', border: '1px solid rgba(212,175,55,0.55)' }}>
                <motion.div className="absolute inset-0 rounded-[28px] pointer-events-none" style={{ border: '1px solid rgba(212,175,55,0.5)' }}
                  animate={{ boxShadow: ['0 0 0 0 rgba(212,175,55,0)', '0 0 0 14px rgba(212,175,55,0.18)', '0 0 0 28px rgba(212,175,55,0)'] }}
                  transition={{ duration: 2, repeat: Infinity }} />

                {/* Numéro gagnant qui grossit dans un halo (couleur de la part) */}
                {winningNumber !== null && (
                  <motion.div className="relative mx-auto mb-6 flex items-center justify-center"
                    style={{ width: 132, height: 132 }}
                    initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 11, stiffness: 160, delay: 0.12 }}>
                    <motion.div className="absolute inset-0 rounded-full"
                      style={{ background: `radial-gradient(circle, ${winningGem.light}cc 0%, ${winningGem.base}55 45%, transparent 72%)` }}
                      animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
                    <div className="relative flex items-center justify-center rounded-full"
                      style={{ width: 104, height: 104, background: `radial-gradient(circle at 38% 30%, ${winningGem.light} 0%, ${winningGem.base} 60%, ${winningGem.dark} 100%)`, boxShadow: `inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -4px 10px rgba(0,0,0,0.4), 0 0 30px ${winningGem.base}aa`, border: '2px solid rgba(212,175,55,0.85)' }}>
                      <span style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 800, fontSize: 56, color: '#fff', lineHeight: 1, textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>{winningNumber}</span>
                    </div>
                  </motion.div>
                )}

                <motion.p className="text-[#d4af37]/70 text-xs md:text-sm uppercase tracking-[0.4em] mb-3"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  style={{ fontFamily: 'var(--font-playfair), serif' }}>Le destin a choisi</motion.p>
                <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  className="text-3xl md:text-4xl"
                  style={{
                    fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 700,
                    background: 'linear-gradient(180deg, #fbf3d6 0%, #e7cd7e 50%, #c9a227 100%)',
                    WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 2px 12px rgba(212,175,55,0.4))',
                  }}>{result}</motion.h2>

                <motion.div className="flex items-center justify-center gap-3 mt-7" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                  <span className="block h-px w-14" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.8))' }} />
                  <span className="text-[#d4af37] text-lg" style={{ filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.6))' }}>✦</span>
                  <span className="block h-px w-14" style={{ background: 'linear-gradient(270deg, transparent, rgba(212,175,55,0.8))' }} />
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
            <motion.div className="absolute inset-0" style={{ background: 'rgba(5,4,9,0.94)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.22) 0%, transparent 50%)' }}
              animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.div className="relative z-10 text-center px-8" initial={{ scale: 0.6, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 14 }}>
              <motion.div className="mx-auto mb-7 flex items-center justify-center rounded-full"
                initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.2, damping: 11 }}
                style={{ width: 110, height: 110, background: 'radial-gradient(circle at 38% 30%, #fbf0c8 0%, #d4af37 55%, #8a6a14 100%)', boxShadow: '0 0 40px rgba(212,175,55,0.55), inset 0 2px 8px rgba(255,255,255,0.5)' }}>
                <span style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 54, color: '#0c0a12', lineHeight: 1 }}>✦</span>
              </motion.div>
              <motion.h1 className="text-5xl md:text-7xl mb-5" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                style={{
                  fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 800, letterSpacing: '0.04em',
                  background: 'linear-gradient(180deg, #fbf3d6 0%, #e7cd7e 48%, #c9a227 100%)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 3px 18px rgba(212,175,55,0.4))',
                }}>
                Félicitations
              </motion.h1>
              <motion.p className="text-xl md:text-2xl text-[#e9cf86]/90 mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                style={{ fontFamily: 'var(--font-playfair), serif' }}>
                Tous les défis ont été relevés
              </motion.p>
              <motion.p className="text-sm text-[#d4af37]/55 uppercase tracking-[0.35em]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                La Roue de la Destinée est terminée
              </motion.p>
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
