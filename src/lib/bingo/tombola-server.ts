// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo · Tombola : accès base, côté serveur uniquement (routes API,
// cron). Tables bingo_tombola* fermées (RLS sans policy) : seul le client
// service_role les lit. Tout ce qui doit être atomique (tirage, ticket,
// absent) est tranché par les fonctions SQL bingo_tombola_*.
// Ne jamais importer ce fichier depuis un composant client.

import type { SupabaseClient } from '@supabase/supabase-js'
import { OTHER_GAME_FLAGS, isAnimatorAlive, type OtherGameFlags } from './server'
import type { TombolaPublicState } from './tombola'

export type TombolaErrorCode =
  | 'no_game' | 'invalid' | 'overlap' | 'too_fast' | 'empty' | 'not_last'
  | 'loto_running' | 'no_phone' | 'closed' | 'full' | 'unknown'

const MESSAGES: Record<TombolaErrorCode, [string, number]> = {
  no_game: ['Aucune tombola en cours.', 409],
  invalid: ['Action impossible pour le moment.', 409],
  overlap: ['Cette plage touche les numéros des tickets téléphone.', 409],
  too_fast: ['Un numéro vient de sortir : patientez un instant.', 429],
  empty: ['Tous les numéros sont sortis.', 409],
  not_last: ['Seul le dernier numéro sorti peut être modifié.', 409],
  loto_running: ['Un loto est en cours : quittez-le avant de lancer la tombola.', 409],
  no_phone: ['Cette tombola n’a pas de tickets sur téléphone.', 409],
  closed: ['Le tirage a commencé : la distribution des tickets est terminée.', 409],
  full: ['Plus aucun ticket disponible.', 409],
  unknown: ['Réseau saturé, réessayez dans un instant.', 503],
}

export class TombolaError extends Error {
  readonly status: number
  constructor(readonly code: TombolaErrorCode) {
    super(MESSAGES[code][0])
    this.status = MESSAGES[code][1]
  }
}

async function rpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args)
  if (error) {
    const m = (error.message ?? '').trim()
    const code = (m in MESSAGES ? m : 'unknown') as TombolaErrorCode
    if (code === 'unknown') console.error(`[AnimaBingo tombola] ${fn} :`, error.message)
    throw new TombolaError(code)
  }
  return data as T
}

/** Une tombola existe-t-elle sur cette session (même en pause) ? */
export async function tombolaExists(admin: SupabaseClient, sessionId: string): Promise<boolean> {
  const { data, error } = await admin.from('bingo_tombola').select('session_id').eq('session_id', sessionId).maybeSingle()
  if (error) throw new TombolaError('unknown')
  return !!data
}

/**
 * Où en est la tombola d'une session (par code), mêmes règles que le loto :
 * missing (code inconnu) | off (aucune tombola) | other (autre jeu à l'écran :
 * en pause, rien n'est effacé) | stale (régie silencieuse depuis 3 min) | live.
 */
export type TombolaPresence =
  | { status: 'missing'; id: null; tombolaId: null }
  | { status: 'off'; id: string; tombolaId: null }
  | { status: 'other' | 'stale' | 'live'; id: string; tombolaId: string }

