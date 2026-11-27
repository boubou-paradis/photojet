'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Mode d'affichage des plateaux 3D (Roue, À Demi-Mot, machine AnimaBingo) : l'écran /live le signale à la régie,
// la régie peut demander « Réessayer la 3D ». Aucune écriture en base :
//   - même navigateur (régie + /live sur le même PC) : BroadcastChannel ;
//   - autre appareil : canal temps réel Supabase `fx3d-<code>` (diffusion, rien n'est stocké).
// Les derniers replis sont gardés sur le PC de l'écran (localStorage) et renvoyés à la régie : preuve au prochain retour.

import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

export type Fx3dGame = 'wheel' | 'demimot' | 'bingo'
/** too_slow = PC trop lent · context_lost = contexte graphique perdu (relances épuisées) · load_failed = ressources 3D
 *  introuvables · no_webgl = 3D impossible sur ce navigateur · forced = 2D choisie (régie ou ?roue=2d / ?machine=2d). */
export type Fx3dReason = 'too_slow' | 'context_lost' | 'load_failed' | 'no_webgl' | 'forced'
export type Fx3dMode = '3d' | '2d' | 'loading' | 'off'

export interface Fx3dEvent { game: Fx3dGame; reason: Fx3dReason; fps?: number; at: number }

export interface Fx3dStatus {
  game: Fx3dGame
  mode: Fx3dMode
  reason?: Fx3dReason
  /** Images/s mesurées au moment du repli (PC trop lent). */
  fps?: number
  /** Repli décidé, en attente de la fin de l'animation en cours (images/s mesurées). */
  pendingFps?: number
  /** Relance de la 3D après une perte du contexte graphique. */
  restarting?: boolean
  at: number
  /** Derniers replis enregistrés sur le PC de l'écran (plus récent en dernier). */
  log: Fx3dEvent[]
}

type Msg =
  | { t: 'status'; s: Fx3dStatus }
  | { t: 'ask' }
  | { t: 'retry'; game: Fx3dGame; id: string }

const LOG_KEY = 'animajet.fx3d.log'
const LOG_MAX = 12
const HEARTBEAT_MS = 15_000

export const FX3D_REASON_LABEL: Record<Fx3dReason, string> = {
  too_slow: 'PC trop lent',
  context_lost: 'contexte graphique perdu',
  load_failed: 'ressources 3D non chargées',
  no_webgl: '3D impossible sur ce navigateur',
  forced: '2D choisie',
}

// ------------------------------------------------------------------ côté écran (/live)

const statuses = new Map<Fx3dGame, Fx3dStatus>()
const retryHandlers = new Map<Fx3dGame, Set<() => void>>()
const senders = new Set<(m: Msg) => void>()
const handledRetries = new Set<string>()

function readLog(): Fx3dEvent[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(LOG_KEY) ?? '[]')
    return Array.isArray(v) ? (v as Fx3dEvent[]).slice(-LOG_MAX) : []
  } catch {
    return []
  }
}

function pushLog(ev: Fx3dEvent) {
  const log = [...readLog(), ev].slice(-LOG_MAX)
  try { window.localStorage.setItem(LOG_KEY, JSON.stringify(log)) } catch { /* stockage bloqué */ }
}

function send(m: Msg) {
  for (const s of senders) { try { s(m) } catch { /* canal fermé */ } }
}

/** Le jeu affiché sur le grand écran signale son mode (3D, 2D + raison, chargement, ou 'off' quand il quitte l'écran). */
export function reportFx3d(game: Fx3dGame, s: { mode: Fx3dMode; reason?: Fx3dReason; fps?: number; pendingFps?: number; restarting?: boolean }) {
  if (typeof window === 'undefined') return
  const prev = statuses.get(game)
  const fps = s.fps !== undefined ? Math.round(s.fps) : undefined
  const pendingFps = s.pendingFps !== undefined ? Math.round(s.pendingFps) : undefined
  if (prev && prev.mode === s.mode && prev.reason === s.reason && prev.fps === fps && prev.pendingFps === pendingFps && !!prev.restarting === !!s.restarting) return
  // un vrai repli (pas un choix, pas une absence de WebGL déjà connue) est gardé en mémoire sur ce PC
  if (s.mode === '2d' && s.reason && s.reason !== 'forced' && !(prev?.mode === '2d' && prev.reason === s.reason)) {
    pushLog({ game, reason: s.reason, fps, at: Date.now() })
    console.warn(`[AnimaJet 3D] ${game} : repli 2D (${FX3D_REASON_LABEL[s.reason]}${fps !== undefined ? `, ${fps} images/s` : ''})`)
  }
  const st: Fx3dStatus = { game, mode: s.mode, reason: s.reason, fps, pendingFps, restarting: s.restarting || undefined, at: Date.now(), log: readLog().filter((e) => e.game === game) }
  if (s.mode === 'off') statuses.delete(game)
  else statuses.set(game, st)
  ;(window as unknown as { __fx3d?: unknown }).__fx3d = Object.fromEntries(statuses)
  send({ t: 'status', s: st })
}

