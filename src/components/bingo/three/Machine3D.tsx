'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo — machine 3D du grand écran, avec repli automatique sur la machine 2D :
//   - pas de WebGL, contexte perdu, modèle introuvable ;
//   - moins de 40 images/s pendant 6 s (PC trop lent) → 2D pour cette page ; un rechargement retente la 3D ;
//   - « Réduire les animations » demandé par le système ;
//   - « Machine 2D » choisie en régie (ou /live/<code>?machine=2d).
// Un seul moteur par page : le canevas passe d'une scène à l'autre sans rechargement.
// three n'est chargé qu'ici (jamais sur les téléphones, la régie ni l'accueil).

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { readMachinePref, subscribeMachinePref } from '@/lib/bingo/machine-pref'
import type { MachineEngine, MachineView } from './MachineEngine'

export type { MachineView }

const MIN_FPS = 40

// écart horloge locale → serveur (ms) : l'heure d'annonce vient du serveur
let clockOffset = 0
/** Aligne la machine sur l'horloge du serveur (boule posée au moment exact de l'annonce). */
export function useMachineClock(offsetMs: number) {
  useEffect(() => {
    clockOffset = offsetMs
    ;(window as unknown as { __bingoMachineClock?: number }).__bingoMachineClock = offsetMs
  }, [offsetMs])
}
const toLocal = (v: MachineView): MachineView => (v.landAt === null ? v : { ...v, landAt: v.landAt - clockOffset })
const MAX_PIXELS = 1300 * 1100

// ------------------------------------------------------------------ état partagé

type Status = 'idle' | 'loading' | 'ready' | 'failed'
let status: Status = 'idle'
let engine: MachineEngine | null = null
let canvas: HTMLCanvasElement | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const emit = () => { for (const l of listeners) l() }

let mounted = 0
let raf = 0
let last = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null
let host: HTMLElement | null = null
// surveillance de la fluidité
let watchStart = 0
let winStart = 0
let winFrames = 0
let slowWindows = 0

function fail(reason: string) {
  if (status === 'failed') return
  status = 'failed'
  ;(window as unknown as { __bingoMachine3d?: unknown }).__bingoMachine3d = { status, reason }
  stopLoop()
  const e = engine
  engine = null
  canvas?.remove()
  canvas = null
  try { e?.dispose() } catch { /* déjà perdu */ }
  emit()
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch {
    return false
  }
}

function ensureEngine(): Promise<void> {
  if (loading) return loading
  status = 'loading'
  emit()
  loading = (async () => {
    try {
      const { MachineEngine } = await import('./MachineEngine')
      const c = document.createElement('canvas')
      c.className = 'm3d-canvas'
      c.setAttribute('aria-hidden', 'true')
      c.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); fail('context_lost') })
      const e = await MachineEngine.create(c)
      if ((status as Status) === 'failed') { e.dispose(); return }
      engine = e
      canvas = c
      status = 'ready'
      ;(window as unknown as { __bingoMachine3d?: unknown }).__bingoMachine3d = { status, engine: e }
      emit()
      if (mounted > 0) startLoop()
    } catch (err) {
      console.warn('[AnimaBingo] machine 3D indisponible, machine 2D :', err instanceof Error ? err.message : err)
      fail('load_failed')
    }
  })()
  return loading
}

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  const e = engine
  if (!e || !host) return
  const dt = (now - last) / 1000
  last = now
  // onglet caché / machine en veille : on ne compte pas cette image
  if (dt <= 0 || dt > 0.25) { winStart = now; winFrames = 0; return }
  const r = host.getBoundingClientRect()
  if (r.width > 0 && r.height > 0) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = r.width * dpr, h = r.height * dpr
    const k = Math.sqrt(Math.min(1, MAX_PIXELS / (w * h)))
    w *= k; h *= k
    e.resize(w, h)
  }
  e.tick(Math.min(dt, 1 / 20))
  e.render()
  // fluidité : après 4 s de chauffe, fenêtres de 3 s ; deux fenêtres lentes de suite → 2D
  if (now - watchStart < 4000) { winStart = now; winFrames = 0; return }
  winFrames++
  if (now - winStart >= 3000) {
    const fps = (winFrames * 1000) / (now - winStart)
    slowWindows = fps < MIN_FPS ? slowWindows + 1 : 0
    winStart = now; winFrames = 0
    if (slowWindows >= 2) fail(`fps_${Math.round(fps)}`)
  }
}