export async function findTombola(admin: SupabaseClient, code: string): Promise<TombolaPresence> {
  const { data, error } = await admin
    .from('sessions')
    .select(`id, bingo_active, ${OTHER_GAME_FLAGS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()
  if (error) throw new TombolaError('unknown')
  const session = data as ({ id: string; bingo_active: boolean | null } & OtherGameFlags) | null
  if (!session) return { status: 'missing', id: null, tombolaId: null }
  const { data: t, error: tError } = await admin
    .from('bingo_tombola')
    .select('tombola_id, heartbeat_at')
    .eq('session_id', session.id)
    .maybeSingle()
  if (tError) throw new TombolaError('unknown')
  if (!t) return { status: 'off', id: session.id, tombolaId: null }
  const tombolaId = t.tombola_id as string
  if (!session.bingo_active || OTHER_GAME_FLAGS.some((f) => session[f] === true)) return { status: 'other', id: session.id, tombolaId }
  return { status: isAnimatorAlive(t.heartbeat_at as string) ? 'live' : 'stale', id: session.id, tombolaId }
}

export function tombolaState(admin: SupabaseClient, sessionId: string): Promise<TombolaPublicState> {
  return rpc<TombolaPublicState>(admin, 'bingo_tombola_public_state', { p_session_id: sessionId })
}

/** Ticket téléphone : même jeton = même numéro (idempotent, en base). */
export function tombolaTicket(admin: SupabaseClient, sessionId: string, tokenHash: string): Promise<{ tombolaId: string; number: number }> {
  return rpc(admin, 'bingo_tombola_ticket', { p_session_id: sessionId, p_token_hash: tokenHash })
}

// ---------------------------------------------------------------- régie

export type TombolaCommand =
  | { action: 'launch' | 'config'; paper: [number, number][]; phoneFrom: number | null }
  | { action: 'exit' | 'heartbeat' }
  | { action: 'phones'; open: boolean }
  | { action: 'draw'; expect: number }
  | { action: 'mark'; seq: number; outcome: 'winner' | 'absent' | 'already' }

const int = (x: unknown, min: number, max: number): number | null =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max ? x : null

function parseRanges(x: unknown): [number, number][] | null {
  if (!Array.isArray(x) || x.length > 20) return null
  const out: [number, number][] = []
  for (const r of x) {
    if (!Array.isArray(r) || r.length !== 2) return null
    const a = int(r[0], 1, 9999)
    const b = int(r[1], 1, 9999)
    if (a === null || b === null || a > b) return null
    out.push([a, b])
  }
  return out
}

/** Vérifie une commande de la régie (forme seulement : la base revérifie tout). */
export function parseTombolaCommand(body: unknown): TombolaCommand | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  switch (b.action) {
    case 'launch': case 'config': {
      const paper = parseRanges(b.paper)
      const phoneFrom = b.phoneFrom === null ? null : int(b.phoneFrom, 1, 9999)
      if (!paper || (b.phoneFrom !== null && phoneFrom === null)) return null
      return { action: b.action, paper, phoneFrom }
    }
    case 'exit': case 'heartbeat': return { action: b.action }
    case 'phones': return typeof b.open === 'boolean' ? { action: 'phones', open: b.open } : null
    case 'draw': {
      const expect = int(b.expect, 0, 10000)
      return expect === null ? null : { action: 'draw', expect }
    }
    case 'mark': {
      const seq = int(b.seq, 1, 10000)
      const o = b.outcome
      return seq !== null && (o === 'winner' || o === 'absent' || o === 'already') ? { action: 'mark', seq, outcome: o } : null
    }
    default: return null
  }
}

export function runTombola(admin: SupabaseClient, sessionId: string, c: TombolaCommand): Promise<unknown> {
  const { action, ...args } = c
  return rpc(admin, 'bingo_tombola_admin', { p_session_id: sessionId, p_action: action, p_args: args })
}

export interface TombolaSnapshot {
  state: TombolaPublicState
  /** Tombola existante mais un autre jeu est à l'écran : en pause, rien n'est effacé. */
  held: boolean
  /** Un loto existe sur la session : la tombola ne peut pas démarrer. */
  lotoRunning: boolean
}

export async function tombolaSnapshot(admin: SupabaseClient, sessionId: string): Promise<TombolaSnapshot> {
  const [state, flags, loto] = await Promise.all([
    tombolaState(admin, sessionId),
    admin.from('sessions').select('bingo_active').eq('id', sessionId).maybeSingle(),
    admin.from('bingo_runtime').select('session_id').eq('session_id', sessionId).maybeSingle(),
  ])
  if (flags.error || loto.error) throw new TombolaError('unknown')
  const shown = (flags.data as { bingo_active?: boolean } | null)?.bingo_active === true
  return { state, held: state.active && !shown, lotoRunning: !!loto.data }
}
