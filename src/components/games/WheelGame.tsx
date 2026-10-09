'use client'

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useSyncExternalStore } from 'react'
import { motion, AnimatePresence, useReducedMotion, type TargetAndTransition } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Maximize, Minimize } from 'lucide-react'
import { WheelSegment, WheelAudioSettings } from '@/types/database'
import {
  FREE_SPEED_DEG_S,
  SPIN_UP_MS,
  decelPosition,
  decelVelocity,
  planDeceleration,
  targetAngleFor,
  type DecelPlan,
} from '@/lib/wheel-physics'
import { GEMS, GOLD } from './wheel-theme'

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

// Arrondi des coordonnées calculées (Math.cos/sin diffèrent d'un ULP entre
// Node et le navigateur → mismatch d'hydratation sans cet arrondi)
const rnd = (n: number) => Math.round(n * 1000) / 1000

// Ampoules régulièrement espacées autour du cadre doré (décoratif uniquement)
const BULB_COUNT = 28
const BULBS = Array.from({ length: BULB_COUNT }, (_, i) => ({
  id: i,
  angle: (i * 360 / BULB_COUNT - 90) * (Math.PI / 180),
}))

// Spots bleus scéniques (plateau TV) — purement décoratifs, derrière la roue
const STAGE_BEAMS = [
  { left: '4%', rotate: 16, delay: 0, duration: 7.5 },
  { left: '15%', rotate: 9, delay: 1.8, duration: 9 },
  { left: '78%', rotate: -9, delay: 0.9, duration: 8.2 },
  { left: '89%', rotate: -16, delay: 2.6, duration: 7 },
]

const CONFETTI_COLORS = ['#d4af37', '#f4d03f', '#ffe9a3', '#ffffff', '#c9a227']
// Durée totale d'un tirage auto côté animateur (5 s de rotation libre + 3 s de décélération).
const SPIN_CSS_DURATION_MS = 8000
// Durée de décélération après la cible (STOP manuel, ou cible auto reçue tôt).
const DECEL_MAX_S = 3

const noopSubscribe = () => () => {}
const detectMac = () => /Mac/i.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent)

// « Clac » de la roue à chaque séparateur qui passe sous le pointeur :
// claquement synthétisé (bruit filtré très court + petit impact grave), aucun
// fichier à charger. Le navigateur n'autorise le son qu'après une interaction
// avec le site : sans elle, la roue tourne en silence, rien ne casse.
function useTickSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const noiseRef = useRef<AudioBuffer | null>(null)

  const ensure = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      const ctx = new Ctor()
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3)
      ctxRef.current = ctx
      noiseRef.current = buffer
      return ctx
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    const unlock = () => { void ensure()?.resume().catch(() => {}) }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      void ctxRef.current?.close().catch(() => {})
      ctxRef.current = null
    }
  }, [ensure])

  return useCallback((volume: number) => {
    const ctx = ensure()
    if (!ctx || !noiseRef.current) return
    if (ctx.state !== 'running') { void ctx.resume().catch(() => {}); return }
    const now = ctx.currentTime
    const noise = ctx.createBufferSource()
    noise.buffer = noiseRef.current
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 2300
    band.Q.value = 1.1
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)
    noise.connect(band).connect(gain).connect(ctx.destination)
    noise.start(now)
    noise.stop(now + 0.04)
    const thump = ctx.createOscillator()
    thump.type = 'triangle'
    thump.frequency.setValueAtTime(190, now)
    thump.frequency.exponentialRampToValueAtTime(90, now + 0.03)
    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(volume * 0.55, now)
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)
    thump.connect(thumpGain).connect(ctx.destination)
    thump.start(now)
    thump.stop(now + 0.04)
  }, [ensure])
}

type MotionPhase = 'idle' | 'spinup' | 'free' | 'decel'

