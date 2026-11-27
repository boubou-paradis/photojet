'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo — machine 3D du grand écran, avec repli automatique sur la machine 2D :
//   - pas de WebGL, modèle introuvable ;
//   - contexte graphique perdu : 2D le temps de relancer la 3D (2 relances au plus en 5 min, ensuite 2D) ;
//   - moins de 22 images/s pendant 10 s (PC trop lent, voir lib/fx3d/guard.ts), appliqué seulement hors tirage ;
//     un affichage bloqué à 30 images/s ne compte jamais ; « Réessayer la 3D » en régie ou un rechargement retente la 3D ;
//   - « Réduire les animations » demandé par le système ;
//   - « Machine 2D » choisie en régie (ou /live/<code>?machine=2d).
// Un seul moteur par page : le canevas passe d'une scène à l'autre sans rechargement.
// Au repos (pas de tirage), le rendu est limité à 30 images/s. La régie voit le mode affiché (lib/fx3d/status.ts).
// three n'est chargé qu'ici (jamais sur les téléphones, la régie ni l'accueil).

import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { readMachinePref, subscribeMachinePref } from '@/lib/bingo/machine-pref'
import type { MachineEngine, MachineView } from './MachineEngine'
import { RenderGuard } from '@/lib/fx3d/guard'
import { onFx3dRetry, reportFx3d, type Fx3dReason } from '@/lib/fx3d/status'

export type { MachineView }

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
// surveillance de la fluidité (repos à 30 images/s, repli seulement hors tirage)
let guard: RenderGuard | null = null
let failInfo: { reason: Fx3dReason; fps?: number } | null = null
let pendingFps: number | null = null
// contexte graphique perdu : relances (au plus 2 en 5 minutes)
const MAX_RESTARTS = 2
const RESTART_WINDOW_MS = 5 * 60_000
let restarts: number[] = []
let restarting = false
let restartTimer: ReturnType<typeof setTimeout> | null = null
const debug = (v: Record<string, unknown>) => { (window as unknown as { __bingoMachine3d?: unknown }).__bingoMachine3d = v }

function dropEngine() {
  stopLoop()
  const e = engine
  engine = null
  canvas?.remove()
  canvas = null
  try { e?.dispose() } catch { /* déjà perdu */ }
}

function fail(reason: Fx3dReason, fps?: number) {
  if (status === 'failed') return
  status = 'failed'
  failInfo = { reason, fps }
  pendingFps = null
  restarting = false
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null }
  debug({ status, reason, fps })
  dropEngine()
  emit()
}

function lost() {
  if (status === 'failed') return
  const now = Date.now()
  restarts = restarts.filter((t) => now - t < RESTART_WINDOW_MS)
  dropEngine()
  loading = null
  if (restarts.length >= MAX_RESTARTS) { fail('context_lost'); return }
  restarts.push(now)
  console.warn('[AnimaBingo] contexte graphique perdu : relance de la 3D')
  restarting = true
  status = 'loading'
  debug({ status: 'restarting', restarts: restarts.length })
  emit()
  restartTimer = setTimeout(() => { restartTimer = null; void ensureEngine() }, 1200)
}

// Test WebGL mis en cache (un seul contexte de test par page) ; refait par « Réessayer la 3D ».
let webgl: boolean | null = null
function webglAvailable(): boolean {
  if (webgl !== null) return webgl
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    webgl = !!gl
  } catch {
    webgl = false
  }
  return webgl
}

/** « Réessayer la 3D » (régie) : repart de zéro sans recharger la page. */
export function retryMachine3D() {
  if (status !== 'failed' && webgl !== false) return
  webgl = null
  status = 'idle'
  failInfo = null
  pendingFps = null
  restarts = []
  restarting = false
  loading = null
  emit()
}

function ensureEngine(): Promise<void> {
  if (loading) return loading
  status = 'loading'
  emit()
  const wasRestart = restarting
  loading = (async () => {
    try {
      const { MachineEngine } = await import('./MachineEngine')
      const c = document.createElement('canvas')
      c.className = 'm3d-canvas'
      c.setAttribute('aria-hidden', 'true')
      c.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); if (c === canvas) lost() })
      const e = await MachineEngine.create(c)
      if ((status as Status) === 'failed') { e.dispose(); return }
      engine = e
      canvas = c
      status = 'ready'
      restarting = false
      debug({ status, engine: e })
      emit()
      if (mounted > 0) startLoop()
    } catch (err) {
      console.warn('[AnimaBingo] machine 3D indisponible, machine 2D :', err instanceof Error ? err.message : err)
      // après une perte de contexte, Chrome peut refuser un nouveau contexte : la cause reste le contexte graphique
      fail(wasRestart ? 'context_lost' : 'load_failed')
    }
  })()
  return loading
}

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  const e = engine
  if (!e || !host || !guard) return
  const busy = e.busy
  // au repos : ~30 images/s ; onglet caché / machine en veille : image ignorée
  const dt = guard.frame(now, !busy)
  if (dt === null) return
  last = now
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
  // fluidité : sous 22 images/s pendant 10 s → 2D, mais jamais pendant un tirage (attend que la boule soit posée)
  const w = guard.window(now)
  if (w) guard.judge(w, true)
  const p = guard.pendingFps
  if (p !== pendingFps) { pendingFps = p; emit() }
  if (guard.fallbackNow(busy)) fail('too_slow', p ?? undefined)
}

function startLoop() {
  if (raf || !engine) return
  last = performance.now()
  guard = new RenderGuard(last, { warmupMs: 4000 })
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
  return useBlock() === null
}

/** Ce qui empêche la 3D (null = rien) : 2D choisie ou « réduire les animations » / pas de WebGL / échec. */
function useBlock(): Fx3dReason | null {
  const pref = useSyncExternalStore(subscribeMachinePref, readMachinePref, () => '2d' as const)
  const reduced = useReducedMotion()
  const st = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  // relu à chaque rendu (test en cache) : « Réessayer la 3D » le refait
  const env = typeof window === 'undefined' ? false : webglAvailable()
  if (pref === '2d' || reduced) return 'forced'
  if (!env) return 'no_webgl'
  if (st === 'failed') return failInfo?.reason ?? 'load_failed'
  return null
}

// Mode affiché signalé à la régie tant qu'au moins une machine est à l'écran.
let reporters = 0
const pendingSnapshot = () => pendingFps
const pendingServer = (): number | null => null
function useReport() {
  const block = useBlock()
  const st = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const pend = useSyncExternalStore(subscribe, pendingSnapshot, pendingServer)
  useEffect(() => {
    if (block) reportFx3d('bingo', { mode: '2d', reason: block, fps: block === failInfo?.reason ? failInfo?.fps : undefined })
    else if (st === 'ready') reportFx3d('bingo', { mode: '3d', pendingFps: pend ?? undefined })
    else reportFx3d('bingo', { mode: 'loading', restarting })
  }, [block, st, pend])
  useEffect(() => {
    reporters++
    const off = onFx3dRetry('bingo', retryMachine3D)
    return () => {
      off()
      if (--reporters === 0) reportFx3d('bingo', { mode: 'off' })
    }
  }, [])
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
  useReport()
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
