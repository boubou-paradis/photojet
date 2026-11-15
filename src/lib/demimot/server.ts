// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Accès base d'À Demi-Mot, côté serveur uniquement (routes API et cron).
// Les tables demimot_* sont fermées (RLS sans policy) : seul ce client
// service_role les lit. Ne jamais importer ce fichier depuis un composant client.
//
// Une action de la régie = lire la partie, intégrer un buzz en attente,
// appliquer la commande au moteur, enregistrer (demimot_commit). Si un buzz
// est arrivé entre la lecture et l'enregistrement, la base refuse
// (« conflict ») : on relit et on recommence, le buzz n'est jamais perdu.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getInviteUrl } from '@/lib/utils'
import { DEMIMOT_COMMIT_ATTEMPTS, DEMIMOT_LIVE_STALE_MS, DEMIMOT_OFFLINE_AFTER_MS, DEMIMOT_PAUSED_AFTER_MS } from './constants'
import { createGame, restoreSafe, tick, type GameEvent, type Result } from './engine'
import { foldBuzz, gateOf, type DemiMotPublicState } from './gate'
import { publicView, regieView } from './project'
import type { GameState } from './types'
import type { CaptainInfo, PublicView, RegieView } from './view'

// Vérification du propriétaire de la session : la même que Matching (réutilisée, non modifiée).
export { requireSessionOwner } from '@/lib/affinity/server'

export function getDemiMotAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Colonnes des autres jeux : À Demi-Mot s'efface dès que l'une est vraie (un
 * jeu lancé après lui ne connaît pas demimot_active et ne le remet pas à
 * faux ; c'est donc À Demi-Mot qui s'efface, sans toucher aux autres jeux).
 */
export const OTHER_GAME_FLAGS = [
  'quiz_active',
  'quiz_lobby_visible',
  'lineup_active',
  'wheel_active',
  'mystery_photo_active',
  'affinity_active',
  'buzzer_active',
  'vote_active',
] as const

export type OtherGameFlags = Partial<Record<(typeof OTHER_GAME_FLAGS)[number], boolean | null>>

export function isAnimatorAlive(heartbeatAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!heartbeatAt) return false
  const at = Date.parse(heartbeatAt)
  return Number.isFinite(at) && now - at <= DEMIMOT_LIVE_STALE_MS
}

/** Erreur métier d'une action (message déjà rédigé pour l'animateur). */
export class DemiMotActionError extends Error {
  constructor(message: string, readonly status: number, readonly code: string = 'action') {
    super(message)
  }
}

export async function loadPublicState(admin: SupabaseClient, sessionId: string): Promise<DemiMotPublicState> {
  const { data, error } = await admin.rpc('demimot_public_state', { p_session_id: sessionId })
  if (error) throw new Error(error.message)
  return data as DemiMotPublicState
}

// ---------------------------------------------------------------- lecture

interface RuntimeRow {
  game_id: string
  version: number
  state: GameState
  gate: 'closed' | 'open' | 'buzzed'
  buzz_team_id: string | null
  buzz_window: number | null
  buzz_at: string | null
  heartbeat_at: string
  public_view: unknown
}

export interface TeamRow {
  id: string
  position: number
  name: string
  color: string
  captain_token_hash: string | null
  captain_since: string | null
  captain_seen_at: string | null
  captain_rtt_ms: number | null
}

async function readRuntime(admin: SupabaseClient, sessionId: string): Promise<RuntimeRow | null> {
  const { data, error } = await admin
    .from('demimot_runtime')
    .select('game_id, version, state, gate, buzz_team_id, buzz_window, buzz_at, heartbeat_at, public_view')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as RuntimeRow | null) ?? null
}

export async function readTeams(admin: SupabaseClient, sessionId: string, gameId: string): Promise<TeamRow[]> {
  const { data, error } = await admin
    .from('demimot_teams')
    .select('id, position, name, color, captain_token_hash, captain_since, captain_seen_at, captain_rtt_ms')
    .eq('session_id', sessionId)
    .eq('game_id', gameId)
    .order('position')
  if (error) throw new Error(error.message)
  return (data ?? []) as TeamRow[]
}

const isOnline = (t: TeamRow, now: number) =>
  t.captain_token_hash !== null && t.captain_seen_at !== null && now - Date.parse(t.captain_seen_at) <= DEMIMOT_OFFLINE_AFTER_MS

function captainsOf(teams: TeamRow[], now: number): CaptainInfo[] {
  return teams.map((t) => ({
    teamId: t.id,
    connected: isOnline(t, now),
    since: t.captain_token_hash && t.captain_since ? Date.parse(t.captain_since) : null,
    lastSeen: t.captain_seen_at ? Date.parse(t.captain_seen_at) : null,
  }))
}

function contextFor(s: GameState, teams: TeamRow[], now: number) {
  return { now, connectedTeamIds: new Set(teams.filter((t) => isOnline(t, now)).map((t) => t.id)), joinUrl: getInviteUrl(s.code) }
}

/** JSON à clés triées : jsonb (Postgres) ne garde pas l'ordre des clés. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}
const sameJson = (a: unknown, b: unknown) => canonical(a) === canonical(b)
/** Vues publiques identiques, à l'heure du serveur près. */
const sameView = (a: PublicView, b: unknown) => !!b && typeof b === 'object' && sameJson({ ...a, serverNow: 0 }, { ...(b as PublicView), serverNow: 0 })