export default function WheelGame({ segments, isSpinning, result, spinToIndex, usedSegmentIds = [], isGameFinished = false, audioSettings, spinMode = 'auto' }: WheelGameProps) {
  const [showResult, setShowResult] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFinished, setShowFinished] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Détection Mac côté client (navigator absent au rendu serveur → false).
  const isMac = useSyncExternalStore(noopSubscribe, detectMac, () => false)
  // La case gagnante reste sur la roue pendant toute la révélation : la base la
  // marque « utilisée » dès la fin du tirage, mais la roue ne doit pas se
  // redessiner sous les yeux du public à ce moment-là.
  const [heldWinnerId, setHeldWinnerId] = useState<string | null>(null)
  // Accessibilité : coupe particules, pulses, faisceaux et pointeur animés (visuel uniquement)
  const prefersReducedMotion = useReducedMotion()
  const previousSpinning = useRef(false)
  const customAudioRef = useRef<HTMLAudioElement | null>(null)
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const spinStartTimeRef = useRef<number>(0)

  // ─── MOTEUR DE ROTATION ───────────────────────────────────────────────────
  // Animé image par image (pas de React à chaque image) : vitesse continue du
  // départ à l'arrêt, « clac » et pointeur synchronisés avec les séparateurs.
  const wheelRef = useRef<HTMLDivElement>(null)
  const numbersRef = useRef<HTMLDivElement>(null)
  const flapRef = useRef<HTMLDivElement>(null)
  const angleRef = useRef(0)
  const motionRef = useRef<{ phase: MotionPhase; t0: number; from: number; plan: DecelPlan | null }>({ phase: 'idle', t0: 0, from: 0, plan: null })
  const pendingTargetRef = useRef<{ angle: number; maxDuration: number } | null>(null)
  const lastBoundaryRef = useRef(0)
  const lastFrameRef = useRef(0)
  const rafRef = useRef(0)
  const awaitingResultRef = useRef(false)
  const segmentCountRef = useRef(1)
  const frameRef = useRef<FrameRequestCallback | null>(null)
  const playTick = useTickSound()

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

  // Cases encore en jeu (sert au calcul de la case visée, comme l'animateur).
  const availableSegments = useMemo(() =>
    segments.filter(s => !usedSegmentIds.includes(s.id)),
    [segments, usedSegmentIds]
  )
  // Cases dessinées : les cases en jeu + la gagnante tant que le résultat est affiché.
  const displayedSegments = useMemo(() =>
    segments.filter(s => !usedSegmentIds.includes(s.id) || s.id === heldWinnerId),
    [segments, usedSegmentIds, heldWinnerId]
  )

  // Numéro FIXE de chaque case : sa position dans la liste complète. Il ne
  // change pas quand des cases sont tirées (la roue ne renumérote plus), donc
  // l'animateur et les invités gardent les mêmes repères toute la partie.
  const numberOf = useMemo(() => new Map(segments.map((s, i) => [s.id, i + 1])), [segments])

  // ── Réactions aux changements de l'animateur (pendant le rendu, sans effet) ──
  const [prevSpinning, setPrevSpinning] = useState(isSpinning)
  if (isSpinning !== prevSpinning) {
    setPrevSpinning(isSpinning)
    if (isSpinning) {
      setShowResult(false)
      setShowConfetti(false)
      setHeldWinnerId(null)
    }
  }
  const [prevSpinTo, setPrevSpinTo] = useState(spinToIndex)
  if (spinToIndex !== prevSpinTo) {
    setPrevSpinTo(spinToIndex)
    if (isSpinning && spinToIndex !== undefined) setHeldWinnerId(availableSegments[spinToIndex]?.id ?? null)
  }
  // Résultat masqué par l'animateur : la case gagnante quitte la roue.
  if (heldWinnerId !== null && !isSpinning && result === null) setHeldWinnerId(null)

  // Applique l'angle à la roue et garde les numéros droits (contre-rotation).
  const applyAngle = useCallback((angle: number) => {
    if (wheelRef.current) wheelRef.current.style.transform = `rotate(${angle}deg)`
    const layer = numbersRef.current
    if (layer) {
      layer.style.transform = `rotate(${angle}deg)`
      for (const el of Array.from(layer.children)) (el as HTMLElement).style.transform = `translate(-50%, -50%) rotate(${-angle}deg)`
    }
  }, [])

  const revealResult = useCallback(() => {
    awaitingResultRef.current = false
    setShowResult(true)
    setShowConfetti(true)
  }, [])

  const startLoop = useCallback(() => {
    if (rafRef.current) return
    lastFrameRef.current = 0
    rafRef.current = requestAnimationFrame((t) => frameRef.current?.(t))
  }, [])

  // Une image du moteur (fonction tenue à jour à chaque rendu).
  useLayoutEffect(() => {
    segmentCountRef.current = Math.max(1, displayedSegments.length)
    frameRef.current = (now: number) => {
      const m = motionRef.current
      const dt = lastFrameRef.current ? Math.min(0.05, (now - lastFrameRef.current) / 1000) : 0
      lastFrameRef.current = now
      let angle = angleRef.current
      let velocity = 0

      if (m.phase === 'spinup') {
        const p = Math.min(1, (now - m.t0) / SPIN_UP_MS)
        velocity = FREE_SPEED_DEG_S * p * p * (3 - 2 * p)
        angle += velocity * dt
        if (p >= 1) m.phase = 'free'
      } else if (m.phase === 'free') {
        velocity = FREE_SPEED_DEG_S
        angle += velocity * dt
        // Cible connue : la décélération part EXACTEMENT de la vitesse en cours.
        const target = pendingTargetRef.current
        if (target) {
          pendingTargetRef.current = null
          m.plan = planDeceleration(angle, FREE_SPEED_DEG_S, target.angle, target.maxDuration)
          m.phase = 'decel'
          m.t0 = now
          m.from = angle
        }
      } else if (m.phase === 'decel' && m.plan) {
        const t = (now - m.t0) / 1000
        angle = m.from + decelPosition(m.plan, t)
        velocity = decelVelocity(m.plan, t)
        if (t >= m.plan.duration) {
          angle = m.from + m.plan.distance
          m.phase = 'idle'
        }
      }

      angleRef.current = angle
      applyAngle(angle)

      // Un séparateur passe sous le pointeur : « clac » + le pointeur fléchit.
      const seg = 360 / segmentCountRef.current
      const boundary = Math.floor(angle / seg)
      if (boundary !== lastBoundaryRef.current) {
        lastBoundaryRef.current = boundary
        if (velocity > 1) {
          playTick(audioSettings?.enabled && audioSettings?.url ? 0.16 : 0.3)
          if (!prefersReducedMotion && flapRef.current) {
            const segMs = (seg / velocity) * 1000
            flapRef.current.animate(
              [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-17deg)', offset: 0.28 }, { transform: 'rotate(0deg)' }],
              { duration: Math.max(70, Math.min(260, segMs * 0.9)), easing: 'cubic-bezier(.2,.8,.3,1)' },
            )
          }
        }
      }

      if (m.phase !== 'idle') {
        rafRef.current = requestAnimationFrame((t) => frameRef.current?.(t))
      } else {
        rafRef.current = 0
        lastFrameRef.current = 0
        if (awaitingResultRef.current) revealResult()
      }
    }
  })

  // Après chaque rendu (nouvelles cases, nouveaux numéros) : même angle.
  useLayoutEffect(() => {
    applyAngle(angleRef.current)
  })

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
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

  // Début et fin de tirage : son, moteur, révélation (aucun état modifié ici).
  useEffect(() => {
    if (isSpinning && !previousSpinning.current) {
      spinStartTimeRef.current = Date.now()
      awaitingResultRef.current = false
      pendingTargetRef.current = null
      if (resultTimeoutRef.current) { clearTimeout(resultTimeoutRef.current); resultTimeoutRef.current = null }
      if (audioSettings?.enabled && audioSettings?.url && customAudioRef.current) {
        customAudioRef.current.currentTime = 0
        customAudioRef.current.volume = 1
        customAudioRef.current.loop = true
        customAudioRef.current.play().catch(() => {})
      }
      motionRef.current = { phase: 'spinup', t0: performance.now(), from: angleRef.current, plan: null }
      lastBoundaryRef.current = Math.floor(angleRef.current / (360 / segmentCountRef.current))
      startLoop()
    } else if (!isSpinning && previousSpinning.current) {
      if (customAudioRef.current && !customAudioRef.current.paused && spinMode !== 'manual') {
        fadeOutAudio(customAudioRef.current, 500)
      }
      if (motionRef.current.phase === 'idle') {
        // La roue est déjà arrêtée : révélation immédiate.
        resultTimeoutRef.current = setTimeout(revealResult, 120)
      } else {
        // Révélation dès que la roue s'arrête (jamais avant).
        awaitingResultRef.current = true
        if (motionRef.current.phase !== 'decel' && !pendingTargetRef.current) {
          // Cible jamais reçue (écran ouvert en plein tirage) : arrêt doux là où elle est.
          pendingTargetRef.current = { angle: angleRef.current + 200, maxDuration: 1.8 }
        }
      }
    }
    previousSpinning.current = isSpinning
  }, [isSpinning, audioSettings, fadeOutAudio, spinMode, startLoop, revealResult])

  // Case visée reçue (auto : à 5 s ; manuel : au STOP) → plan de décélération.
  useEffect(() => {
    if (!isSpinning || spinToIndex === undefined) return
    const count = availableSegments.length
    if (count === 0) return
    if (spinMode === 'manual' && customAudioRef.current && !customAudioRef.current.paused) {
      customAudioRef.current.pause()
      customAudioRef.current.currentTime = 0
    }
    // Auto : la roue doit être arrêtée avant les 8 s du tirage (révélation).
    const remaining = (SPIN_CSS_DURATION_MS - (Date.now() - spinStartTimeRef.current) - 150) / 1000
    const maxDuration = spinMode === 'auto' ? Math.max(2.2, Math.min(DECEL_MAX_S, remaining)) : DECEL_MAX_S
    // Arrêt légèrement variable dans la case (suspense), jamais près du bord.
    const jitter = Math.random() * 1.6 - 0.8
    pendingTargetRef.current = { angle: targetAngleFor(spinToIndex, count, jitter), maxDuration }
    startLoop()
    // availableSegments relu volontairement au moment où la cible arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinToIndex, isSpinning, spinMode, startLoop])

  // ─── RENDU ────────────────────────────────────────────────────────────────
  const winnerIndex = heldWinnerId ? displayedSegments.findIndex(s => s.id === heldWinnerId) : -1
  const winningNumber = heldWinnerId ? (numberOf.get(heldWinnerId) ?? null) : null
  const winningGem = winnerIndex >= 0 ? GEMS[winnerIndex % GEMS.length] : GEMS[0]

  // Confettis dorés via canvas-confetti à l'apparition du résultat / de la fin
  useEffect(() => {
    if (!showConfetti || prefersReducedMotion) return
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
  }, [showConfetti, prefersReducedMotion])

  // Géométrie — parts égales, gros numéros centrés
  const cx = 200, cy = 200, r = 184
  const wheelSegments = useMemo(() => {
    const count = displayedSegments.length
    if (count === 0) return []
    const anglePerSegment = (2 * Math.PI) / count
    return displayedSegments.map((segment, index) => {
      const startAngle = index * anglePerSegment - Math.PI / 2
      const endAngle = startAngle + anglePerSegment
      const x1 = rnd(cx + r * Math.cos(startAngle)), y1 = rnd(cy + r * Math.sin(startAngle))
      const x2 = rnd(cx + r * Math.cos(endAngle)), y2 = rnd(cy + r * Math.sin(endAngle))
      const largeArcFlag = anglePerSegment > Math.PI ? 1 : 0
      const pathData = [`M ${cx} ${cy}`, `L ${x1} ${y1}`, `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`, 'Z'].join(' ')
      const midAngle = startAngle + anglePerSegment / 2
      const textRadius = r * 0.66
      const textX = rnd(cx + textRadius * Math.cos(midAngle))
      const textY = rnd(cy + textRadius * Math.sin(midAngle))
      // Trait de séparation (rayon au bord de départ du segment)
      const dividerX = x1, dividerY = y1
      // Rivet doré à la jonction des segments, près du bord
      const rivetRadius = r - 13
      const rivetX = rnd(cx + rivetRadius * Math.cos(startAngle)), rivetY = rnd(cy + rivetRadius * Math.sin(startAngle))
      const gem = GEMS[index % GEMS.length]
      return { id: segment.id, pathData, gem, idx: index, text: segment.text, textX, textY, dividerX, dividerY, rivetX, rivetY }
    })
  }, [displayedSegments])
  const layoutKey = useMemo(() => displayedSegments.map(s => s.id).join('|'), [displayedSegments])
  const pulse = (keyframes: TargetAndTransition, still: TargetAndTransition): TargetAndTransition => (prefersReducedMotion ? still : keyframes)

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#03040c' }}>

      {/* FOND PLATEAU TV — bleu nuit profond + halo doré derrière la roue */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 55% at 50% 46%, rgba(255,190,60,0.26) 0%, rgba(212,175,55,0.09) 32%, transparent 58%), radial-gradient(circle at 50% 42%, #111827 0%, #050510 60%, #000000 100%)' }} />

      {/* Spots bleus scéniques (faisceaux depuis le haut, derrière la roue) */}
      {STAGE_BEAMS.map((beam, i) => (
        <motion.div key={`beam-${i}`} className="absolute pointer-events-none"
          style={{
            top: '-12%', left: beam.left, width: '15%', height: '96%',
            transformOrigin: 'top center', rotate: beam.rotate,
            clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)',
            background: 'linear-gradient(to bottom, rgba(90,165,255,0.85) 0%, rgba(64,148,255,0.32) 52%, transparent 90%)',
            // Flancs fondus pour un vrai cône de lumière (pas de bord dur)
            maskImage: 'linear-gradient(to right, transparent 0%, black 32%, black 68%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 32%, black 68%, transparent 100%)',
            filter: 'blur(20px)',
          }}
          animate={prefersReducedMotion ? { opacity: 0.7 } : { opacity: [0.55, 0.95, 0.55] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: beam.duration, delay: beam.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Nappe bleue basse (retour de lumière des spots sur la scène) */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: '34%', background: 'radial-gradient(ellipse 70% 100% at 50% 100%, rgba(50,110,210,0.26) 0%, transparent 72%)' }} />
      {/* Vignette de contraste */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 58%, rgba(0,0,0,0.52) 100%)' }} />

      {/* Bouton plein écran (discret) */}
      <motion.button onClick={toggleFullscreen} initial={{ opacity: 0 }} animate={{ opacity: 0.25 }}
        whileHover={{ opacity: 0.9, scale: 1.1 }} transition={{ duration: 0.3 }}
        className="absolute top-4 right-4 z-50 p-2.5 bg-black/40 border border-[#d4af37]/30 rounded-full backdrop-blur-sm"
        title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
        {isFullscreen ? <Minimize className="h-5 w-5 text-[#d4af37]" /> : <Maximize className="h-5 w-5 text-[#d4af37]" />}
      </motion.button>

      {/* SCÈNE CENTRÉE */}
      <div className="relative z-10 h-full w-full flex items-center justify-center">
        {/* Roue légèrement remontée pour laisser le socle visible sous elle.
            Taille liée à l'écran (85 % du petit côté), sans plafond bas : grande aussi en 4K. */}
        <motion.div className="relative" role="img" aria-label="Roue de la Destinée"
          style={{ width: 'min(85vmin, 1700px)', height: 'min(85vmin, 1700px)', y: '-4.5%' }}
          // Révélation, temps 1 : la roue s'avance légèrement vers le public.
          animate={{ scale: showResult && !prefersReducedMotion ? 1.035 : 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}>

          {/* SOCLE DE SCÈNE — la roue est un objet posé sur le plateau */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ bottom: '-12%', width: '100%', height: '26%' }}>
            {/* Reflet doré flou au sol */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0 rounded-[50%] blur-3xl" style={{ width: '98%', height: '70%', background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.7) 0%, rgba(212,175,55,0.24) 42%, transparent 72%)' }} />
            {/* Fût trapézoïdal bleu nuit, filet or en tête */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[9%]" style={{
              width: '70%', height: '58%',
              clipPath: 'polygon(16% 0, 84% 0, 100% 100%, 0 100%)',
              background: 'linear-gradient(to bottom, #131a30 0%, #0a0e1d 55%, #060812 100%)',
              borderTop: `2.5px solid ${GOLD.g2}`,
              boxShadow: '0 16px 50px rgba(212,175,55,0.35), inset 0 2px 10px rgba(246,196,83,0.3), inset 0 -12px 24px rgba(0,0,0,0.7)',
            }} />
            {/* Base inférieure élargie, liseré or */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0" style={{
              width: '86%', height: '11%',
              borderRadius: '6px 6px 10px 10px',
              background: 'linear-gradient(to bottom, #1a2138 0%, #05060d 100%)',
              borderTop: `2px solid ${GOLD.g3}`,
              boxShadow: 'inset 0 1px 4px rgba(246,196,83,0.35), 0 10px 30px rgba(0,0,0,0.8)',
            }} />
            {/* Plaque décorative centrale + diamant or */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center" style={{
              bottom: '22%', width: '17%', height: '26%',
              borderRadius: 6,
              background: 'linear-gradient(160deg, #101526 0%, #070a14 100%)',
              border: '1.5px solid rgba(246,196,83,0.6)',
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.8), 0 0 14px rgba(212,175,55,0.25)',
            }}>
              <span style={{ color: GOLD.g2, fontSize: 'clamp(9px, 2.4vmin, 32px)', lineHeight: 1, filter: 'drop-shadow(0 0 6px rgba(246,196,83,0.7))' }}>✦</span>
            </div>
            {/* Ombre portée de la roue sur le socle */}
            <div className="absolute left-1/2 -translate-x-1/2 rounded-[50%] blur-xl" style={{ bottom: '52%', width: '58%', height: '22%', background: 'rgba(0,0,0,0.55)' }} />
          </div>

          {/* Halo doré derrière la roue (renforcé pendant le spin) */}
          <motion.div className="absolute inset-[-6%] rounded-full blur-[60px] pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,190,60,0.45) 0%, rgba(212,175,55,0.13) 48%, transparent 70%)' }}
            animate={{ opacity: isSpinning || showResult ? 1 : 0.72 }}
            transition={{ duration: 0.6 }} />

          {/* COURONNE OR MÉTALLIQUE (fixe) — anneaux superposés + ampoules */}
          <div className="absolute inset-0 rounded-full" style={{
            background: `conic-gradient(from 210deg, ${GOLD.g3} 0%, ${GOLD.g1} 11%, ${GOLD.g2} 26%, ${GOLD.g4} 45%, ${GOLD.g1} 61%, ${GOLD.g2} 78%, ${GOLD.g3} 100%)`,
            // Cerclage externe or sombre + lueur — donne l'épaisseur d'une vraie couronne
            boxShadow: `0 0 0 3px ${GOLD.g4}, 0 0 0 4.5px rgba(255,241,168,0.35), 0 14px 44px rgba(0,0,0,0.65), 0 0 38px rgba(212,175,55,0.5), 0 0 100px rgba(212,175,55,0.18), inset 0 4px 10px rgba(255,247,214,0.55), inset 0 -7px 16px rgba(0,0,0,0.6)`,
          }}>
            {/* Bombé métallique (biseau haut clair / bas sombre) */}
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(255,251,230,0.35) 0%, transparent 28%, transparent 72%, rgba(0,0,0,0.4) 100%)' }} />
            {/* Filets dorés fins (double cerclage) */}
            <div className="absolute rounded-full border border-[#fff1a8]/45 pointer-events-none" style={{ inset: '1.6%' }} />
            <div className="absolute rounded-full border border-[#6f4308]/70 pointer-events-none" style={{ inset: '5.6%' }} />
            {/* Gorge sombre intérieure (lit de la roue) */}
            <div className="absolute rounded-full" style={{ inset: '7.5%', background: '#06070f', boxShadow: 'inset 0 0 26px rgba(0,0,0,0.95), 0 0 0 1.5px rgba(255,241,168,0.4)' }} />

            {/* Ampoules fête foraine — socle doré + verre chaud.
                Chenillard pendant la rotation, scintillement au repos, flash au résultat.
                Seule l'opacité est animée (halo fixe) : léger pour les petits PC. */}
            {BULBS.map((bulb, i) => {
              const x = rnd(50 + 46.2 * Math.cos(bulb.angle))
              const y = rnd(50 + 46.2 * Math.sin(bulb.angle))
              return (
                <div key={bulb.id} className="absolute" style={{ width: '3.1%', height: '3.1%', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
                  {/* Socle doré (statique) */}
                  <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at 40% 32%, ${GOLD.g2} 0%, ${GOLD.g3} 55%, ${GOLD.g4} 100%)`, boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.6)' }} />
                  {/* Verre de l'ampoule (halo fixe, seule l'opacité varie) */}
                  <motion.div className="absolute rounded-full" style={{ inset: '13%', background: 'radial-gradient(circle at 35% 30%, #fffdf2 0%, #ffe49b 46%, #d4af37 100%)', boxShadow: '0 0 10px rgba(255,224,150,0.95), 0 0 20px rgba(212,175,55,0.6)' }}
                    animate={prefersReducedMotion
                      ? { opacity: 0.92 }
                      : isSpinning
                        ? { opacity: [0.25, 1, 0.25] }
                        : showResult
                          ? { opacity: [0.35, 1, 0.35] }
                          : { opacity: [0.45, 1, 0.45] }
                    }
                    transition={prefersReducedMotion
                      ? { duration: 0 }
                      : isSpinning
                        ? { duration: 0.85, repeat: Infinity, ease: 'easeInOut', delay: (i / BULB_COUNT) * 0.85 }
                        : showResult
                          ? { duration: 0.45, repeat: Infinity, ease: 'easeInOut', delay: (i % 2) * 0.22 }
                          : { duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: (i % 7) * 0.26 }
                    }
                  />
                </div>
              )
            })}
          </div>

          {/* POINTEUR — goutte ivoire, contour or métallique, rivet central.
              Fixe devant la roue ; fléchit à chaque séparateur qui passe (moteur). */}
          <div className="absolute left-1/2 -translate-x-1/2 z-40 pointer-events-none" style={{ top: '-2.2%', width: '8.5%' }}>
            <div ref={flapRef} style={{ transformOrigin: '50% 31%' }}>
              <svg viewBox="0 0 40 58" className="w-full h-auto" style={{ filter: 'drop-shadow(0 6px 9px rgba(0,0,0,0.65))' }}>
                <defs>
                  <linearGradient id="ptr-gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD.g1} />
                    <stop offset="45%" stopColor={GOLD.g2} />
                    <stop offset="100%" stopColor={GOLD.g3} />
                  </linearGradient>
                  <radialGradient id="ptr-rivet" cx="38%" cy="30%" r="80%">
                    <stop offset="0%" stopColor={GOLD.g1} />
                    <stop offset="55%" stopColor={GOLD.g2} />
                    <stop offset="100%" stopColor={GOLD.g4} />
                  </radialGradient>
                </defs>
                <path d="M20 57 C 8 39 2 30 2 18 A 18 18 0 1 1 38 18 C 38 30 32 39 20 57 Z"
                  fill="#fff9e6" stroke="url(#ptr-gold)" strokeWidth="4" />
                {/* Relief interne (ombre du bord bas) */}
                <path d="M20 53 C 10 37 5 29 5 18 A 15 15 0 1 1 35 18 C 35 29 30 37 20 53 Z"
                  fill="none" stroke="rgba(111,67,8,0.28)" strokeWidth="1.6" />
                {/* Reflet lumineux haut-gauche */}
                <ellipse cx="13.5" cy="13" rx="5.5" ry="7.5" fill="rgba(255,255,255,0.75)" />
                {/* Rivet/axe doré */}
                <circle cx="20" cy="18" r="4.6" fill="url(#ptr-rivet)" stroke="rgba(111,67,8,0.6)" strokeWidth="0.8" />
              </svg>
            </div>
          </div>

          {/* ROUE TOURNANTE (angle appliqué image par image par le moteur) */}
          <div className="absolute rounded-full overflow-hidden" style={{ inset: '7.5%' }}>
            <div ref={wheelRef} className="w-full h-full" style={{ willChange: 'transform' }}>
              <motion.svg key={layoutKey} viewBox="0 0 400 400" className="w-full h-full"
                // Changement du nombre de cases (case gagnante retirée) : fondu doux.
                initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
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
                  {/* Assombrissement près du bord — effet laque/vernis bombé */}
                  <radialGradient id="rim-shade" cx="200" cy="200" r="184" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="rgba(0,0,0,0)" />
                    <stop offset="78%" stopColor="rgba(0,0,0,0)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.42)" />
                  </radialGradient>
                  {/* Or métallique des séparateurs */}
                  <linearGradient id="gold-stroke" x1="0" y1="0" x2="400" y2="400" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={GOLD.g1} />
                    <stop offset="45%" stopColor={GOLD.g2} />
                    <stop offset="100%" stopColor={GOLD.g3} />
                  </linearGradient>
                  <radialGradient id="rivet-gold" cx="38%" cy="30%" r="80%">
                    <stop offset="0%" stopColor={GOLD.g1} />
                    <stop offset="55%" stopColor={GOLD.g2} />
                    <stop offset="100%" stopColor={GOLD.g4} />
                  </radialGradient>
                  <filter id="winGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="6" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  {/* Relief des séparateurs dorés */}
                  <filter id="dividerShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="1.4" stdDeviation="1.2" floodColor="#000" floodOpacity="0.6" />
                  </filter>
                </defs>

                {/* Disque de fond */}
                <circle cx={cx} cy={cy} r={r} fill="#06070f" />

                {/* Segments glossy — bord légèrement assombri par un stroke sombre */}
                {wheelSegments.map((seg) => (
                  <path key={`seg-${seg.id}`} d={seg.pathData} fill={`url(#gem-${seg.idx % GEMS.length})`}
                    stroke="rgba(0,0,0,0.35)" strokeWidth="1.4" />
                ))}

                {/* Révélation, temps 1 : la case gagnante s'illumine (roue visible) */}
                {showResult && winnerIndex >= 0 && wheelSegments[winnerIndex] && (
                  <motion.g filter="url(#winGlow)"
                    initial={{ opacity: 0.85 }}
                    animate={prefersReducedMotion ? { opacity: 0.95 } : { opacity: [0.6, 1, 0.6] }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}>
                    <path d={wheelSegments[winnerIndex].pathData} fill="rgba(255,255,255,0.45)" />
                    <path d={wheelSegments[winnerIndex].pathData} fill="none" stroke="#ffffff" strokeWidth="4.5" />
                  </motion.g>
                )}

                {/* Reflet glossy global (lumière venant du haut) */}
                <circle cx={cx} cy={cy} r={r} fill="url(#gloss)" pointerEvents="none" />
                {/* Vernis : assombrissement périphérique bombé */}
                <circle cx={cx} cy={cy} r={r} fill="url(#rim-shade)" pointerEvents="none" />

                {/* Séparateurs or en relief (ombre portée + tranche métallique) */}
                {wheelSegments.map((seg) => (
                  <g key={`div-${seg.id}`} filter="url(#dividerShadow)">
                    <line x1={cx} y1={cy} x2={seg.dividerX} y2={seg.dividerY}
                      stroke="url(#gold-stroke)" strokeWidth="3.6" strokeLinecap="round" />
                    <line x1={cx} y1={cy} x2={seg.dividerX} y2={seg.dividerY}
                      stroke={GOLD.g1} strokeWidth="1" strokeOpacity="0.8" strokeLinecap="round" />
                  </g>
                ))}

                {/* Rivets dorés aux jonctions des segments */}
                {wheelSegments.map((seg) => (
                  <g key={`rivet-${seg.id}`}>
                    <circle cx={seg.rivetX} cy={seg.rivetY} r="4.6" fill="url(#rivet-gold)" stroke="rgba(111,67,8,0.7)" strokeWidth="0.9" />
                    <circle cx={seg.rivetX - 1.2} cy={seg.rivetY - 1.4} r="1.3" fill="rgba(255,251,230,0.85)" />
                  </g>
                ))}

                {/* Double cerclage intérieur fin */}
                <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="url(#gold-stroke)" strokeWidth="2.4" strokeOpacity="0.85" />
                <circle cx={cx} cy={cy} r={r - 5} fill="none" stroke={GOLD.g1} strokeWidth="0.8" strokeOpacity="0.4" />
              </motion.svg>
            </div>

            {/* Gros numéros ivoire embossés — toujours DROITS, même en pleine rotation :
                calque qui tourne avec la roue, chaque numéro contre-tourne (moteur). */}
            <div ref={numbersRef} className="absolute inset-0 pointer-events-none" style={{ containerType: 'inline-size', willChange: 'transform' }}>
              {wheelSegments.map((seg) => (
                <span key={`num-${seg.id}`} className="absolute select-none"
                  style={{
                    left: `${seg.textX / 4}%`, top: `${seg.textY / 4}%`,
                    fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 800, fontSize: '12.4cqw', lineHeight: 1,
                    color: GOLD.ivory,
                    WebkitTextStroke: '0.6px rgba(255,241,168,0.35)',
                    textShadow: '0 0.06em 0.05em rgba(0,0,0,0.55), 0 0.02em 0.12em rgba(0,0,0,0.45)',
                    willChange: 'transform',
                  }}>
                  {numberOf.get(seg.id) ?? seg.idx + 1}
                </span>
              ))}
            </div>
          </div>

          {/* MOYEU CENTRAL FIXE — plaque émaillée noire, double cerclage or, titre.
              Positions texte/étoile/pivot calées sur la zone libre (fix 804bdb3). */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="rounded-full flex flex-col items-center justify-start text-center overflow-hidden"
              style={{
                position: 'relative',
                width: '31%', height: '31%',
                paddingTop: '13%',
                background: 'radial-gradient(circle at 50% 34%, #23242e 0%, #0b0b13 62%, #040308 100%)',
                border: '3px solid transparent',
                backgroundClip: 'padding-box',
                boxShadow: `0 0 0 3px ${GOLD.g2}, 0 0 0 6px rgba(0,0,0,0.7), 0 0 0 8.5px rgba(246,196,83,0.55), 0 0 0 10px rgba(111,67,8,0.5), inset 0 0 26px rgba(0,0,0,0.85), 0 0 28px rgba(212,175,55,0.35)`,
              }}>
              {/* Reflet verre bombé (laque noire) */}
              <div className="absolute pointer-events-none" style={{ top: '5%', left: '14%', width: '72%', height: '34%', borderRadius: '50%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 70%, transparent 100%)' }} />
              {/* Filet décoratif au-dessus du titre */}
              <span aria-hidden style={{ position: 'absolute', left: '50%', top: '9.5%', transform: 'translateX(-50%)', width: '26%', height: 1, background: `linear-gradient(90deg, transparent, ${GOLD.g2}, transparent)` }} />
              <span style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700, color: '#f7d875', fontSize: 'clamp(10px, 3.2vmin, 54px)', lineHeight: 1.1, letterSpacing: '0.02em', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>Roue&nbsp;de&nbsp;la</span>
              {/* Or plein en relief (plus net qu'un dégradé sur le texte) */}
              <span style={{
                fontFamily: 'var(--font-playfair), serif', fontWeight: 800, fontSize: 'clamp(13px, 4.6vmin, 78px)', lineHeight: 1.05, letterSpacing: '0.01em',
                color: '#f6d77a',
                textShadow: `0 1px 0 ${GOLD.g3}, 0 2px 3px rgba(0,0,0,0.85), 0 0 14px rgba(212,175,55,0.35)`,
              }}>Destinée</span>
              {/* Ornement étoile — sous le pivot, dans la zone basse libre */}
              <span style={{ position: 'absolute', left: '50%', top: '70%', transform: 'translateX(-50%)', color: GOLD.g2, fontSize: 'clamp(10px, 3vmin, 44px)', lineHeight: 1, filter: 'drop-shadow(0 0 5px rgba(246,196,83,0.65))' }}>✦</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* POPUP RÉSULTAT — temps 2 : après ~1,5 s d'illumination de la case sur la
          roue, le défi s'affiche. Voile partiel : la roue reste visible derrière. */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50">
            <motion.div className="absolute inset-0" style={{ background: 'rgba(6,5,11,0.62)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.5 }} />
            <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.32) 0%, rgba(212,175,55,0.08) 28%, transparent 52%)' }}
              initial={{ opacity: 0 }}
              animate={pulse({ scale: [1, 1.4, 1], opacity: [0, 0.7, 0.4] }, { opacity: 0.5 })}
              transition={prefersReducedMotion ? { duration: 0.3, delay: 1.5 } : { duration: 2.4, delay: 1.5, repeat: Infinity, ease: 'easeInOut' }} />

            <motion.div initial={{ scale: 0.7, y: 60, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 170, delay: 1.55 }} className="relative z-10 mx-4">
              <div className="relative rounded-[18px] px-10 py-10 md:px-16 md:py-12 text-center max-w-lg"
                style={{ background: 'linear-gradient(160deg, #16121f 0%, #0c0a14 55%, #08070e 100%)', boxShadow: '0 0 50px rgba(212,175,55,0.3), 0 30px 60px rgba(0,0,0,0.6)', border: '1px solid rgba(212,175,55,0.55)' }}>
                <motion.div className="absolute inset-0 rounded-[18px] pointer-events-none" style={{ border: '1px solid rgba(212,175,55,0.5)' }}
                  animate={pulse({ boxShadow: ['0 0 0 0 rgba(212,175,55,0)', '0 0 0 14px rgba(212,175,55,0.18)', '0 0 0 28px rgba(212,175,55,0)'] }, {})}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 2, repeat: Infinity }} />

                {/* Numéro gagnant (numéro fixe de la case) dans un halo à sa couleur */}
                {winningNumber !== null && (
                  <motion.div className="relative mx-auto mb-6 flex items-center justify-center"
                    style={{ width: 132, height: 132 }}
                    initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 11, stiffness: 160, delay: 1.7 }}>
                    <motion.div className="absolute inset-0 rounded-full"
                      style={{ background: `radial-gradient(circle, ${winningGem.light}cc 0%, ${winningGem.base}55 45%, transparent 72%)` }}
                      animate={pulse({ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }, { opacity: 0.85 })}
                      transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
                    <div className="relative flex items-center justify-center rounded-full"
                      style={{ width: 104, height: 104, background: `radial-gradient(circle at 38% 30%, ${winningGem.light} 0%, ${winningGem.base} 60%, ${winningGem.dark} 100%)`, boxShadow: `inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -4px 10px rgba(0,0,0,0.4), 0 0 30px ${winningGem.base}aa`, border: '2px solid rgba(212,175,55,0.85)' }}>
                      <span style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 800, fontSize: 56, color: '#fff', lineHeight: 1, textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>{winningNumber}</span>
                    </div>
                  </motion.div>
                )}

                <motion.p className="text-[#d4af37]/80 text-lg md:text-xl italic mb-2"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.75 }}
                  style={{ fontFamily: 'var(--font-playfair), serif' }}>Le destin a choisi…</motion.p>
                <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.85 }}
                  className="text-3xl md:text-4xl"
                  style={{
                    fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 700,
                    color: '#f3d77a',
                    textShadow: '0 1px 0 #8a6a14, 0 2px 14px rgba(212,175,55,0.35)',
                    textWrap: 'balance',
                  }}>{result}</motion.h2>

                <motion.div className="flex items-center justify-center gap-3 mt-7" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>
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
              animate={pulse({ scale: [1, 1.25, 1], opacity: [0.4, 0.7, 0.4] }, { opacity: 0.55 })}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.div className="relative z-10 text-center px-8" initial={{ scale: 0.6, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 14 }}>
              <motion.div className="mx-auto mb-7 flex items-center justify-center rounded-full"
                initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.2, damping: 11 }}
                style={{ width: 110, height: 110, background: 'radial-gradient(circle at 38% 30%, #fbf0c8 0%, #d4af37 55%, #8a6a14 100%)', boxShadow: '0 0 40px rgba(212,175,55,0.55), inset 0 2px 8px rgba(255,255,255,0.5)' }}>
                <span style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 54, color: '#0c0a12', lineHeight: 1 }}>✦</span>
              </motion.div>
              <motion.h1 className="text-5xl md:text-7xl mb-5" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                style={{
                  fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 800, letterSpacing: '0.02em',
                  color: '#f3d77a',
                  textShadow: '0 2px 0 #8a6a14, 0 3px 18px rgba(212,175,55,0.4)',
                }}>
                Félicitations
              </motion.h1>
              <motion.p className="text-xl md:text-2xl text-[#e9cf86]/90 mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                style={{ fontFamily: 'var(--font-playfair), serif' }}>
                Tous les défis ont été relevés
              </motion.p>
              <motion.p className="text-base text-[#d4af37]/70 italic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                style={{ fontFamily: 'var(--font-playfair), serif' }}>
                La Roue de la Destinée est terminée
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {audioSettings?.url && <audio ref={customAudioRef} preload="auto" src={audioSettings.url} />}
    </div>
  )
}