function startLoop() {
  if (raf || !engine) return
  last = performance.now()
  watchStart = last
  winStart = last
  winFrames = 0
  slowWindows = 0
  raf = requestAnimationFrame(frame)
}

function stopLoop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

const snapshot = () => status
const serverSnapshot = (): Status => 'idle'

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  )
}

/** La 3D est-elle permise sur ce PC (préférence, système, WebGL, échec antérieur) ? */
function useAllowed(): boolean {
  const pref = useSyncExternalStore(subscribeMachinePref, readMachinePref, () => '2d' as const)
  const reduced = useReducedMotion()
  const st = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const [env] = useState(() => (typeof window === 'undefined' ? false : webglAvailable()))
  return pref !== '2d' && !reduced && env && st !== 'failed'
}

/** Précharge la machine 3D dès l'ouverture de l'écran (le premier tirage s'affiche déjà en 3D). */
export function useMachine3DPreload(enabled = true) {
  const allowed = useAllowed()
  useEffect(() => {
    if (!enabled || !allowed) return
    // après l'affichage de la page, pour ne rien ralentir
    const t = setTimeout(() => void ensureEngine(), 800)
    return () => clearTimeout(t)
  }, [enabled, allowed])
}

// ------------------------------------------------------------------ composant

export interface MachineBox { left: number; top: number; width: number; height: number }

/**
 * Machine 3D dans la zone `box` (coordonnées de la scène 1920×1080), sinon `fallback` (machine 2D).
 * La 2D reste affichée pendant le chargement : jamais d'écran vide.
 */
export function Machine3D({ box, view, fallback, style }: { box: MachineBox; view: MachineView; fallback: ReactNode; style?: CSSProperties }) {
  const allowed = useAllowed()
  const st = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const ref = useRef<HTMLDivElement>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    if (!allowed) return
    void ensureEngine()
  }, [allowed])

  // rattache le canevas partagé à cette zone tant qu'elle est affichée
  useEffect(() => {
    if (!allowed || st !== 'ready' || !ref.current || !canvas || !engine) return
    const el = ref.current
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
    mounted++
    host = el
    el.appendChild(canvas)
    engine.show(toLocal(viewRef.current))
    startLoop()
    return () => {
      mounted--
      if (host === el) host = null
      if (canvas?.parentElement === el) el.removeChild(canvas)
      if (mounted === 0) {
        stopLoop()
        // plus aucune machine à l'écran depuis 60 s (autre jeu) : on libère la carte graphique
        idleTimer = setTimeout(() => {
          if (mounted > 0 || status !== 'ready') return
          const e = engine
          engine = null; canvas = null; loading = null; status = 'idle'
          e?.dispose()
          emit()
        }, 60_000)
      }
    }
  }, [allowed, st])

  const viewKey = `${view.drawKey}|${view.out}|${view.count}|${view.landAt}|${view.spin ? 1 : 0}|${view.inside.join(',')}`
  useEffect(() => {
    if (st === 'ready' && engine && host === ref.current) engine.show(toLocal(viewRef.current))
  }, [viewKey, st])

  if (!allowed || st !== 'ready') return <>{fallback}</>
  return (
    <div
      ref={ref}
      className="m3d"
      data-testid="machine-3d"
      aria-hidden
      style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, ...style }}
    />
  )
}

/** Échantillon stable de boules visibles : ordre pseudo-aléatoire fixe pour la partie, sans les numéros sortis. */
export function stableInside(candidates: readonly number[], out: ReadonlySet<number>, seed: string, count = 90): number[] {
  let x = 2166136261
  for (let i = 0; i < seed.length; i++) x = Math.imul(x ^ seed.charCodeAt(i), 16777619) >>> 0
  const rnd = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296 }
  const order = candidates.map((n) => [rnd(), n] as const).sort((a, b) => a[0] - b[0])
  const res: number[] = []
  for (const [, n] of order) {
    if (out.has(n)) continue
    res.push(n)
    if (res.length >= count) break
  }
  return res
}