const sameTeams = (s: GameState, teams: TeamRow[]) =>
  s.teams.length === teams.length && s.teams.every((t, i) => teams[i]?.id === t.id && teams[i].name === t.name && teams[i].color === t.color)

// ---------------------------------------------------------------- écriture

export interface ActOutcome {
  state: GameState
  events: GameEvent[]
  publicState: DemiMotPublicState
  regie: RegieView
  teams: TeamRow[]
}

/**
 * Applique une commande à la partie, sous contrôle de version. `run` reçoit
 * l'état à jour (buzz en attente intégré, échéances avancées) et l'heure.
 * Une commande refusée par le moteur lève DemiMotActionError (409).
 */
export async function act(
  admin: SupabaseClient,
  sessionId: string,
  run: (s: GameState, now: number) => Result | null | Promise<Result | null>,
  opts: { skipIfUnchanged?: boolean } = {},
): Promise<ActOutcome> {
  for (let attempt = 0; attempt < DEMIMOT_COMMIT_ATTEMPTS; attempt++) {
    const row = await readRuntime(admin, sessionId)
    if (!row) throw new DemiMotActionError('Aucune partie À Demi-Mot lancée.', 409, 'no_game')
    const now = Date.now()
    let s = row.state
    const events: GameEvent[] = []

    // Régie absente plus de 90 s : comme au retour d'une coupure, la manche
    // en cours repart EN PAUSE (personne ne joue dans le vide).
    if (now - Date.parse(row.heartbeat_at) > DEMIMOT_PAUSED_AFTER_MS) s = restoreSafe(s, now)

    // Buzz accepté par la base, pas encore pris en compte par le moteur.
    if (row.gate === 'buzzed' && row.buzz_team_id && row.buzz_window !== null && row.buzz_at) {
      const folded = foldBuzz(s, { teamId: row.buzz_team_id, window: row.buzz_window, at: row.buzz_at })
      if (folded.state !== s) events.push({ type: 'buzz', teamId: row.buzz_team_id })
      s = folded.state
    }

    const advanced = tick(s, now)
    s = advanced.state
    events.push(...advanced.events)

    const res = await run(s, now)
    if (res && !res.ok) throw new DemiMotActionError(res.message, 409, res.error)
    if (res) {
      s = res.state
      events.push(...res.events)
    }

    const teams = await readTeams(admin, sessionId, row.game_id)
    const teamsChanged = !sameTeams(s, teams)
    const ctx = contextFor(s, teams, now)
    const view = publicView(s, ctx)
    // « tick » sans échéance atteinte : rien n'a changé, aucune écriture ni diffusion.
    if (opts.skipIfUnchanged && !res && events.length === 0 && !teamsChanged && sameJson(s, row.state) && sameView(view, row.public_view)) {
      return {
        state: s,
        events,
        publicState: await loadPublicState(admin, sessionId),
        regie: regieView(s, { ...ctx, captains: captainsOf(teams, now), connections: { public: 0, regie: 1, phones: teams.filter((t) => isOnline(t, now)).length } }),
        teams,
      }
    }
    const { data, error } = await admin.rpc('demimot_commit', {
      p_session_id: sessionId,
      p_version: row.version,
      p_state: s,
      p_view: view,
      p_gate: gateOf(s),
      p_teams: teamsChanged ? s.teams.map((t, i) => ({ id: t.id, position: i, name: t.name, color: t.color })) : null,
    })
    if (error) {
      if (error.message.includes('conflict')) continue
      if (error.message.includes('no_game')) throw new DemiMotActionError('Aucune partie À Demi-Mot lancée.', 409, 'no_game')
      throw new Error(error.message)
    }
    const fresh = teamsChanged ? await readTeams(admin, sessionId, row.game_id) : teams
    return {
      state: s,
      events,
      publicState: data as DemiMotPublicState,
      regie: regieView(s, { ...ctx, captains: captainsOf(fresh, now), connections: { public: 0, regie: 1, phones: fresh.filter((t) => isOnline(t, now)).length } }),
      teams: fresh,
    }
  }
  throw new DemiMotActionError('La partie bouge beaucoup en ce moment, réessayez.', 503, 'busy')
}

/** Nouvelle partie (équipes à créer ensuite par la régie). */
export async function launchGame(admin: SupabaseClient, sessionId: string, code: string, settings: Partial<GameState['settings']> = {}) {
  const now = Date.now()
  const seed = Math.floor(Math.random() * 2 ** 31)
  const s = createGame(code, [], seed, now, settings)
  const view = publicView(s, { now, connectedTeamIds: new Set(), joinUrl: getInviteUrl(code) })
  const { data, error } = await admin.rpc('demimot_launch', { p_session_id: sessionId, p_state: s, p_view: view })
  if (error) throw new Error(error.message)
  return data as DemiMotPublicState
}

/** Lecture seule pour la régie (vue privée avec la solution). */
export async function regieSnapshot(admin: SupabaseClient, sessionId: string): Promise<{ publicState: DemiMotPublicState; regie: RegieView | null }> {
  const publicState = await loadPublicState(admin, sessionId)
  const row = await readRuntime(admin, sessionId)
  if (!row) return { publicState, regie: null }
  const now = Date.now()
  const teams = await readTeams(admin, sessionId, row.game_id)
  const ctx = contextFor(row.state, teams, now)
  return {
    publicState,
    regie: regieView(row.state, { ...ctx, captains: captainsOf(teams, now), connections: { public: 0, regie: 1, phones: teams.filter((t) => isOnline(t, now)).length } }),
  }
}
