'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Roue de la Destinée 2.0 — plateau 3D du grand écran, avec repli automatique sur la roue actuelle (2D) :
//   - pas de WebGL 2, ressources introuvables ;
//   - contexte graphique perdu : 2D le temps de relancer la 3D (2 relances au plus en 5 min, ensuite 2D) ;
//   - PC trop lent même en qualité minimale (moins de 22 images/s pendant 10 s, voir lib/fx3d/guard.ts),
//     appliqué seulement quand la roue est à l'arrêt ; un affichage bloqué à 30 images/s ne compte jamais ;
//   - /live/<code>?roue=2d force la roue 2D.
// Au repos, le rendu est limité à 30 images/s. La régie voit le mode et peut « Réessayer la 3D » (lib/fx3d/status.ts).
// three n'est chargé qu'ici (jamais sur les téléphones ni la régie).
// Le moteur de rotation reste celui de WheelGame : ce composant ne reçoit que des informations (WheelFx).

import { useEffect, useRef, type MutableRefObject } from 'react'
import type { WheelEngine, WheelPhase } from './WheelEngine'
import { WheelSounds } from './wheelSounds'
import { RenderGuard, FX3D_IDLE_FPS } from '@/lib/fx3d/guard'
import type { Fx3dReason } from '@/lib/fx3d/status'

/** Ce que WheelGame transmet au plateau 3D (lecture seule : rien ne revient vers le moteur). */
export interface WheelFx {
  frame(angle: number, velocity: number, phase: WheelPhase): void
  /** Séparateur sous le pointeur. Renvoie vrai si les bruitages 2.0 s'en chargent (le « clac » synthétisé se tait). */
  tick(velocity: number, phase: WheelPhase): boolean
  spinStart(music: boolean): void
  decel(): void
  stop(): void
  /** `quiet` : remise en place silencieuse (plateau relancé alors que le résultat est déjà affiché). */
  reveal(index: number, number: number | null, quiet?: boolean): void
  clear(): void
}

// Test fait UNE seule fois par page (appelé à chaque rendu React) : chaque test ouvre un contexte WebGL,
// et Chrome en sacrifie un ancien — celui du plateau — quand il y en a trop. Le contexte de test est libéré aussitôt.
let allowed: boolean | null = null
let forced = false
export function wheel3dAllowed(): boolean {
  if (allowed !== null) return allowed
  try {
    if (new URLSearchParams(window.location.search).get('roue') === '2d') { forced = true; return (allowed = false) }
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    allowed = !!gl
  } catch {
    allowed = false
  }
  return allowed
}
/** Raison de l'absence de 3D avant tout essai : 2D demandée dans l'adresse, ou pas de WebGL 2. */
export function wheel3dBlockedReason(): Fx3dReason { return forced ? 'forced' : 'no_webgl' }
/** « Réessayer la 3D » : refait le test WebGL (sauf 2D demandée dans l'adresse). */
export function resetWheel3dAllowed() { if (!forced) allowed = null }

interface Props {
  fxRef: MutableRefObject<WheelFx | null>
  /** Numéro fixe de chaque case affichée, dans l'ordre de la roue. */
  numbers: number[]
  reduced: boolean
  /** Bruitages du plateau (interrupteur de la régie). Faux = plateau muet ; la musique personnalisée n'est pas concernée. */
  sfx: boolean
  onReady: () => void
  /** Repli définitif sur la 2D (jusqu'à « Réessayer la 3D » ou un rechargement). */
  onFail: (reason: Fx3dReason, fps?: number) => void
  /** Contexte graphique perdu : la 2D s'affiche le temps de relancer la 3D. */
  onRestart: () => void
  /** Repli décidé (PC trop lent) mais différé jusqu'à l'arrêt de la roue : images/s mesurées, ou null. */
  onPending: (fps: number | null) => void
}

// Contexte graphique perdu : au plus 2 relances en 5 minutes, ensuite 2D.
const MAX_RESTARTS = 2
const RESTART_WINDOW_MS = 5 * 60_000
const RESTART_DELAY_MS = 1200

