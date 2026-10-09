// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Validation des entrées d'AnimaBuzz. Rien n'est cru sur parole : chaque
// route passe par ces fonctions, puis la base revérifie (contraintes et
// fonctions SQL). Les règles de pseudo sont celles de Matching (même
// normalisation, même suggestion) : réutilisées sans les modifier.

import {
  cleanText,
  isPlayerToken,
  isSessionCode,
  isUuid,
  nicknameKey,
  normalizeNickname,
  suggestNickname,
  type Validated,
} from '@/lib/affinity/validation'
import { BUZZER_LIMITS, BUZZER_TIMERS_S, BUZZER_WINDOWS_MS } from './constants'
import type { BuzzerMode } from './types'

export { isSessionCode, isUuid, nicknameKey, suggestNickname }
export type { Validated }

/** Nom d'équipe affiché : nettoyé, 1 à 24 caractères. */
export function normalizeTeam(value: unknown): Validated<string> {
  if (typeof value !== 'string') return { ok: false, error: 'Choisis ton équipe.' }
  const team = cleanText(value)
  if (!team) return { ok: false, error: 'Choisis ton équipe.' }
  if ([...team].length > BUZZER_LIMITS.teamMaxLength) {
    return { ok: false, error: `Le nom d'équipe doit faire ${BUZZER_LIMITS.teamMaxLength} caractères au maximum.` }
  }
  return { ok: true, value: team }
}

/** Clé d'équipe : « Table 4 », « table4 » et « TABLE 4 » sont la même équipe. */
export const teamKey = nicknameKey

export interface JoinRequest {
  code: string
  nickname: string | null
  team: string | null
}

/** Pseudo OU équipe : le mode de la partie (lu en base) décide lequel est exigé. */
export function parseJoinRequest(body: unknown): Validated<JoinRequest> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Requête invalide.' }
  const { code, nickname, team } = body as Record<string, unknown>
  if (!isSessionCode(code)) return { ok: false, error: 'Code de session invalide.' }
  let nick: string | null = null
  let teamLabel: string | null = null
  if (nickname !== undefined && nickname !== null) {
    const n = normalizeNickname(nickname)
    if (!n.ok) return n
    nick = n.value
  }
  if (team !== undefined && team !== null) {
    const t = normalizeTeam(team)
    if (!t.ok) return t
    teamLabel = t.value
  }
  if (!nick && !teamLabel) return { ok: false, error: 'Choisis un pseudo ou une équipe.' }
  return { ok: true, value: { code, nickname: nick, team: teamLabel } }
}

/**
 * Équipe choisie par un joueur. Liste prédéfinie : seule une équipe de la
 * liste est acceptée (même clé), avec le libellé de l'animateur. Sans liste :
 * saisie libre normalisée.
 */
export function resolveTeam(input: string, predefined: readonly string[]): Validated<{ key: string; label: string }> {
  const key = teamKey(input)
  if (!key) return { ok: false, error: 'Choisis ton équipe.' }
  if (predefined.length === 0) return { ok: true, value: { key, label: input } }
  const match = predefined.find((label) => teamKey(label) === key)
  if (!match) return { ok: false, error: 'Cette équipe n’existe pas. Choisis-la dans la liste.' }
  return { ok: true, value: { key, label: match } }
}

export interface PlayerAuth {
  sessionId: string
  playerId: string
  token: string
}

export function parsePlayerAuth(body: unknown): Validated<PlayerAuth> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Requête invalide.' }
  const { sessionId, playerId, token } = body as Record<string, unknown>
  if (!isUuid(sessionId) || !isUuid(playerId) || !isPlayerToken(token)) {
    return { ok: false, error: 'Identification du joueur invalide.' }
  }
  return { ok: true, value: { sessionId, playerId, token } }
}

function isWindow(value: unknown): value is number {
  return (BUZZER_WINDOWS_MS as readonly unknown[]).includes(value)
}

function isTimer(value: unknown): value is number | null {
  return (BUZZER_TIMERS_S as readonly unknown[]).includes(value)
}

export interface LaunchArgs {
  mode: BuzzerMode
  teams: string[]
  windowMs: number
  timerS: number | null
}

