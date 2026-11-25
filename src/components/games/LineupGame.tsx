'use client'
/* © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
   Le Bon Ordre — écran public, habillage « plateau TV » AnimaJet 2.0 (maquette V1 validée le 25/11/2026).
   Habillage uniquement : mêmes props, même musique de fond, même plein écran. Les règles, le chrono, les
   points et la synchronisation restent pilotés par la régie. Bruitages ElevenLabs figés dans
   public/bon-ordre/sons (aucun appel au service pendant le jeu), coupables avec le bouton haut-parleur. */

import { useEffect, useState, useRef, useMemo, useCallback, useSyncExternalStore, type CSSProperties } from 'react'
import { Maximize, Minimize, Volume2, VolumeX } from 'lucide-react'
import s from './lineup/LineupStage.module.css'

interface AudioSettings {
  url: string | null
  enabled: boolean
  filename: string | null
  // bruitages (sons FX) réglés depuis la régie ; absent = activés
  sfxEnabled?: boolean
}

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
  audioSettings?: AudioSettings
}

const ASSETS = '/bon-ordre'
// Tirage « machine à sous » : chaque chiffre s'arrête ROLL_STEP ms après le précédent (5 chiffres ≈ 2,4 s)
const ROLL_BASE = 1000
const ROLL_STEP = 340
const DIGIT_H = 204
// Seuils d'ambiance (affichage uniquement) : pression à 30 s, alerte rouge à 15 s
const PRESSURE_AT = 30
const ALERT_AT = 15

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------- Lyres : 4 accrochées en haut, deux par coin ----------
const LYRES = [
  { x: 300, y: 22, a0: 30, c: '#B98CFF', tx: 540 },
  { x: 470, y: 14, a0: 14, c: '#E8E0FF', tx: 820 },
  { x: 1450, y: 14, a0: -14, c: '#E8E0FF', tx: 1100 },
  { x: 1620, y: 22, a0: -30, c: '#B98CFF', tx: 1380 },
].map((L) => {
  // angle de visée du panneau pendant le tirage (repère retourné : lyre accrochée)
  const a = (Math.atan2(L.tx - L.x, -(400 - L.y)) * 180) / Math.PI
  return { ...L, aim: 180 - a }
})

// Graduations du chrono (60) et confettis : calculés une fois, déterministes
const TICKS = Array.from({ length: 60 }, (_, i) => ({ a: i * 6, maj: i % 5 === 0 }))
const ARC_C = 2 * Math.PI * 112
const CONF_COLORS = ['#FFD45E', '#FFFFFF', '#B98CFF', '#FF9F43', '#FFE7A0']
const CONFETTI = Array.from({ length: 70 }, (_, i) => ({
  left: (i * 37) % 100, color: CONF_COLORS[i % 5], dur: 3 + (i % 7) * 0.35, delay: (i % 11) * 0.25, round: i % 2 === 1,
}))
const SPARKS = Array.from({ length: 5 }, (_, t) =>
  Array.from({ length: 10 }, (_, k) => {
    const a = (k / 10) * Math.PI * 2 + t
    const r = 110 + (k % 3) * 30
    // arrondi : même valeur côté serveur et navigateur (sinon avertissement d'hydratation)
    return { dx: Math.round(Math.cos(a) * r * 10) / 10, dy: Math.round(Math.sin(a) * r * 10) / 10 }
  })
)

// ---------- Bruitages (Web Audio : faible latence, sons superposables) ----------
const SFX_GAIN: Record<string, number> = {
  'tirage-molettes': 0.8, 'chiffre-verrou': 1, revelation: 0.85, depart: 0.8, tic: 0.35, 'pression-30': 0.9,
  'tic-tendu': 0.55, 'alarme-15': 0.6, 'bip-urgence': 0.5, 'fin-buzzer': 0.85, points: 0.9, victoire: 0.85,
}
const SFX_KEY = 'animajet_bon_ordre_sons'
const SFX_EVT = 'animajet-bon-ordre-sons'
function readSfxOn() { try { return localStorage.getItem(SFX_KEY) !== '0' } catch { return true } }
function subscribeSfx(cb: () => void) {
  window.addEventListener('storage', cb); window.addEventListener(SFX_EVT, cb)
  return () => { window.removeEventListener('storage', cb); window.removeEventListener(SFX_EVT, cb) }
}
// Échelle de la scène 1920×1080 dans la fenêtre
function readScale() { return Math.min(window.innerWidth / 1920, window.innerHeight / 1080) }
function subscribeResize(cb: () => void) { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb) }