/** « Réessayer la 3D » demandé par la régie. */
export function onFx3dRetry(game: Fx3dGame, cb: () => void): () => void {
  let set = retryHandlers.get(game)
  if (!set) retryHandlers.set(game, (set = new Set()))
  set.add(cb)
  return () => { set.delete(cb) }
}

function handleScreenMsg(m: Msg) {
  if (m.t === 'ask') {
    for (const s of statuses.values()) send({ t: 'status', s: { ...s, log: readLog().filter((e) => e.game === s.game) } })
  } else if (m.t === 'retry') {
    if (handledRetries.has(m.id)) return // reçu par les deux canaux
    handledRetries.add(m.id)
    for (const cb of retryHandlers.get(m.game) ?? []) cb()
  }
}

function openTransports(code: string, supabase: SupabaseClient | null, onMsg: (m: Msg) => void): { send: (m: Msg) => void; close: () => void } {
  let bc: BroadcastChannel | null = null
  let ch: RealtimeChannel | null = null
  try {
    bc = new BroadcastChannel(`animajet-fx3d-${code}`)
    bc.onmessage = (e) => onMsg(e.data as Msg)
  } catch { bc = null }
  try {
    if (supabase) {
      ch = supabase.channel(`fx3d-${code}`).on('broadcast', { event: 'fx3d' }, (p) => { if (p.payload) onMsg(p.payload as Msg) })
      ch.subscribe((state) => { if (state === 'SUBSCRIBED') onMsg({ t: '__open' } as unknown as Msg) })
    }
  } catch { ch = null }
  return {
    send: (m) => {
      try { bc?.postMessage(m) } catch { /* fermé */ }
      try { void ch?.send({ type: 'broadcast', event: 'fx3d', payload: m }) } catch { /* hors ligne */ }
    },
    close: () => {
      try { bc?.close() } catch { /* déjà fermé */ }
      if (ch && supabase) void supabase.removeChannel(ch)
    },
  }
}

/** À monter une fois sur /live/<code> : relie les plateaux 3D de l'écran à la régie. */
export function useFx3dLink(code: string | null | undefined, supabase: SupabaseClient | null) {
  useEffect(() => {
    if (!code) return
    const tr = openTransports(code, supabase, (m) => {
      if ((m as { t: string }).t === '__open') { for (const s of statuses.values()) tr.send({ t: 'status', s }); return }
      handleScreenMsg(m)
    })
    senders.add(tr.send)
    for (const s of statuses.values()) tr.send({ t: 'status', s })
    const hb = setInterval(() => { for (const s of statuses.values()) tr.send({ t: 'status', s: { ...s, at: Date.now() } }) }, HEARTBEAT_MS)
    return () => { clearInterval(hb); senders.delete(tr.send); tr.close() }
  }, [code, supabase])
}

// ------------------------------------------------------------------ côté régie

export interface Fx3dMonitor {
  /** Dernier état reçu de l'écran (null = aucun écran ne montre ce jeu en ce moment). */
  status: Fx3dStatus | null
  /** Heure de réception du dernier message de l'écran. */
  seenAt: number
  retry: () => void
}

/** Régie : écoute le mode d'affichage du jeu sur le grand écran et permet de relancer la 3D. */
export function useFx3dMonitor(code: string | null | undefined, game: Fx3dGame, supabase: SupabaseClient | null): Fx3dMonitor {
  const [status, setStatus] = useState<Fx3dStatus | null>(null)
  const [seenAt, setSeenAt] = useState(0)
  const sendRef = useRef<((m: Msg) => void) | null>(null)
  useEffect(() => {
    if (!code) return
    const tr = openTransports(code, supabase, (m) => {
      if ((m as { t: string }).t === '__open') { tr.send({ t: 'ask' }); return }
      if (m.t !== 'status' || m.s.game !== game) return
      setSeenAt(Date.now())
      setStatus(m.s.mode === 'off' ? null : m.s)
    })
    sendRef.current = tr.send
    tr.send({ t: 'ask' })
    // l'écran se tait (fermé, autre jeu affiché sans message « off ») : l'état n'est plus garanti
    const stale = setInterval(() => setSeenAt((t) => { if (t && Date.now() - t > HEARTBEAT_MS * 3) setStatus(null); return t }), 5000)
    return () => { clearInterval(stale); sendRef.current = null; tr.close() }
  }, [code, game, supabase])
  return {
    status,
    seenAt,
    retry: () => sendRef.current?.({ t: 'retry', game, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }),
  }
}
