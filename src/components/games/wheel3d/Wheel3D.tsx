'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Roue de la Destinée 2.0 — plateau 3D du grand écran, avec repli automatique sur la roue actuelle (2D) :
//   - pas de WebGL 2, contexte perdu, ressources introuvables ;
//   - PC trop lent même en qualité minimale (moins de 35 images/s pendant 9 s) → 2D pour cette page ;
//   - /live/<code>?roue=2d force la roue 2D.
// three n'est chargé qu'ici (jamais sur les téléphones ni la régie).
// Le moteur de rotation reste celui de WheelGame : ce composant ne reçoit que des informations (WheelFx).

import { useEffect, useRef, type MutableRefObject } from 'react'
import type { WheelEngine, WheelPhase } from './WheelEngine'
import { WheelSounds } from './wheelSounds'

/** Ce que WheelGame transmet au plateau 3D (lecture seule : rien ne revient vers le moteur). */
export interface WheelFx {
  frame(angle: number, velocity: number, phase: WheelPhase): void
  /** Séparateur sous le pointeur. Renvoie vrai si les bruitages 2.0 s'en chargent (le « clac » synthétisé se tait). */
  tick(velocity: number, phase: WheelPhase): boolean
  spinStart(music: boolean): void
  decel(): void
  stop(): void
  reveal(index: number, number: number | null): void
  clear(): void
}

// Test fait UNE seule fois par page (appelé à chaque rendu React) : chaque test ouvre un contexte WebGL,
// et Chrome en sacrifie un ancien — celui du plateau — quand il y en a trop. Le contexte de test est libéré aussitôt.
let allowed: boolean | null = null
export function wheel3dAllowed(): boolean {
  if (allowed !== null) return allowed
  try {
    if (new URLSearchParams(window.location.search).get('roue') === '2d') return (allowed = false)
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    allowed = !!gl
  } catch {
    allowed = false
  }
  return allowed
}

interface Props {
  fxRef: MutableRefObject<WheelFx | null>
  /** Numéro fixe de chaque case affichée, dans l'ordre de la roue. */
  numbers: number[]
  reduced: boolean
  /** Bruitages du plateau (interrupteur de la régie). Faux = plateau muet ; la musique personnalisée n'est pas concernée. */
  sfx: boolean
  onReady: () => void
  onFail: (reason: string) => void
}

export default function Wheel3D({ fxRef, numbers, reduced, sfx, onReady, onFail }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<WheelEngine | null>(null)
  const numbersRef = useRef(numbers)
  const reducedRef = useRef(reduced)
  const sfxRef = useRef(sfx)
  const cbRef = useRef({ onReady, onFail })
  useEffect(() => { cbRef.current = { onReady, onFail }; reducedRef.current = reduced; sfxRef.current = sfx })

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
    let sounds: WheelSounds | null = null
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'

    const fail = (reason: string) => {
      if (failed) return
      failed = true
      cancelAnimationFrame(raf)
      fxRef.current = null
      ;(window as unknown as { __wheel3d?: unknown }).__wheel3d = { status: 'failed', reason }
      cbRef.current.onFail(reason)
    }
    const stats = { fps: 0, level: 0, frames: [] as number[] }
    canvas.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); fail('context_lost') })

    ;(async () => {
      try {
        const { WheelEngine } = await import('./WheelEngine')
        if (cancelled) return
        const e = await WheelEngine.create(canvas)
        if (cancelled) { e.dispose(); return }
        engineRef.current = e
        e.setSegments(numbersRef.current)
        box.appendChild(canvas)
        sounds = new WheelSounds()
        const s = sounds
        fxRef.current = {
          // Bruitages coupés : le visuel suit toujours, seuls les sons se taisent (tick renvoie vrai → pas de « clac » de secours).
          frame: (a, v, p) => { e.feed(a, v, p); if (sfxRef.current) s.image(v, p) },
          tick: (v, p) => { e.tick(); if (!sfxRef.current) return true; if (!s.ready) return false; s.cran(v, p); return true },
          spinStart: (music) => { if (sfxRef.current) s.lancement(music) },
          decel: () => { if (sfxRef.current) s.decel() },
          stop: () => { if (sfxRef.current) s.arret() },
          reveal: (i, n) => { e.reveal(i, n, reducedRef.current); if (sfxRef.current) s.resultat() },
          clear: () => e.clearReveal(),
        }
        loop(e)
        ;(window as unknown as { __wheel3d?: unknown }).__wheel3d = { status: 'ready', engine: e, stats, sounds: s }
        cbRef.current.onReady()
      } catch (err) {
        if (cancelled) return
        console.warn('[Roue] plateau 3D indisponible, roue 2D :', err instanceof Error ? err.message : err)
        fail('load_failed')
      }
    })()

    // ── boucle de rendu + qualité adaptative (baisse vite, remonte lentement)
    function loop(e: WheelEngine) {
      let last = performance.now()
      const start = last
      let winStart = last, winFrames = 0, low = 0, high = 0, verySlow = 0, ref = 50
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame)
        const dt = (now - last) / 1000
        last = now
        // onglet caché ou pause du navigateur : image ignorée
        if (dt <= 0 || dt > 0.25) { winStart = now; winFrames = 0; return }
        const r = box!.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          e.resize(r.width * dpr, r.height * dpr)
        }
        e.tick3d(Math.min(dt, 0.05), now)
        e.render()
        if (stats.frames.length < 4000) stats.frames.push(dt * 1000)
        if (now - start < 3000) { winStart = now; winFrames = 0; return }
        winFrames++
        if (now - winStart < 1000) return
        const fps = (winFrames * 1000) / (now - winStart)
        winStart = now; winFrames = 0
        ref = Math.max(ref, Math.min(fps, 125))
        stats.fps = fps
        if (fps < ref * 0.88) { low++; high = 0 } else if (fps > ref * 0.97) { high++; low = 0 } else { low = 0; high = 0 }
        if (low >= 2 && e.qualityLevel < e.qualityCount - 1) { e.setQuality(e.qualityLevel + 1); low = 0 }
        if (high >= 8 && e.qualityLevel > 0) { e.setQuality(e.qualityLevel - 1); high = 0 }
        stats.level = e.qualityLevel
        verySlow = e.qualityLevel === e.qualityCount - 1 && fps < 35 ? verySlow + 1 : 0
        if (verySlow >= 9) fail(`fps_${Math.round(fps)}`)
      }
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      fxRef.current = null
      sounds?.dispose()
      engineRef.current?.dispose()
      engineRef.current = null
      canvas.remove()
    }
  }, [fxRef])

  // Plateau 16:9 (caméra Blender) centré ; bandes noires si l'écran n'est pas en 16:9.
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#05040b' }}>
      <div ref={boxRef} className="relative" style={{ aspectRatio: '16 / 9', width: 'min(100vw, calc(100vh * 16 / 9))' }} />
    </div>
  )
}
