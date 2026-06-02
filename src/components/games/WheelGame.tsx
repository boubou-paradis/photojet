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

// Brand — luxe nocturne
const NOIR = '#0a0a14'
const NOIR_SEG = '#0b0b16'
const GOLD = '#d4af37'

// Ampoules autour du cadre doré
const BULBS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  angle: (i * 360 / 24 - 90) * (Math.PI / 180),
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
  const previousSpinning = useRef(false)
  const previousSpinToIndex = useRef<number | undefined>(undefined)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const customAudioRef = useRef<HTMLAudioElement | null>(null)
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const spinStartTimeRef = useRef<number>(0)

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch { /* refusé par le navigateur */ }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
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
  // Numéro et libellé gagnants (rendu uniquement)
  const winningIndex = spinToIndex
  const winningNumber = winningIndex !== undefined ? winningIndex + 1 : null

  // Confettis dorés via canvas-confetti à l'apparition du résultat / de la fin
  useEffect(() => {
    if (!showConfetti) return
    const colors = CONFETTI_COLORS
    confetti({ particleCount: 140, spread: 100, startVelocity: 48, origin: { x: 0.5, y: 0.5 }, colors, scalar: 1.15, ticks: 260 })
    const end = Date.now() + 1400
    let raf = 0
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 72, startVelocity: 58, origin: { x: 0, y: 0.7 }, colors, scalar: 1.1 })
      confetti({ particleCount: 5, angle: 120, spread: 72, startVelocity: 58, origin: { x: 1, y: 0.7 }, colors, scalar: 1.1 })
      if (Date.now() < end) raf = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [showConfetti])

  // Géométrie de la roue — segments noir/or alternés, chiffres à l'endroit
  const cx = 200, cy = 200, r = 160
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
      // Alternance noir profond / or (3 + 3 sur 6 segments)
      const isGold = index % 2 === 1
      // Trait doré lumineux entre les segments (rayon au départ du segment)
      const dx = cx + r * Math.cos(startAngle), dy = cy + r * Math.sin(startAngle)
      return { id: segment.id, pathData, isGold, text: segment.text, textX, textY, dividerX: dx, dividerY: dy }
    })
  }, [availableSegments])

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: NOIR }}>

      {/* FOND NOIR PROFOND + LUEUR DORÉE RADIALE */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 60% at 50% 46%, rgba(212,175,55,0.16) 0%, rgba(212,175,55,0.05) 34%, rgba(10,10,20,0) 64%), radial-gradient(ellipse at 50% 120%, #12101c 0%, ${NOIR} 55%)` }}>
        {/* Vignettage subtil */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
      </div>

      {/* Bouton plein écran */}
      <motion.button onClick={toggleFullscreen} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        whileHover={{ scale: 1.1 }} transition={{ duration: 0.3 }}
        className="absolute top-4 right-4 z-50 p-3 bg-black/40 hover:bg-black/60 border border-[#d4af37]/30 rounded-full transition-colors backdrop-blur-sm"
        title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
        {isFullscreen ? <Minimize className="h-6 w-6 text-[#d4af37]" /> : <Maximize className="h-6 w-6 text-[#d4af37]" />}
      </motion.button>

      {/* CONTENU PRINCIPAL */}
      <div className="relative z-10 h-full flex flex-col items-center justify-start pt-8 pb-8">

        {/* TITRE — Playfair Display, or raffiné */}
        <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }} className="text-center mb-5">
          <h1 className="text-4xl md:text-6xl"
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: '#f3e3b3',
              background: 'linear-gradient(180deg, #fbf3d6 0%, #e7cd7e 42%, #c9a227 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 14px rgba(212,175,55,0.35))',
            }}>
            Roue de la Destinée
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="block h-px w-12 md:w-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.7))' }} />
            <p className="text-[#d4af37]/75 text-xs md:text-sm tracking-[0.35em] uppercase" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              Tournez et découvrez votre destin
            </p>
            <span className="block h-px w-12 md:w-20" style={{ background: 'linear-gradient(270deg, transparent, rgba(212,175,55,0.7))' }} />
          </div>
        </motion.div>

        {/* ROUE FLOTTANTE */}
        <div className="relative mt-3">

          {/* Lueur dorée d'ambiance derrière la roue */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px] pointer-events-none"
            style={{ width: '620px', height: '620px', background: 'radial-gradient(circle, rgba(212,175,55,0.28) 0%, rgba(212,175,55,0.08) 45%, transparent 70%)' }} />

          {/* Reflet au sol (roue flottante) */}
          <div className="absolute left-1/2 bottom-[-58px] -translate-x-1/2 pointer-events-none"
            style={{ width: '360px', height: '70px', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.30) 0%, rgba(212,175,55,0.08) 45%, transparent 72%)', filter: 'blur(10px)' }} />

          {/* CADRE DORÉ AVEC AMPOULES */}
          <div className="relative">

            {/* Anneau doré + ampoules */}
            <div className="absolute -inset-7 rounded-full"
              style={{
                background: 'conic-gradient(from 220deg, #8a6a14 0%, #f4e3a6 12%, #c9a227 28%, #7a5e10 45%, #efdb93 62%, #c9a227 78%, #8a6a14 100%)',
                boxShadow: '0 0 28px rgba(212,175,55,0.35), 0 0 70px rgba(212,175,55,0.12), inset 0 2px 6px rgba(255,247,214,0.4), inset 0 -4px 10px rgba(0,0,0,0.5)'
              }}>
              {/* Gorge intérieure sombre */}
              <div className="absolute inset-[14px] rounded-full" style={{ background: NOIR, boxShadow: 'inset 0 0 18px rgba(0,0,0,0.9), inset 0 0 2px rgba(212,175,55,0.6)' }} />
              {/* Filet doré fin */}
              <div className="absolute inset-2 rounded-full border border-[#f0dca0]/30" />

              {/* Ampoules — scintillement au repos (Motion) */}
              {BULBS.map((bulb, i) => {
                const x = 50 + 47.5 * Math.cos(bulb.angle)
                const y = 50 + 47.5 * Math.sin(bulb.angle)
                return (
                  <motion.div key={bulb.id} className="absolute rounded-full"
                    style={{
                      width: '11px', height: '11px',
                      left: `${x}%`, top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      background: 'radial-gradient(circle at 35% 30%, #fff7da 0%, #ffe49b 40%, #d4af37 100%)',
                    }}
                    animate={{
                      opacity: [0.45, 1, 0.45],
                      boxShadow: [
                        '0 0 3px rgba(212,175,55,0.4)',
                        '0 0 9px rgba(255,224,150,0.95), 0 0 18px rgba(212,175,55,0.55)',
                        '0 0 3px rgba(212,175,55,0.4)',
                      ],
                    }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: (i % 6) * 0.28 }}
                  />
                )
              })}
            </div>

            {/* Flèche dorée */}
            <motion.div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-9 z-30"
              animate={isSpinning ? { y: [-6, -2, -6] } : {}}
              transition={{ duration: 0.18, repeat: Infinity }}>
              <div className="absolute inset-0 blur-md opacity-60"
                style={{ background: 'linear-gradient(to bottom, #ffe9a3, #d4af37)', clipPath: 'polygon(50% 100%, 0 0, 100% 0)', width: '58px', height: '70px', transform: 'translateX(-4px)' }} />
              <div className="relative w-[50px] h-[64px]"
                style={{ background: 'linear-gradient(135deg, #fbf0c8 0%, #e3c771 38%, #c9a227 70%, #8a6a14 100%)', clipPath: 'polygon(50% 100%, 0 0, 100% 0)', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))' }}>
                <div className="absolute top-2 left-2 w-3 h-7 opacity-50"
                  style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.85), transparent)', clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
              </div>
            </motion.div>

            {/* ROUE SVG */}
            <motion.div
              animate={{ rotate: isInfiniteSpinning ? [rotation, rotation + 360] : rotation }}
              transition={
                isInfiniteSpinning
                  ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
                  : { duration: isSpinning ? (isManualStop ? 3 : 8) : 0, ease: isSpinning ? (isManualStop && spinMode === 'auto' ? [0.25, 0.1, 0.8, 1] : [0.25, 1, 0.5, 1]) : 'linear' }
              }
              className="relative">
              <svg width="550" height="550" viewBox="0 0 400 400">
                <defs>
                  <radialGradient id="goldSeg" cx="50%" cy="42%" r="62%">
                    <stop offset="0%" stopColor="#f7e6ad" />
                    <stop offset="45%" stopColor="#e0c172" />
                    <stop offset="100%" stopColor="#b8941f" />
                  </radialGradient>
                  <radialGradient id="noirSeg" cx="50%" cy="40%" r="70%">
                    <stop offset="0%" stopColor="#15151f" />
                    <stop offset="100%" stopColor={NOIR_SEG} />
                  </radialGradient>
                  <radialGradient id="hubGradient" cx="38%" cy="30%" r="75%">
                    <stop offset="0%" stopColor="#fbf0c8" />
                    <stop offset="45%" stopColor="#d4af37" />
                    <stop offset="100%" stopColor="#8a6a14" />
                  </radialGradient>
                  <radialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(212,175,55,0)" />
                    <stop offset="82%" stopColor="rgba(212,175,55,0)" />
                    <stop offset="100%" stopColor="rgba(212,175,55,0.35)" />
                  </radialGradient>
                  <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.4" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="winGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="5" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Disque de fond */}
                <circle cx={cx} cy={cy} r={r + 2} fill={NOIR} />

                {/* Segments */}
                {wheelSegments.map((seg) => (
                  <path key={`seg-${seg.id}`} d={seg.pathData}
                    fill={seg.isGold ? 'url(#goldSeg)' : 'url(#noirSeg)'} />
                ))}

                {/* Illumination de la part gagnante */}
                {showResult && winningIndex !== undefined && wheelSegments[winningIndex] && (
                  <g filter="url(#winGlow)">
                    <path d={wheelSegments[winningIndex].pathData} fill="rgba(255,236,170,0.22)" />
                    <path d={wheelSegments[winningIndex].pathData} fill="none" stroke="#fff2c4" strokeWidth="3" />
                  </g>
                )}

                {/* Traits dorés lumineux entre les segments */}
                <g filter="url(#lineGlow)">
                  {wheelSegments.map((seg) => (
                    <line key={`div-${seg.id}`} x1={cx} y1={cy} x2={seg.dividerX} y2={seg.dividerY}
                      stroke="#f4e3a6" strokeWidth="1.1" strokeOpacity="0.85" />
                  ))}
                </g>

                {/* Halo intérieur du disque */}
                <circle cx={cx} cy={cy} r={r} fill="url(#innerGlow)" pointerEvents="none" />

                {/* Anneau intérieur fin */}
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f4e3a6" strokeWidth="1.5" strokeOpacity="0.55" />

                {/* Chiffres — Playfair, à l'endroit, or sur noir / noir sur or */}
                {wheelSegments.map((seg, i) => (
                  <text key={`txt-${seg.id}`}
                    x={seg.textX} y={seg.textY}
                    fill={seg.isGold ? NOIR : '#e9cf86'}
                    fontSize="30"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      fontFamily: 'var(--font-playfair), Georgia, serif',
                      fontWeight: 700,
                      filter: seg.isGold ? 'none' : 'drop-shadow(0 0 6px rgba(212,175,55,0.5))',
                    }}>
                    {i + 1}
                  </text>
                ))}

                {/* Moyeu central doré */}
                <circle cx={cx} cy={cy} r="42" fill={NOIR} />
                <circle cx={cx} cy={cy} r="37" fill="url(#hubGradient)" />
                <circle cx={cx} cy={cy} r="37" fill="none" stroke="#8a6a14" strokeWidth="1" />
                <ellipse cx="190" cy="188" rx="17" ry="10" fill="rgba(255,255,255,0.35)" />
                <circle cx={cx} cy={cy} r="16" fill={NOIR} />
                <circle cx={cx} cy={cy} r="11" fill="url(#hubGradient)" />
                <circle cx={cx} cy={cy} r="4" fill="#fbf0c8" />
              </svg>
            </motion.div>
          </div>

          {/* Indicateur rotation */}
          <AnimatePresence>
            {isSpinning && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="absolute -bottom-24 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-3 px-6 py-2.5 rounded-full"
                  style={{ background: 'linear-gradient(135deg, rgba(20,18,28,0.92), rgba(10,10,20,0.96))', border: '1px solid rgba(212,175,55,0.55)', boxShadow: '0 0 24px rgba(212,175,55,0.25)' }}>
                  <motion.div className="w-2.5 h-2.5 rounded-full"
                    style={{ background: '#f4e3a6', boxShadow: '0 0 10px #d4af37' }}
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }} />
                  <span className="text-[#e9cf86] text-sm uppercase tracking-[0.25em]" style={{ fontFamily: 'var(--font-playfair), serif' }}>La roue tourne…</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* POPUP RÉSULTAT */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50">
            <motion.div className="absolute inset-0" style={{ background: 'rgba(6,6,12,0.88)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            {/* Halo doré pulsant */}
            <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.30) 0%, rgba(212,175,55,0.08) 28%, transparent 52%)' }}
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />

            <motion.div initial={{ scale: 0.6, y: 80, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 16, stiffness: 180 }} className="relative z-10 mx-4">
              <div className="relative rounded-[28px] px-10 py-10 md:px-16 md:py-12 text-center max-w-lg"
                style={{ background: 'linear-gradient(160deg, #14121c 0%, #0c0c16 55%, #08080f 100%)', boxShadow: '0 0 50px rgba(212,175,55,0.30), 0 30px 60px rgba(0,0,0,0.6)', border: '1px solid rgba(212,175,55,0.55)' }}>
                {/* Liseré pulsant */}
                <motion.div className="absolute inset-0 rounded-[28px] pointer-events-none" style={{ border: '1px solid rgba(212,175,55,0.5)' }}
                  animate={{ boxShadow: ['0 0 0 0 rgba(212,175,55,0)', '0 0 0 14px rgba(212,175,55,0.18)', '0 0 0 28px rgba(212,175,55,0)'] }}
                  transition={{ duration: 2, repeat: Infinity }} />

                {/* Chiffre gagnant qui grossit dans un halo */}
                {winningNumber !== null && (
                  <motion.div className="relative mx-auto mb-6 flex items-center justify-center"
                    style={{ width: 132, height: 132 }}
                    initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 11, stiffness: 160, delay: 0.12 }}>
                    <motion.div className="absolute inset-0 rounded-full"
                      style={{ background: 'radial-gradient(circle, rgba(255,236,170,0.55) 0%, rgba(212,175,55,0.2) 45%, transparent 72%)' }}
                      animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
                    <div className="relative flex items-center justify-center rounded-full"
                      style={{ width: 104, height: 104, background: 'radial-gradient(circle at 38% 30%, #fbf0c8 0%, #d4af37 55%, #8a6a14 100%)', boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.5), inset 0 -4px 10px rgba(0,0,0,0.4), 0 0 30px rgba(212,175,55,0.6)' }}>
                      <span style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 800, fontSize: 56, color: NOIR, lineHeight: 1 }}>{winningNumber}</span>
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
            <motion.div className="absolute inset-0" style={{ background: 'rgba(5,5,10,0.94)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.22) 0%, transparent 50%)' }}
              animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.div className="relative z-10 text-center px-8" initial={{ scale: 0.6, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 14 }}>
              <motion.div className="mx-auto mb-7 flex items-center justify-center rounded-full"
                initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.2, damping: 11 }}
                style={{ width: 110, height: 110, background: 'radial-gradient(circle at 38% 30%, #fbf0c8 0%, #d4af37 55%, #8a6a14 100%)', boxShadow: '0 0 40px rgba(212,175,55,0.55), inset 0 2px 8px rgba(255,255,255,0.5)' }}>
                <span style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 54, color: NOIR, lineHeight: 1 }}>✦</span>
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