function useSfx(allowed: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const bufs = useRef<Record<string, AudioBuffer>>({})
  const on = useSyncExternalStore(subscribeSfx, readSfxOn, () => true)
  const onRef = useRef(on)
  useEffect(() => { onRef.current = on }, [on])
  // interrupteur de la régie : coupe tous les bruitages de l'écran public
  const allowedRef = useRef(allowed)
  useEffect(() => { allowedRef.current = allowed }, [allowed])

  useEffect(() => {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    ctxRef.current = ctx
    Object.keys(SFX_GAIN).forEach((n) => {
      fetch(`${ASSETS}/sons/${n}.mp3`).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)).then((b) => { bufs.current[n] = b }).catch(() => {})
    })
    // le navigateur n'autorise le son qu'après un geste de l'utilisateur (clic, touche)
    const unlock = () => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}) }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      ctx.close().catch(() => {})
    }
  }, [])

  const play = useCallback((name: string, delayMs = 0) => {
    const ctx = ctxRef.current, buf = bufs.current[name]
    if (!allowedRef.current || !onRef.current || !ctx || !buf || ctx.state !== 'running') return null
    const src = ctx.createBufferSource(), g = ctx.createGain()
    src.buffer = buf; g.gain.value = SFX_GAIN[name] ?? 1
    src.connect(g).connect(ctx.destination)
    src.start(ctx.currentTime + delayMs / 1000)
    return {
      stop: (fadeMs = 200) => {
        try {
          const t = ctx.currentTime
          g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fadeMs / 1000); src.stop(t + fadeMs / 1000 + 0.02)
        } catch { /* déjà arrêté */ }
      },
    }
  }, [])

  const toggle = useCallback(() => {
    const v = !onRef.current; onRef.current = v
    try { localStorage.setItem(SFX_KEY, v ? '1' : '0') } catch { /* stockage indisponible */ }
    window.dispatchEvent(new Event(SFX_EVT))
    if (v && ctxRef.current?.state === 'suspended') ctxRef.current.resume().catch(() => {})
  }, [])

  return { play, on, toggle }
}