export function parseLaunchArgs(args: unknown): Validated<LaunchArgs> {
  if (typeof args !== 'object' || args === null) return { ok: false, error: 'Réglages invalides.' }
  const { mode, teams, windowMs, timerS } = args as Record<string, unknown>
  if (mode !== 'solo' && mode !== 'team') return { ok: false, error: 'Mode de jeu invalide.' }
  if (!isWindow(windowMs)) return { ok: false, error: 'Fenêtre de buzz invalide.' }
  if (!isTimer(timerS)) return { ok: false, error: 'Chrono invalide.' }

  const list: string[] = []
  if (mode === 'team' && teams !== undefined && teams !== null) {
    if (!Array.isArray(teams)) return { ok: false, error: 'Liste d’équipes invalide.' }
    if (teams.length > BUZZER_LIMITS.maxTeams) return { ok: false, error: `${BUZZER_LIMITS.maxTeams} équipes au maximum.` }
    const keys = new Set<string>()
    for (const raw of teams) {
      const t = normalizeTeam(raw)
      if (!t.ok) return { ok: false, error: `Équipe « ${String(raw)} » : ${t.error}` }
      const key = teamKey(t.value)
      if (keys.has(key)) return { ok: false, error: `L’équipe « ${t.value} » est en double.` }
      keys.add(key)
      list.push(t.value)
    }
  }
  return { ok: true, value: { mode, teams: list, windowMs, timerS } }
}

export interface SettingsArgs {
  windowMs?: number
  timerS?: number | null
}

export function parseSettingsArgs(args: unknown): Validated<SettingsArgs> {
  if (typeof args !== 'object' || args === null) return { ok: false, error: 'Réglages invalides.' }
  const raw = args as Record<string, unknown>
  const out: SettingsArgs = {}
  if ('windowMs' in raw) {
    if (!isWindow(raw.windowMs)) return { ok: false, error: 'Fenêtre de buzz invalide.' }
    out.windowMs = raw.windowMs
  }
  if ('timerS' in raw) {
    if (!isTimer(raw.timerS)) return { ok: false, error: 'Chrono invalide.' }
    out.timerS = raw.timerS
  }
  if (!('windowMs' in out) && !('timerS' in out)) return { ok: false, error: 'Aucun réglage à modifier.' }
  return { ok: true, value: out }
}

/** Actions traitées par la fonction SQL buzzer_admin. */
export const SQL_ADMIN_ACTIONS = [
  'launch', 'exit', 'heartbeat', 'settings', 'test_start', 'test_stop',
  'new_round', 'open', 'timeout', 'right', 'wrong', 'cancel', 'remove_player',
] as const
/** `snapshot` : lecture seule pour la page animateur (joueurs, historique). */
export const ADMIN_ACTIONS = [...SQL_ADMIN_ACTIONS, 'snapshot'] as const
export type BuzzerAdminAction = (typeof ADMIN_ACTIONS)[number]

export type AdminRequest =
  | { sessionId: string; action: 'launch'; args: LaunchArgs }
  | { sessionId: string; action: 'settings'; args: SettingsArgs }
  | { sessionId: string; action: 'remove_player'; args: { playerId: string } }
  | { sessionId: string; action: Exclude<BuzzerAdminAction, 'launch' | 'settings' | 'remove_player'>; args: Record<string, never> }

export function parseAdminRequest(body: unknown): Validated<AdminRequest> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Requête invalide.' }
  const { sessionId, action, args } = body as Record<string, unknown>
  if (!isUuid(sessionId)) return { ok: false, error: 'Session invalide.' }
  if (typeof action !== 'string' || !(ADMIN_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: 'Action inconnue.' }
  }
  const a = action as BuzzerAdminAction
  if (a === 'launch') {
    const parsed = parseLaunchArgs(args)
    return parsed.ok ? { ok: true, value: { sessionId, action: a, args: parsed.value } } : parsed
  }
  if (a === 'settings') {
    const parsed = parseSettingsArgs(args)
    return parsed.ok ? { ok: true, value: { sessionId, action: a, args: parsed.value } } : parsed
  }
  if (a === 'remove_player') {
    const playerId = typeof args === 'object' && args !== null ? (args as Record<string, unknown>).playerId : undefined
    if (!isUuid(playerId)) return { ok: false, error: 'Joueur invalide.' }
    return { ok: true, value: { sessionId, action: a, args: { playerId } } }
  }
  return { ok: true, value: { sessionId, action: a, args: {} } }
}