export default function Wheel3D({ fxRef, numbers, reduced, sfx, onReady, onFail, onRestart, onPending }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<WheelEngine | null>(null)
  const numbersRef = useRef(numbers)
  const reducedRef = useRef(reduced)
  const sfxRef = useRef(sfx)
  const cbRef = useRef({ onReady, onFail, onRestart, onPending })
  useEffect(() => { cbRef.current = { onReady, onFail, onRestart, onPending }; reducedRef.current = reduced; sfxRef.current = sfx })

  useEffect(() => {
    numbersRef.current = numbers
    engineRef.current?.setSegments(numbers)
  }, [numbers])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let cancelled = false
    let raf = 0
    let failed = false
    let restartTimer: ReturnType<typeof setTimeout> | null = null
    const restarts: number[] = []
    let sounds: WheelSounds | null = null
    let canvas: HTMLCanvasElement | null = null
    const stats = { fps: 0, level: 0, frames: [] as number[], restarts: 0, pendingFps: null as number | null }
    const setDebug = (v: Record<string, unknown>) => { (window as unknown as { __wheel3d?: unknown }).__wheel3d = v }

    // arrête le plateau en cours (moteur, sons, canevas) sans décider de la suite
    const teardown = () => {
      cancelAnimationFrame(raf)
      raf = 0
      fxRef.current = null
      sounds?.dispose()
      sounds = null
      engineRef.current?.dispose()
      engineRef.current = null
      canvas?.remove()
      canvas = null
    }
    const fail = (reason: Fx3dReason, fps?: number) => {
      if (failed) return
      failed = true
      if (restartTimer) clearTimeout(restartTimer)
      teardown()
      setDebug({ status: 'failed', reason, fps, stats })
      cbRef.current.onFail(reason, fps)
    }
    const lost = () => {
      if (failed || cancelled) return
      const now = Date.now()
      while (restarts.length && now - restarts[0] > RESTART_WINDOW_MS) restarts.shift()
      teardown()
      if (restarts.length >= MAX_RESTARTS) { fail('context_lost'); return }
      restarts.push(now)
      stats.restarts++
      setDebug({ status: 'restarting', stats })
      console.warn('[Roue] contexte graphique perdu : relance de la 3D')
      cbRef.current.onRestart()
      restartTimer = setTimeout(() => { restartTimer = null; void boot(true) }, RESTART_DELAY_MS)
    }

    const boot = async (isRestart: boolean) => {
      const c = document.createElement('canvas')
      c.setAttribute('aria-hidden', 'true')
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
      c.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); if (c === canvas) lost() })
      try {
        const { WheelEngine } = await import('./WheelEngine')
        if (cancelled || failed) return
        const e = await WheelEngine.create(c)
        if (cancelled || failed) { e.dispose(); return }
        canvas = c
        engineRef.current = e
        e.setSegments(numbersRef.current)
        box.appendChild(c)
        sounds = new WheelSounds()
        const s = sounds
        fxRef.current = {
          // Bruitages coupés : le visuel suit toujours, seuls les sons se taisent (tick renvoie vrai → pas de « clac » de secours).
          frame: (a, v, p) => { e.feed(a, v, p); if (sfxRef.current) s.image(v, p) },
          tick: (v, p) => { e.tick(); if (!sfxRef.current) return true; if (!s.ready) return false; s.cran(v, p); return true },
          spinStart: (music) => { if (sfxRef.current) s.lancement(music) },
          decel: () => { if (sfxRef.current) s.decel() },
          stop: () => { if (sfxRef.current) s.arret() },
          reveal: (i, n, quiet) => { e.reveal(i, n, quiet || reducedRef.current); if (sfxRef.current && !quiet) s.resultat() },
          clear: () => e.clearReveal(),
        }
        loop(e)
        setDebug({ status: 'ready', engine: e, stats, sounds: s, canvas: c })
        cbRef.current.onReady()
      } catch (err) {
        if (cancelled) return
        console.warn('[Roue] plateau 3D indisponible, roue 2D :', err instanceof Error ? err.message : err)
        // après une perte de contexte, Chrome peut refuser un nouveau contexte : la cause reste le contexte graphique
        fail(isRestart ? 'context_lost' : 'load_failed')
      }
    }

    // ── boucle de rendu : 30 images/s au repos, qualité adaptative (baisse vite, remonte lentement),
    //    repli 2D seulement si le PC reste sous 22 images/s en qualité minimale, et jamais pendant un lancer.
    function loop(e: WheelEngine) {
      const guard = new RenderGuard(performance.now())
      let low = 0, high = 0, ref = 50, pendingSent: number | null = null
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame)
        const busy = e.busy
        const dt = guard.frame(now, !busy)
        if (dt === null) return
        const r = box!.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          e.resize(r.width * dpr, r.height * dpr)
        }
        e.tick3d(Math.min(dt, 0.05), now)
        e.render()
        if (stats.frames.length < 4000) stats.frames.push(dt * 1000)
        const w = guard.window(now)
        if (w) {
          stats.fps = w.fps
          const min = e.qualityCount - 1
          if (!w.idle) {
            // pendant un lancer : comparaison avec la meilleure cadence déjà vue sur ce PC
            ref = Math.max(ref, Math.min(w.fps, 125))
            if (w.fps < ref * 0.88) { low++; high = 0 } else if (w.fps > ref * 0.97) { high++; low = 0 } else { low = 0; high = 0 }
          } else {
            // au repos (30 images/s visées) : seule une vraie baisse sous la cadence visée allège le rendu
            high = 0
            low = w.fps < FX3D_IDLE_FPS * 0.85 ? low + 1 : 0
          }
          if (low >= 2 && e.qualityLevel < min) { e.setQuality(e.qualityLevel + 1); low = 0 }
          if (high >= 8 && e.qualityLevel > 0) { e.setQuality(e.qualityLevel - 1); high = 0 }
          stats.level = e.qualityLevel
          guard.judge(w, e.qualityLevel === min)
        }
        const p = guard.pendingFps
        if (p !== pendingSent) { pendingSent = p; stats.pendingFps = p; cbRef.current.onPending(p) }
        if (guard.fallbackNow(busy)) fail('too_slow', p ?? undefined)
      }
      raf = requestAnimationFrame(frame)
    }

    void boot(false)

    return () => {
      cancelled = true
      if (restartTimer) clearTimeout(restartTimer)
      teardown()
    }
  }, [fxRef])

  // Plateau 16:9 (caméra Blender) centré ; bandes noires si l'écran n'est pas en 16:9.
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#05040b' }}>
      <div ref={boxRef} className="relative" style={{ aspectRatio: '16 / 9', width: 'min(100vw, calc(100vh * 16 / 9))' }} />
    </div>
  )
}
