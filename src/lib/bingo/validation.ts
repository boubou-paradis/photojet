// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Validation des entrées (téléphones et régie). Rien n'est cru tel quel :
// tout ce qui arrive du navigateur passe par ici avant d'atteindre la base.

import { isSessionCode, isUuid } from '@/lib/affinity/validation'
import { BINGO_MAX_CARDS_PER_PLAYER, BINGO_NAME_MAX, BINGO_PAPER_MAX_PER_BATCH, BINGO_PHASES } from './constants'
import { LOTS_MAX } from './formulas'
import type { AutoMode, BingoSettings, Cells, Phase } from './types'

export { isSessionCode, isUuid }

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

export const DEFAULT_SETTINGS: BingoSettings = {
  cardsPerPlayer: 1,
  pauseOnClaim: true,
  voice: 'tts',
  advance: 'manual',
  tie: 'shared',
  repeatCard: false,
  formula: 'classic',
  public: { showLast: true, showName: true, screen: 'machine' },
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d)

/** Réglages complets à partir de n'importe quoi (valeurs inconnues → défaut). */
export function parseSettings(x: unknown, base: BingoSettings = DEFAULT_SETTINGS): BingoSettings {
  const o = isObj(x) ? x : {}
  const p = isObj(o.public) ? o.public : {}
  const cards = Number(o.cardsPerPlayer)
  return {
    cardsPerPlayer: Number.isInteger(cards) && cards >= 1 && cards <= BINGO_MAX_CARDS_PER_PLAYER ? (cards as BingoSettings['cardsPerPlayer']) : base.cardsPerPlayer,
    pauseOnClaim: bool(o.pauseOnClaim, base.pauseOnClaim),
    voice: o.voice === 'off' || o.voice === 'tts' || o.voice === 'recordings' ? o.voice : base.voice,
    advance: o.advance === 'auto' || o.advance === 'manual' ? o.advance : base.advance,
    tie: o.tie === 'each' || o.tie === 'shared' ? o.tie : base.tie,
    repeatCard: bool(o.repeatCard, base.repeatCard),
    formula: o.formula === 'classic' || o.formula === 'plein' || o.formula === 'suivie' || o.formula === 'custom' ? o.formula : base.formula,
    public: {
      showLast: bool(p.showLast, base.public.showLast),
      showName: bool(p.showName, base.public.showName),
      screen: p.screen === 'board' || p.screen === 'machine' ? p.screen : base.public.screen,
    },
  }
}

/** Prénom affichable : espaces resserrés, caractères de contrôle retirés, 1 à 20 caractères. */
export function cleanName(x: unknown): string | null {
  if (typeof x !== 'string') return null
  const s = x.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
  if (!s) return null
  return Array.from(s).slice(0, BINGO_NAME_MAX).join('').trim()
}

/** Phases dans l'ordre choisi : 1 à 3, sans doublon. */
export function parsePhases(x: unknown): Phase[] | null {
  if (!Array.isArray(x) || x.length < 1 || x.length > 3) return null
  if (!x.every((p): p is Phase => (BINGO_PHASES as readonly string[]).includes(p as string))) return null
  return new Set(x).size === x.length ? x : null
}

/** Lots par étape : un entier de 1 à 20 pour chaque étape. */
export function parseLots(x: unknown, phases: number): number[] | null {
  if (!Array.isArray(x) || x.length !== phases) return null
  return x.every((n) => Number.isInteger(n) && n >= 1 && n <= LOTS_MAX) ? (x as number[]) : null
}

/** Coches envoyées avec une demande : 15 au plus, toutes présentes sur le carton, sans doublon. */
export function parseMarks(x: unknown, cells: Cells): number[] | null {
  if (!Array.isArray(x) || x.length > 15) return null
  const onCard = new Set(cells.filter(Boolean))
  if (!x.every((n) => Number.isInteger(n) && onCard.has(n as number))) return null
  return [...new Set(x as number[])]
}

const str = (x: unknown) => (typeof x === 'string' ? x : '')
const code = (x: unknown) => str(x).trim().toUpperCase()
const isToken = (x: unknown): x is string => typeof x === 'string' && x.length >= 32 && x.length <= 128

export function parseJoin(body: unknown): Validated<{ code: string; name: string; token: string | null }> {
  if (!isObj(body)) return { ok: false, error: 'Requête invalide.' }
  const c = code(body.code)
  if (!isSessionCode(c)) return { ok: false, error: 'Code de session invalide.' }
  const token = body.token == null ? null : isToken(body.token) ? body.token : undefined
  if (token === undefined) return { ok: false, error: 'Requête invalide.' }
  const name = cleanName(body.name)
  if (!name && !token) return { ok: false, error: 'Indique ton prénom.' }
  return { ok: true, value: { code: c, name: name ?? 'Joueur', token } }
}

export function parseClaim(body: unknown): Validated<{ code: string; token: string; cardId: string; marks: unknown }> {
  if (!isObj(body)) return { ok: false, error: 'Requête invalide.' }
  const c = code(body.code)
  if (!isSessionCode(c) || !isToken(body.token) || !isUuid(body.cardId)) return { ok: false, error: 'Requête invalide.' }
  return { ok: true, value: { code: c, token: body.token, cardId: body.cardId, marks: body.marks } }
}

