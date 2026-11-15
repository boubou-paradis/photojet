// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot - validation des requêtes (pure, testée). Les règles du jeu
// sont vérifiées par le moteur ; ici on ne laisse passer que des formes
// connues, sans jamais accepter d'énigme venant du navigateur pour une partie.

import { isSessionCode, isUuid } from '@/lib/affinity/validation'
import type { Command } from './engine'
import type { Settings } from './types'

export { isSessionCode, isUuid }

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/
export const isCaptainToken = (v: unknown): v is string => typeof v === 'string' && TOKEN_RE.test(v)

const HEX_RE = /^#[0-9A-Fa-f]{6}$/
const DISPLAYS = ['board', 'standings', 'rules', 'black'] as const

/** Commandes de la régie transmises au moteur (startGame et tiebreak : énigmes tirées par le serveur). */
export type RegieCommand =
  | Exclude<Command, { type: 'startGame' } | { type: 'tiebreak' } | { type: 'buzz' } | { type: 'setTeams' }>
  | { type: 'setTeams'; teams: { id?: string; name: string; color: string }[] }
  | { type: 'startGame' }
  | { type: 'tiebreak' }
  | { type: 'tick' }

export type AdminAction =
  | { action: 'snapshot' }
  | { action: 'launch' }
  | { action: 'exit' }
  | { action: 'heartbeat' }
  | { action: 'release'; teamId: string }
  | { action: 'command'; command: RegieCommand }

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const int = (v: unknown): v is number => num(v) && Number.isInteger(v)
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max

function parseSettings(raw: unknown): Partial<Settings> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const out: Partial<Settings> = {}
  for (const k of ['puzzleCount', 'lettersRounds', 'pointsPerPuzzle', 'revealIntervalMs', 'answerMs', 'finalWindowMs', 'wrongPenalty', 'turnMs'] as const) {
    if (k in o) {
      if (!int(o[k])) return null
      out[k] = o[k] as number
    }
  }
  if ('finale' in o) {
    const f = o.finale as Record<string, unknown> | null
    if (!f || typeof f !== 'object') return null
    const finale: Partial<Settings['finale']> = {}
    if ('enabled' in f) {
      if (typeof f.enabled !== 'boolean') return null
      finale.enabled = f.enabled
    }
    for (const k of ['puzzles', 'base', 'bonusPerHidden'] as const) {
      if (k in f) {
        if (!int(f[k])) return null
        finale[k] = f[k] as number
      }
    }
    out.finale = finale as Settings['finale']
  }
  if ('setIds' in o) {
    if (!Array.isArray(o.setIds) || o.setIds.length > 100 || !o.setIds.every(isUuid)) return null
    out.setIds = o.setIds as string[]
  }
  if ('theme' in o) {
    const t = o.theme as Record<string, unknown> | null
    if (t === null) out.theme = null
    else if (t && typeof t === 'object' && str(t.id, 40) && num(t.at)) out.theme = { id: t.id as string, at: t.at as number }
    else return null
  }
  return out
}

function parseCommand(raw: unknown): RegieCommand | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  switch (c.type) {
    case 'startReveal':
    case 'pause':
    case 'resume':
    case 'revealLetter':
    case 'undo':
    case 'skip':
    case 'revealSolution':
    case 'passTurn':
    case 'startFinale':
    case 'finish':
    case 'reset':
    case 'startGame':
    case 'tiebreak':
    case 'tick':
      return { type: c.type } as RegieCommand
    case 'judge':
      return typeof c.correct === 'boolean' && int(c.windowId) ? { type: 'judge', correct: c.correct, windowId: c.windowId as number } : null
    case 'cancelBuzz':
      return int(c.windowId) ? { type: 'cancelBuzz', windowId: c.windowId as number } : null
    case 'solveTurn':
      return typeof c.correct === 'boolean' ? { type: 'solveTurn', correct: c.correct } : null
    case 'next':
      return str(c.roundKey, 200) ? { type: 'next', roundKey: c.roundKey as string } : null
    case 'display':
      return DISPLAYS.includes(c.display as (typeof DISPLAYS)[number]) ? { type: 'display', display: c.display as (typeof DISPLAYS)[number] } : null
    case 'proposeLetter':
      return str(c.letter, 4) ? { type: 'proposeLetter', letter: c.letter as string } : null
    case 'adjustScore':
      return isUuid(c.teamId) && int(c.delta) ? { type: 'adjustScore', teamId: c.teamId, delta: c.delta as number } : null
    case 'renameTeam': {
      if (!isUuid(c.teamId)) return null
      if (c.name !== undefined && !str(c.name, 40)) return null
      if (c.color !== undefined && !(typeof c.color === 'string' && HEX_RE.test(c.color))) return null
      return { type: 'renameTeam', teamId: c.teamId, name: c.name as string | undefined, color: c.color as string | undefined }
    }
    case 'setTeams': {
      if (!Array.isArray(c.teams) || c.teams.length > 10) return null
      const teams: { id?: string; name: string; color: string }[] = []
      for (const t of c.teams as Record<string, unknown>[]) {
        if (!t || typeof t !== 'object' || !str(t.name, 40) || !(typeof t.color === 'string' && HEX_RE.test(t.color))) return null
        if (t.id !== undefined && !isUuid(t.id)) return null
        teams.push({ id: t.id as string | undefined, name: t.name as string, color: t.color })
      }
      return { type: 'setTeams', teams }
    }
    case 'setSettings': {
      const settings = parseSettings(c.settings)
      return settings ? { type: 'setSettings', settings } : null
    }
    default:
      return null
  }
}

export function parseAdminRequest(body: unknown): Validated<{ sessionId: string } & AdminAction> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Requête invalide.' }
  const o = body as Record<string, unknown>
  if (!isUuid(o.sessionId)) return { ok: false, error: 'Session invalide.' }
  const sessionId = o.sessionId
  switch (o.action) {
    case 'snapshot':
    case 'launch':
    case 'exit':
    case 'heartbeat':
      return { ok: true, value: { sessionId, action: o.action } }
    case 'release':
      return isUuid(o.teamId) ? { ok: true, value: { sessionId, action: 'release', teamId: o.teamId } } : { ok: false, error: 'Équipe invalide.' }
    case 'command': {
      const command = parseCommand(o.command)
      return command ? { ok: true, value: { sessionId, action: 'command', command } } : { ok: false, error: 'Commande invalide.' }
    }
    default:
      return { ok: false, error: 'Action inconnue.' }
  }
}

export function parseJoinRequest(body: unknown): Validated<{ code: string; teamId: string }> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Requête invalide.' }
  const o = body as Record<string, unknown>
  const code = typeof o.code === 'string' ? o.code.trim().toUpperCase() : null
  if (!isSessionCode(code)) return { ok: false, error: 'Code de session invalide.' }
  if (!isUuid(o.teamId)) return { ok: false, error: 'Choisis ton équipe.' }
  return { ok: true, value: { code, teamId: o.teamId } }
}

export function parseCaptainRequest(body: unknown): Validated<{ sessionId: string; teamId: string; token: string }> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Requête invalide.' }
  const o = body as Record<string, unknown>
  if (!isUuid(o.sessionId) || !isUuid(o.teamId) || !isCaptainToken(o.token)) return { ok: false, error: 'Requête invalide.' }
  return { ok: true, value: { sessionId: o.sessionId, teamId: o.teamId, token: o.token } }
}