interface Roll { id: number; num: string; reels: string[][]; spinning: boolean; landed: boolean[] }

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
  audioSettings,
}: LineupGameProps) {
  const [displayNumber, setDisplayNumber] = useState(currentNumber)
  const [roll, setRoll] = useState<Roll | null>(null)
  const [seenNumber, setSeenNumber] = useState(currentNumber)
  const [rollCount, setRollCount] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const stageScale = useSyncExternalStore(subscribeResize, readScale, () => 1)
  const [shockKey, setShockKey] = useState(0)
  const [hit, setHit] = useState(false)
  const rollTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const sfx = useSfx(audioSettings?.sfxEnabled !== false)
  const { play } = sfx

  // ---------- Plein écran (inchangé) ----------
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
    setIsMac(/Mac/i.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent))
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!isMac) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMac])

  // ---------- Musique de fond (comportement inchangé) ----------
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const wasRunningRef = useRef(false)

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

  useEffect(() => {
    if (!audioSettings?.url || !audioSettings?.enabled) return

    const audio = audioRef.current
    if (!audio) return

    // Game started running
    if (isRunning && !wasRunningRef.current) {
      audio.currentTime = 0
      audio.volume = 1
      audio.loop = true
      audio.play().catch(() => {})
    }
    // Game paused
    else if (isPaused && wasRunningRef.current) {
      audio.pause()
    }
    // Game resumed from pause
    else if (isRunning && !isPaused && audio.paused && wasRunningRef.current) {
      audio.play().catch(() => {})
    }
    // Game stopped (game over)
    else if ((isGameOver || showWinner) && !audio.paused) {
      fadeOutAudio(audio, 500)
    }

    wasRunningRef.current = isRunning
  }, [isRunning, isPaused, isGameOver, showWinner, audioSettings, fadeOutAudio])

  useEffect(() => {
    const timers = rollTimers.current
    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
      timers.forEach(clearTimeout)
      if (audioRef.current) audioRef.current.pause()
    }
  }, [])

  // ---------- Tirage « machine à sous » à chaque nouveau numéro ----------
  // Le changement de numéro reçu de la régie démarre le tirage (mise à jour pendant le rendu, motif React
  // « ajuster l'état quand une prop change ») ; l'effet ci-dessous ne gère que les minuteries et les sons.
  if (currentNumber !== seenNumber) {
    setSeenNumber(currentNumber)
    if (currentNumber === '') {
      setRoll(null); setDisplayNumber('')
    } else {
      const id = rollCount + 1
      setRollCount(id)
      const digits = currentNumber.split('')
      const reels = digits.map((d, i) => {
        const n = 16 + i * 4, seq: string[] = []
        for (let k = 0; k < n; k++) seq.push(String(1 + ((k * 7 + i * 3 + id) % 5)))
        seq.push(d)
        return seq
      })
      setRoll({ id, num: currentNumber, reels, spinning: false, landed: digits.map(() => false) })
    }
  }

  const rollId = roll?.id
  const rollNum = roll?.num
  useEffect(() => {
    if (rollId === undefined || !rollNum) return
    const timers = rollTimers.current
    const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
    const spin = play('tirage-molettes')
    // deux images plus tard : les rouleaux partent (la transition CSS fait le défilement)
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRoll((r) => (r && r.id === rollId ? { ...r, spinning: true } : r)))
    })
    const n = rollNum.length
    for (let i = 0; i < n; i++) {
      later(() => {
        setRoll((r) => {
          if (!r || r.id !== rollId) return r
          const landed = r.landed.slice(); landed[i] = true
          return { ...r, landed }
        })
        setHit(true); later(() => setHit(false), 90)
        play('chiffre-verrou')
      }, ROLL_BASE + i * ROLL_STEP)
    }
    later(() => {
      spin?.stop(250)
      play('revelation')
      setShockKey((k) => k + 1)
      setDisplayNumber(rollNum)
      setRoll((r) => (r && r.id === rollId ? null : r))
    }, ROLL_BASE + (n - 1) * ROLL_STEP + 120)
    return () => {
      cancelAnimationFrame(raf1); cancelAnimationFrame(raf2)
      timers.forEach(clearTimeout); timers.length = 0
      spin?.stop(120)
    }
  }, [rollId, rollNum, play])

  // ---------- Sons et flashs synchronisés sur le chrono ----------
  const prevTime = useRef(timeLeft)
  const prevRunning = useRef(isRunning)
  const prevPaused = useRef(isPaused)
  const prevOver = useRef(isGameOver)
  const prevWinner = useRef(showWinner)
  const lastBuzz = useRef(0)
  const prevScores = useRef({ t1: team1Score, t2: team2Score })

  useEffect(() => {
    // départ (pas à la reprise après une pause)
    if (isRunning && !prevRunning.current && !prevPaused.current) play('depart')
    prevRunning.current = isRunning
    prevPaused.current = isPaused
  }, [isRunning, isPaused, play])

  useEffect(() => {
    const prev = prevTime.current
    prevTime.current = timeLeft
    if (!isRunning || isPaused || timeLeft >= prev || timeLeft <= 0) return
    const t = timeLeft
    if (t === PRESSURE_AT) play('pression-30')
    else if (t === ALERT_AT) play('alarme-15')
    else if (t < ALERT_AT) play('bip-urgence')
    else if (t < PRESSURE_AT) play('tic-tendu')
    else play('tic')
  }, [timeLeft, isRunning, isPaused, play])

  useEffect(() => {
    if (isGameOver && !prevOver.current) { play('fin-buzzer'); lastBuzz.current = Date.now() }
    prevOver.current = isGameOver
  }, [isGameOver, play])

  useEffect(() => {
    if (showWinner && !prevWinner.current) {
      const since = Date.now() - lastBuzz.current
      play('victoire', since < 1500 ? 1300 - Math.max(0, since) : 0)
    }
    prevWinner.current = showWinner
  }, [showWinner, play])

  useEffect(() => {
    const p = prevScores.current
    if (team1Score > p.t1 || team2Score > p.t2) play('points')
    prevScores.current = { t1: team1Score, t2: team2Score }
  }, [team1Score, team2Score, play])

  // ---------- Dérivés d'affichage ----------
  const winner = useMemo(() => {
    if (team1Score > team2Score) return { name: team1Name, isTeam1: true as boolean | null }
    if (team2Score > team1Score) return { name: team2Name, isTeam1: false as boolean | null }
    return { name: 'Égalité', isTeam1: null as boolean | null }
  }, [team1Score, team2Score, team1Name, team2Name])

  const live = isRunning && !isPaused
  const gameActive = isRunning || isPaused
  const drawing = roll !== null
  const pressure = live && timeLeft <= PRESSURE_AT && timeLeft > ALERT_AT
  const urgent = isRunning && timeLeft <= ALERT_AT
  const archAlert = live && timeLeft <= ALERT_AT && timeLeft > 0 && !isGameOver
  const timerProgress = clockDuration > 0 ? Math.max(0, Math.min(1, timeLeft / clockDuration)) : 0
  const arcColor = timeLeft <= ALERT_AT ? '#FF4D6D' : timeLeft <= PRESSURE_AT ? '#FFD45E' : '#FFD77A'

  // flashs : violet à 30 s puis une seconde sur deux, rouge à 15 s puis chaque seconde des 5 dernières
  const flashOn = live && !showWinner && (timeLeft === PRESSURE_AT || timeLeft === ALERT_AT || (timeLeft <= 5 && timeLeft > 0) || (pressure && timeLeft % 2 === 0))
  const flashRed = timeLeft <= ALERT_AT
  const archTick = pressure || (live && timeLeft === PRESSURE_AT)

  const stageClass = cx(
    s.stage,
    showWinner ? s.mWin : drawing ? s.mAim : live ? s.mRun : s.mIdle,
    showWinner && s.isWon,
    drawing && s.drawing,
    !drawing && !live && !showWinner && s.idleGlow,
    !showWinner && pressure && s.mPressure,
    !showWinner && urgent && s.mUrgent,
    !showWinner && archAlert && s.archAlert,
    archAlert && timeLeft <= 5 && s.final5,
    hit && s.hit,
  )

  const stageVars = {
    '--bo-faisceau': `url(${ASSETS}/faisceau.webp)`,
    '--bo-arche-led': `url(${ASSETS}/arche-led.webp)`,
    transform: `translate(-50%, -50%) scale(${stageScale})`,
  } as CSSProperties

  // tuiles : pendant le tirage, chiffres du nouveau numéro ; sinon numéro affiché ; sinon 5 cases vides
  const tileDigits: (string | null)[] = roll ? roll.num.split('') : displayNumber ? displayNumber.split('') : [null, null, null, null, null]

  return (
    <div className={s.root}>
      <div className={stageClass} style={stageVars}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.decor} src={`${ASSETS}/decor.webp`} alt="" draggable={false} />
        <div className={s.archLed}>
          <div className={s.flow} />
          <div className={s.archFlash} />
          {archTick && !archAlert && <div key={`t${timeLeft}`} className={cx(s.archFlash, s.archTick)} />}
        </div>
        {flashOn && <div key={`f${timeLeft}`} className={cx(s.pflash, flashRed && s.pflashRed, s.pflashGo)} />}

        <div className={s.lyres}>
          {LYRES.map((L, i) => (
            <div key={i} className={cx(s.lyre, s.hang)} style={{ left: L.x, top: L.y, '--a0': `${L.a0}deg`, '--lc0': L.c, '--aim': `${L.aim}deg` } as CSSProperties}>
              <div className={s.rot}>
                <div className={s.beam} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={s.lyreHead} src={`${ASSETS}/lyre-tete.webp`} alt="" draggable={false} />
                <div className={s.lens} />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={s.lyreBase} src={`${ASSETS}/lyre-base.webp`} alt="" draggable={false} />
            </div>
          ))}
        </div>

        <div className={s.title}>
          <div className={cx(s.rule, s.ruleL)} /><div className={cx(s.rule, s.ruleR)} />
          <h1><span className={s.tW} data-t="LE BON">LE BON</span> <span className={s.tG} data-t="ORDRE">ORDRE</span></h1>
          <p>PLACEZ-VOUS DANS L&apos;ORDRE AFFICHÉ !</p>
        </div>

        {/* Panneau des numéros */}
        <div className={s.panel}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ASSETS}/panneau-vide.webp`} alt="" draggable={false} />
          <div className={s.chase} />
          <div className={s.tiles}>
            {tileDigits.map((d, i) => {
              const rolling = roll && !roll.landed[i]
              const landed = roll && roll.landed[i]
              const reel = roll?.reels[i]
              const dur = ROLL_BASE + i * ROLL_STEP
              const reelStyle: CSSProperties | undefined = rolling && reel
                ? roll.spinning
                  ? { transform: `translateY(${-(reel.length - 1) * DIGIT_H}px)`, transition: `transform ${dur}ms cubic-bezier(.12,.62,.28,1.06)` }
                  : { transform: 'translateY(0)', transition: 'none' }
                : undefined
              return (
                <div key={`${roll?.id ?? 's'}-${i}`} className={cx(s.tile, d !== null && s.won, landed && s.land)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${ASSETS}/tuile.webp`} alt="" draggable={false} />
                  <div className={s.win}>
                    {d === null && <div className={s.dash} />}
                    {d !== null && (
                      <div className={cx(s.reel, rolling && roll?.spinning && s.spin)} style={reelStyle}>
                        {rolling && reel ? reel.map((x, k) => <b key={k}>{x}</b>) : <b>{d}</b>}
                      </div>
                    )}
                  </div>
                  <div className={s.tileFlash} />
                  <div className={s.sparks}>
                    {SPARKS[i % 5].map((p, k) => <i key={k} style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px` } as CSSProperties} />)}
                  </div>
                </div>
              )
            })}
          </div>
          {shockKey > 0 && <div key={shockKey} className={cx(s.shock, s.shockGo)} />}
        </div>

        {/* Chrono */}
        <div className={cx(s.chrono, timeLeft <= PRESSURE_AT && timeLeft > ALERT_AT && s.cWarn, urgent && s.cUrgent)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ASSETS}/chrono.webp`} alt="" draggable={false} />
          <div className={cx(s.knob, isRunning && s.knobOn, isRunning && timeLeft <= ALERT_AT && s.knobRed, !isRunning && isPaused && s.knobPause)} />
          <div className={s.dial}>
            <svg viewBox="-140 -140 280 280">
              <defs><filter id="boGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" /></filter></defs>
              <g>
                {TICKS.map((t, i) => (
                  <line key={i} x1={0} x2={0} y1={-128} y2={t.maj ? -138 : -134} stroke={t.maj ? '#FFE3A0' : 'rgba(255,227,160,.55)'} strokeWidth={t.maj ? 3 : 1.6} transform={`rotate(${t.a})`} />
                ))}
              </g>
              <circle r={112} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={12} />
              <circle className={s.arc} r={112} fill="none" stroke={timeLeft <= ALERT_AT ? '#FF2350' : '#FFB637'} strokeWidth={16} strokeLinecap="round" transform="rotate(-90)" filter="url(#boGlow)" opacity={0.8}
                strokeDasharray={ARC_C} strokeDashoffset={ARC_C * (1 - timerProgress)} />
              <circle className={s.arc} r={112} fill="none" stroke={arcColor} strokeWidth={9} strokeLinecap="round" transform="rotate(-90)"
                strokeDasharray={ARC_C} strokeDashoffset={ARC_C * (1 - timerProgress)} />
            </svg>
            <div className={s.num}>{timeLeft}</div>
            <div className={s.lbl}>SECONDES</div>
          </div>
          <div key={currentPoints} className={cx(s.pts, currentPoints >= 30 ? s.p30 : currentPoints >= 20 ? s.p20 : s.p10, gameActive && s.ptsOn, currentPoints > 10 && s.bump)}>
            {currentPoints} POINTS
          </div>
        </div>

        {/* Cartes d'équipe */}
        {([
          { cls: s.cardL, name: team1Name, score: team1Score },
          { cls: s.cardR, name: team2Name, score: team2Score },
        ]).map((c, i) => (
          // carte recréée quand le score change → rebond du score et « +points » qui s'envole
          <div key={`${i}-${c.score}`} className={cx(s.card, c.cls, c.score > 0 && s.pop)}>
            <div className={s.halo} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ASSETS}/carte.webp`} alt="" draggable={false} />
            <div className={cx(s.led, isRunning && s.ledOn, !isRunning && isPaused && s.ledPause)} />
            <div className={s.cardName}>{c.name}</div>
            <div className={s.cardScore}>{c.score}</div>
            <div className={s.plus}>+{currentPoints}</div>
          </div>
        ))}

        <div className={cx(s.pill, gameActive && s.pillOn, isPaused && s.pillPause)}>
          <i />{isPaused ? 'PAUSE' : 'EN DIRECT'}
        </div>

        <button type="button" className={cx(s.corner, s.sndBtn)} onClick={sfx.toggle} title={sfx.on ? 'Couper les bruitages' : 'Activer les bruitages'}>
          {sfx.on ? <Volume2 /> : <VolumeX />}
        </button>
        <button type="button" className={cx(s.corner, s.fsBtn)} onClick={toggleFullscreen} title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
          {isFullscreen ? <Minimize /> : <Maximize />}
        </button>

        {/* Écran de fin : TEMPS ÉCOULÉ → VICTOIRE / ÉGALITÉ */}
        <div className={cx(s.winner, showWinner && s.winnerOn)}>
          <div className={s.veil} /><div className={s.rays} /><div className={s.burst} />
          {showWinner && CONFETTI.map((c, i) => (
            <i key={i} className={s.conf} style={{ left: `${c.left}%`, background: c.color, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s`, borderRadius: c.round ? '50%' : '2px' }} />
          ))}
          <div className={s.wContent}>
            <div className={s.kick}>TEMPS ÉCOULÉ</div>
            <div className={s.big} data-t={winner.isTeam1 === null ? 'ÉGALITÉ !' : 'VICTOIRE !'}>
              <span>{winner.isTeam1 === null ? 'ÉGALITÉ !' : 'VICTOIRE !'}</span>
            </div>
            {winner.isTeam1 !== null && <div className={s.wTeam}>{winner.name}</div>}
            <div className={s.finals}>
              <div className={cx(s.fcard, winner.isTeam1 === true && s.best, winner.isTeam1 === false && s.lose)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${ASSETS}/carte.webp`} alt="" draggable={false} />
                <div className={s.fName}>{team1Name}</div><div className={s.fScore}>{team1Score}</div>
              </div>
              <div className={cx(s.fcard, winner.isTeam1 === false && s.best, winner.isTeam1 === true && s.lose)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${ASSETS}/carte.webp`} alt="" draggable={false} />
                <div className={s.fName}>{team2Name}</div><div className={s.fScore}>{team2Score}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Musique de fond de la partie */}
      {audioSettings?.url && (
        <audio ref={audioRef} preload="auto" src={audioSettings.url} />
      )}
    </div>
  )
}