/** Commandes de la régie (envoyées à bingo_admin après mise en forme). */
export type AdminCommand =
  | { action: 'launch' | 'new_game'; settings: BingoSettings; phases: Phase[]; lots?: number[]; playlistId?: string }
  | { action: 'new_round'; settings?: BingoSettings; phases?: Phase[]; lots?: number[] }
  | { action: 'settings'; settings: BingoSettings; phases?: Phase[]; lots?: number[] }
  | { action: 'next_phase' | 'advance' | 'jump_final'; expect?: number }
  | { action: 'formula'; phases: Phase[]; lots: number[]; expect?: number }
  | { action: 'start' | 'resume' | 'heartbeat' | 'exit' | 'paper_clear' | 'paper_list' | 'reveal' }
  | { action: 'draw'; expect: number }
  | { action: 'auto'; mode: AutoMode; ms?: number }
  | { action: 'decide'; claimId: number; accept: boolean; name?: string }
  | { action: 'paper_win' | 'paper_check'; serial: number }
  | { action: 'paper_add'; count: number }

export function parseAdmin(body: unknown): Validated<{ sessionId: string; command: AdminCommand }> {
  if (!isObj(body) || !isUuid(body.sessionId)) return { ok: false, error: 'Requête invalide.' }
  const a = body.action
  const bad = { ok: false as const, error: 'Commande invalide.' }
  let command: AdminCommand
  switch (a) {
    case 'launch': case 'new_game': {
      // launch REPREND une partie existante (rien effacé) ; new_game repart de zéro.
      const phases = body.phases === undefined ? [...BINGO_PHASES] : parsePhases(body.phases)
      if (!phases) return bad
      if (body.playlistId !== undefined && body.playlistId !== null && !isUuid(body.playlistId)) return bad
      const lots = body.lots === undefined ? undefined : parseLots(body.lots, phases.length)
      if (lots === null) return bad
      command = { action: a, settings: parseSettings(body.settings), phases, ...(lots ? { lots } : {}), ...(isUuid(body.playlistId) ? { playlistId: body.playlistId } : {}) }
      break
    }
    case 'new_round': {
      // Nouvelle partie de la soirée : mêmes joueurs et mêmes cartons (téléphones et papier).
      const phases = body.phases === undefined ? undefined : parsePhases(body.phases)
      if (phases === null) return bad
      const lots = body.lots === undefined ? undefined : parseLots(body.lots, phases?.length ?? -1)
      if (lots === null || (lots && !phases)) return bad
      command = { action: 'new_round', ...(body.settings !== undefined ? { settings: parseSettings(body.settings) } : {}), ...(phases ? { phases } : {}), ...(lots ? { lots } : {}) }
      break
    }
    case 'settings': {
      const phases = body.phases === undefined ? undefined : parsePhases(body.phases)
      if (phases === null) return bad
      const lots = body.lots === undefined ? undefined : parseLots(body.lots, phases?.length ?? -1)
      if (lots === null || (lots && !phases)) return bad
      command = { action: 'settings', settings: parseSettings(body.settings), ...(phases ? { phases } : {}), ...(lots ? { lots } : {}) }
      break
    }
    case 'formula': {
      // Formule choisie en direct : la base protège les étapes jouées et les lots gagnés.
      const phases = parsePhases(body.phases)
      const lots = phases ? parseLots(body.lots, phases.length) : null
      if (!phases || !lots) return bad
      if (body.expect !== undefined && (!Number.isInteger(body.expect) || (body.expect as number) < 0 || (body.expect as number) > 3)) return bad
      command = { action: 'formula', phases, lots, ...(body.expect !== undefined ? { expect: body.expect as number } : {}) }
      break
    }
    case 'next_phase': case 'advance': case 'jump_final':
      // expect = étape affichée : un double clic ou un renvoi ne saute jamais deux étapes.
      if (body.expect !== undefined && (!Number.isInteger(body.expect) || (body.expect as number) < 0 || (body.expect as number) > 3)) return bad
      command = { action: a, ...(body.expect !== undefined ? { expect: body.expect as number } : {}) }
      break
    case 'start': case 'resume': case 'heartbeat': case 'exit': case 'paper_clear': case 'paper_list': case 'reveal':
      command = { action: a }
      break
    case 'draw':
      if (!Number.isInteger(body.expect) || (body.expect as number) < 0 || (body.expect as number) > 90) return bad
      command = { action: 'draw', expect: body.expect as number }
      break
    case 'auto': {
      if (body.mode !== 'manual' && body.mode !== 'auto' && body.mode !== 'paused') return bad
      const ms = Number(body.ms)
      command = { action: 'auto', mode: body.mode, ...(Number.isFinite(ms) ? { ms: Math.min(20_000, Math.max(4_000, Math.round(ms))) } : {}) }
      break
    }
    case 'decide': {
      if (!Number.isSafeInteger(body.claimId) || typeof body.accept !== 'boolean') return bad
      const name = body.name === undefined ? undefined : cleanName(body.name)
      command = { action: 'decide', claimId: body.claimId as number, accept: body.accept, ...(name ? { name } : {}) }
      break
    }
    case 'paper_win': case 'paper_check':
      if (!Number.isInteger(body.serial) || (body.serial as number) < 1 || (body.serial as number) > 9999) return bad
      command = { action: a, serial: body.serial as number }
      break
    case 'paper_add':
      if (!Number.isInteger(body.count) || (body.count as number) < 1 || (body.count as number) > BINGO_PAPER_MAX_PER_BATCH) return bad
      command = { action: 'paper_add', count: body.count as number }
      break
    default:
      return bad
  }
  return { ok: true, value: { sessionId: body.sessionId, command } }
}
