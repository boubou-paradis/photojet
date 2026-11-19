// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Accès base d'AnimaBingo, côté serveur uniquement (routes API et cron).
// Les tables bingo_* sont fermées (RLS sans policy) : seul ce client
// service_role les lit. Ne jamais importer ce fichier depuis un composant client.
//
// Partage des rôles : le serveur fabrique les cartons et détaille les
// vérifications ; la base (fonctions bingo_*) tranche tout ce qui doit être
// atomique (tirage, attribution, demandes, décisions).

import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { BINGO_JOIN_ATTEMPTS, BINGO_LIVE_STALE_MS } from './constants'
import { makeCards } from './cards'
import { MUSIC_BUCKET, makeMusicCards, parseTrack, playlistProblem, publicTitles, type MusicInfo, type MusicTrack, type PublicTitle } from './music'
import { checkClaim } from './verify'
import type { BingoPublicState, BingoSettings, Cells, ClaimCheck, Phase } from './types'
import { parseSettings, type AdminCommand } from './validation'

// Vérification du propriétaire de la session : la même que Matching (réutilisée, non modifiée).
export { requireSessionOwner } from '@/lib/affinity/server'

export function getBingoAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Colonnes des autres jeux : AnimaBingo s'efface dès que l'une est vraie (un
 * jeu lancé après lui ne connaît pas bingo_active et ne le remet pas à faux ;
 * c'est donc AnimaBingo qui s'efface, sans toucher aux autres jeux).
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
  'demimot_active',
] as const

export type OtherGameFlags = Partial<Record<(typeof OTHER_GAME_FLAGS)[number], boolean | null>>

export function isAnimatorAlive(heartbeatAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!heartbeatAt) return false
  const at = Date.parse(heartbeatAt)
  return Number.isFinite(at) && now - at <= BINGO_LIVE_STALE_MS
}

// ---------------------------------------------------------------- erreurs

export type BingoErrorCode =
  | 'no_game' | 'invalid' | 'not_running' | 'too_fast' | 'empty' | 'not_valid'
  | 'full' | 'duplicate' | 'forbidden' | 'cooldown' | 'pending' | 'phase_done' | 'unknown'

const MESSAGES: Record<BingoErrorCode, [string, number]> = {
  no_game: ['Aucune partie AnimaBingo en cours.', 409],
  invalid: ['Action impossible pour le moment.', 409],
  not_running: ['Le tirage n’est pas en cours.', 409],
  too_fast: ['Une boule vient de sortir : patientez un instant.', 429],
  empty: ['Les 90 boules sont sorties.', 409],
  not_valid: ['Ce carton n’a pas encore le nombre de lignes demandé.', 409],
  full: ['La partie est complète.', 409],
  duplicate: ['Carton déjà existant, nouvel essai.', 409],
  forbidden: ['Carton introuvable pour ce téléphone.', 403],
  cooldown: ['Patientez quelques secondes avant une nouvelle demande.', 429],
  pending: ['Vérifiez d’abord les demandes en attente.', 409],
  phase_done: ['Tous les lots de cette étape sont gagnés : passez à la suite.', 409],
  unknown: ['Réseau saturé, réessayez dans un instant.', 503],
}

/** Code métier d'une erreur renvoyée par une fonction bingo_* (RAISE EXCEPTION '<code>'). */
export function rpcError(e: { message?: string } | null | undefined): BingoErrorCode {
  const m = (e?.message ?? '').trim()
  return (m in MESSAGES ? m : 'unknown') as BingoErrorCode
}

export class BingoError extends Error {
  readonly status: number
  constructor(readonly code: BingoErrorCode) {
    super(MESSAGES[code][0])
    this.status = MESSAGES[code][1]
  }
}

async function rpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args)
  if (error) {
    const code = rpcError(error)
    if (code === 'unknown') console.error(`[AnimaBingo] ${fn} :`, error.message)
    throw new BingoError(code)
  }
  return data as T
}

// ---------------------------------------------------------------- session publique

type SessionRow = { id: string; bingo_active: boolean | null } & OtherGameFlags

/**
 * Où en est AnimaBingo sur une session (par code) :
 * - missing : code inconnu (pour le frein sur les codes) ;
 * - off     : aucune partie (jamais lancée, quittée, ou purgée après 24 h) ;
 * - other   : partie gardée mais pas à l'écran (AnimaBingo éteint par un autre jeu,
 *             ou un autre jeu actif) → EN PAUSE, rien n'est effacé ;
 * - stale   : lancé mais régie silencieuse depuis plus de 3 min (PC planté, coupure) ;
 * - live    : en direct.
 *
 * Les nouveaux arrivants (/invite) n'entrent que sur `live`, pour ne jamais
 * afficher une partie fantôme. Les joueurs DÉJÀ inscrits et l'écran gardent
 * la partie sur `stale` et `other` (affichée « en pause »).
 */
export type SessionPresence =
  | { status: 'missing'; id: null; gameId: null }
  | { status: 'off'; id: string; gameId: null }
  | { status: 'other' | 'stale' | 'live'; id: string; gameId: string }

export async function findSession(admin: SupabaseClient, code: string): Promise<SessionPresence> {
  const { data, error } = await admin
    .from('sessions')
    .select(`id, bingo_active, ${OTHER_GAME_FLAGS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()
  if (error) throw new BingoError('unknown')
  const session = data as SessionRow | null
  if (!session) return { status: 'missing', id: null, gameId: null }
  // La partie existe tant que sa ligne bingo_runtime existe (effacée seulement par
  // « Quitter » ou la purge 24 h). Lancer un autre jeu ÉTEINT bingo_active : la
  // partie est alors EN PAUSE (other), jamais « absente » — sinon les téléphones
  // effaceraient leurs cartons.
  const { data: runtime, error: runtimeError } = await admin
    .from('bingo_runtime')
    .select('game_id, heartbeat_at')
    .eq('session_id', session.id)
    .maybeSingle()
  if (runtimeError) throw new BingoError('unknown')
  if (!runtime) return { status: 'off', id: session.id, gameId: null }
  const gameId = runtime.game_id as string
  if (!session.bingo_active || OTHER_GAME_FLAGS.some((f) => session[f] === true)) return { status: 'other', id: session.id, gameId }
  return { status: isAnimatorAlive(runtime.heartbeat_at as string) ? 'live' : 'stale', id: session.id, gameId }
}

export function loadPublicState(admin: SupabaseClient, sessionId: string): Promise<BingoPublicState> {
  return rpc<BingoPublicState>(admin, 'bingo_public_state', { p_session_id: sessionId })
}

/** Réglages de la partie en cours (valeurs par défaut si absents). */
export async function readSettings(admin: SupabaseClient, sessionId: string): Promise<BingoSettings> {
  const { data, error } = await admin.from('bingo_runtime').select('settings').eq('session_id', sessionId).maybeSingle()
  if (error) throw new BingoError('unknown')
  return parseSettings(data?.settings)
}

// ---------------------------------------------------------------- loto musical

/** settings.music d'une partie (null = loto numéros). Écrit par la base seulement. */
export function musicOf(settings: unknown): MusicInfo | null {
  const m = (settings as { music?: unknown } | null)?.music as { sig?: unknown; n?: unknown } | undefined
  return m && typeof m.sig === 'string' && Number.isInteger(m.n) ? { sig: m.sig, n: m.n as number } : null
}

/** Réglages + mode (numéros ou playlist) de la partie en cours. */
export async function readGameSetup(admin: SupabaseClient, sessionId: string): Promise<{ settings: BingoSettings; music: MusicInfo | null }> {
  const { data, error } = await admin.from('bingo_runtime').select('settings').eq('session_id', sessionId).maybeSingle()
  if (error) throw new BingoError('unknown')
  return { settings: parseSettings(data?.settings), music: musicOf(data?.settings) }
}

/** Empreinte d'une playlist figée : change dès qu'un titre, un artiste ou l'ordre change. */
export const musicSig = (tracks: readonly MusicTrack[]): string =>
  createHash('sha256').update(JSON.stringify(tracks.map((t) => [t.id, t.title, t.artist]))).digest('hex').slice(0, 16)

/** Copie figée d'une playlist du compte, prête à jouer (30 titres au moins). */
async function freezePlaylist(admin: SupabaseClient, userId: string, playlistId: string) {
  const { data, error } = await admin.from('saved_bingo_playlists').select('name, tracks').eq('id', playlistId).eq('user_id', userId).maybeSingle()
  if (error) throw new BingoError('unknown')
  if (!data) throw new BingoError('forbidden')
  const tracks = ((data.tracks as unknown[]) ?? []).map((t) => parseTrack(t, userId))
  if (tracks.some((t) => !t)) throw new BingoError('invalid')
  const ok = tracks as MusicTrack[]
  if (playlistProblem(ok)) throw new BingoError('invalid')
  return { name: data.name as string, sig: musicSig(ok), tracks: ok }
}

/** Playlist figée de la partie en cours (pour « Nouvelle partie »), ou null. */
async function currentMusic(admin: SupabaseClient, sessionId: string) {
  const { data, error } = await admin.from('bingo_music').select('name, sig, tracks').eq('session_id', sessionId).maybeSingle()
  if (error) throw new BingoError('unknown')
  return data ? { name: data.name as string, sig: data.sig as string, tracks: data.tracks as MusicTrack[] } : null
}

/** Titres de la partie en cours (écran et téléphones) : jamais les fichiers. */
export async function loadTitles(admin: SupabaseClient, sessionId: string): Promise<{ sig: string; titles: PublicTitle[] } | null> {
  const { data, error } = await admin.from('bingo_music').select('sig, tracks').eq('session_id', sessionId).maybeSingle()
  if (error) throw new BingoError('unknown')
  return data ? { sig: data.sig as string, titles: publicTitles(data.tracks as MusicTrack[]) } : null
}

/** Adresse de lecture d'un extrait (bucket public par lien) : régie seulement. */
const audioUrl = (p: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, '')}/storage/v1/object/public/${MUSIC_BUCKET}/${p}`

export interface RegieMusic {
  name: string
  sig: string
  tracks: { title: string; artist: string; url: string; start: number; end: number }[]
  /** Rang du DERNIER titre tiré (même encore caché au public), null avant le 1er tirage. */
  current: number | null
}

async function regieMusic(admin: SupabaseClient, sessionId: string): Promise<Omit<RegieMusic, 'current'> | null> {
  const { data, error } = await admin.from('bingo_music').select('name, sig, tracks').eq('session_id', sessionId).maybeSingle()
  if (error) throw new BingoError('unknown')
  if (!data) return null
  return {
    name: data.name as string,
    sig: data.sig as string,
    tracks: (data.tracks as MusicTrack[]).map((t) => ({ title: t.title, artist: t.artist, url: audioUrl(t.path), start: t.start, end: t.end })),
  }
}

/** Jeu de titres en cours pour les cartons papier (empreinte de la playlist, ou null = numéros). */
async function paperSet(admin: SupabaseClient, sessionId: string): Promise<string | null> {
  return (await readGameSetup(admin, sessionId)).music?.sig ?? null
}

/** Statut d'UNE demande, pour le téléphone qui l'a envoyée (et seulement lui). */
export async function claimStatus(admin: SupabaseClient, claimId: number, playerId: string): Promise<'pending' | 'accepted' | 'rejected' | null> {
  const { data, error } = await admin.from('bingo_claims').select('status').eq('id', claimId).eq('player_id', playerId).maybeSingle()
  if (error) throw new BingoError('unknown')
  return (data?.status as 'pending' | 'accepted' | 'rejected' | undefined) ?? null
}

// ---------------------------------------------------------------- joueurs

export interface PhoneCard { id: string; serial: number; cells: Cells }
export interface JoinResult { playerId: string; cards: PhoneCard[] }

/** Arrivée (ou retour, même jeton) d'un joueur : cartons fabriqués ici, attribués en base. */
export async function joinPlayer(admin: SupabaseClient, sessionId: string, tokenHash: string, name: string, cardsPerPlayer: number, music: MusicInfo | null = null): Promise<JoinResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await rpc<JoinResult>(admin, 'bingo_join', {
        p_session_id: sessionId,
        p_token_hash: tokenHash,
        p_name: name,
        p_cards: music ? makeMusicCards(cardsPerPlayer, music.n) : makeCards(cardsPerPlayer),
      })
    } catch (e) {
      if (!(e instanceof BingoError) || e.code !== 'duplicate' || attempt >= BINGO_JOIN_ATTEMPTS) throw e
    }
  }
}

/** Joueur et cartons d'un jeton, sans rien créer. */
export async function findPlayer(admin: SupabaseClient, gameId: string, tokenHash: string): Promise<(JoinResult & { name: string }) | null> {
  const { data, error } = await admin
    .from('bingo_players')
    .select('id, display_name, bingo_cards(id, serial, cells)')
    .eq('game_id', gameId)
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error) throw new BingoError('unknown')
  if (!data) return null
  const cards = ((data.bingo_cards ?? []) as PhoneCard[]).slice().sort((a, b) => a.serial - b.serial)
  return { playerId: data.id as string, name: data.display_name as string, cards }
}

export function claim(admin: SupabaseClient, sessionId: string, playerId: string, tokenHash: string, cardId: string, marks: number[]) {
  return rpc<{ claimId: number; status: 'pending' | 'accepted'; already?: boolean }>(admin, 'bingo_claim', {
    p_session_id: sessionId,
    p_player_id: playerId,
    p_token_hash: tokenHash,
    p_card_id: cardId,
    p_marks: marks,
  })
}

// ---------------------------------------------------------------- régie

interface RuntimeRow { game_id: string; round_no: number; drawn: number[]; phases: Phase[]; phase_index: number; settings: unknown }

async function readRuntime(admin: SupabaseClient, sessionId: string): Promise<RuntimeRow | null> {
  const { data, error } = await admin
    .from('bingo_runtime')
    .select('game_id, round_no, drawn, phases, phase_index, settings')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error) throw new BingoError('unknown')
  return (data as RuntimeRow | null) ?? null
}

export interface PendingClaim {
  id: number
  name: string | null
  serial: number
  phase: Phase
  drawCount: number
  createdAt: string
  cells: Cells
  marks: number[]
  check: ClaimCheck
  /** Boules tirées entre la ligne complète et la demande (0 = à l'heure). */
  lateBy: number | null
}

export async function pendingClaims(admin: SupabaseClient, sessionId: string, rt: RuntimeRow): Promise<PendingClaim[]> {
  const { data, error } = await admin
    .from('bingo_claims')
    .select('id, display_name, phase, draw_count, marks, created_at, bingo_cards(serial, cells)')
    .eq('session_id', sessionId)
    .eq('game_id', rt.game_id)
    .eq('round_no', rt.round_no)
    .eq('status', 'pending')
    .order('id')
  if (error) throw new BingoError('unknown')
  return (data ?? []).map((c) => {
    const card = c.bingo_cards as unknown as { serial: number; cells: Cells }
    const drawn = rt.drawn.slice(0, c.draw_count as number)
    const check = checkClaim(card.cells, drawn, c.phase as Phase, c.marks as number[])
    return {
      id: c.id as number,
      name: c.display_name as string | null,
      serial: card.serial,
      phase: c.phase as Phase,
      drawCount: c.draw_count as number,
      createdAt: c.created_at as string,
      cells: card.cells,
      marks: c.marks as number[],
      check,
      lateBy: check.completedAt === null ? null : (c.draw_count as number) - check.completedAt,
    }
  })
}

export interface RegieSnapshot {
  state: BingoPublicState
  settings: BingoSettings | null
  claims: PendingClaim[]
  paper: { count: number; first: number | null; last: number | null }
  /** Partie existante mais plus à l'écran (un autre jeu a été lancé) : en pause, rien n'est effacé. */
  held: boolean
  /** Loto musical : playlist figée avec les adresses des extraits (null = numéros). */
  music: RegieMusic | null
}

export async function regieSnapshot(admin: SupabaseClient, sessionId: string): Promise<RegieSnapshot> {
  const [state, rt, paper, flags, music] = await Promise.all([
    loadPublicState(admin, sessionId),
    readRuntime(admin, sessionId),
    paperRange(admin, sessionId),
    admin.from('sessions').select('bingo_active').eq('id', sessionId).maybeSingle(),
    regieMusic(admin, sessionId),
  ])
  if (flags.error) throw new BingoError('unknown')
  const shown = (flags.data as { bingo_active?: boolean } | null)?.bingo_active === true
  return {
    state,
    settings: rt ? parseSettings(rt.settings) : null,
    claims: rt ? await pendingClaims(admin, sessionId, rt) : [],
    paper,
    held: !!rt && !shown,
    music: music ? { ...music, current: rt?.drawn.length ? rt.drawn[rt.drawn.length - 1] : null } : null,
  }
}

/** Cartons papier du jeu de titres en cours (ceux d'une autre playlist restent gardés, ignorés). */
// (Fonction synchrone : une requête Supabase attendue par « await » s'exécuterait aussitôt.)
function paperQuery(admin: SupabaseClient, sessionId: string, sig: string | null, columns: string) {
  const q = admin.from('bingo_cards').select(columns).eq('session_id', sessionId).eq('kind', 'paper')
  return sig ? q.eq('music_sig', sig) : q.is('music_sig', null)
}

async function paperRange(admin: SupabaseClient, sessionId: string) {
  const { data, error } = await paperQuery(admin, sessionId, await paperSet(admin, sessionId), 'serial').order('serial')
  if (error) throw new BingoError('unknown')
  const s = ((data ?? []) as unknown as { serial: number }[]).map((r) => r.serial)
  return { count: s.length, first: s[0] ?? null, last: s[s.length - 1] ?? null }
}

export interface PaperCheck { serial: number; cells: Cells; phase: Phase | null; check: ClaimCheck | null }

async function paperCheck(admin: SupabaseClient, sessionId: string, serial: number): Promise<PaperCheck> {
  const { data: row, error } = await paperQuery(admin, sessionId, await paperSet(admin, sessionId), 'serial, cells').eq('serial', serial).maybeSingle()
  if (error) throw new BingoError('unknown')
  const data = row as unknown as { serial: number; cells: Cells } | null
  if (!data) throw new BingoError('forbidden')
  const rt = await readRuntime(admin, sessionId)
  const phase = rt && rt.phase_index < rt.phases.length ? rt.phases[rt.phase_index] : null
  return { serial, cells: data.cells as Cells, phase, check: rt && phase ? checkClaim(data.cells as Cells, rt.drawn, phase, rt.drawn) : null }
}

/** Tous les cartons papier de la session (pour réimprimer le PDF à tout moment, même après une panne). */
async function paperList(admin: SupabaseClient, sessionId: string) {
  const { data, error } = await paperQuery(admin, sessionId, await paperSet(admin, sessionId), 'serial, cells').order('serial')
  if (error) throw new BingoError('unknown')
  const titles = await loadTitles(admin, sessionId)
  return { cards: (data ?? []) as unknown as { serial: number; cells: Cells }[], titles: titles?.titles ?? null }
}

async function paperAdd(admin: SupabaseClient, sessionId: string, count: number) {
  const { data, error } = await admin.from('bingo_cards').select('signature').eq('session_id', sessionId).eq('kind', 'paper')
  if (error) throw new BingoError('unknown')
  const taken = new Set((data ?? []).map((r) => r.signature as string))
  const { music } = await readGameSetup(admin, sessionId)
  return rpc<{ first: number; last: number }>(admin, 'bingo_admin', {
    p_session_id: sessionId, p_action: 'paper_add',
    p_args: { cards: music ? makeMusicCards(count, music.n, undefined, taken) : makeCards(count, undefined, taken) },
  })
}

/** Exécute une commande de la régie. Renvoie l'état public (ou le résultat propre à la commande). */
export async function runAdmin(admin: SupabaseClient, sessionId: string, command: AdminCommand, userId: string): Promise<unknown> {
  const call = (args: Record<string, unknown> = {}) => rpc<unknown>(admin, 'bingo_admin', { p_session_id: sessionId, p_action: command.action, p_args: args })
  switch (command.action) {
    case 'launch': case 'new_game': {
      // launch REPREND une partie existante (playlist ignorée) ; sinon la playlist
      // choisie est figée et écrite dans la même transaction que la partie.
      // « Nouvelle partie » sans choix : on rejoue la MÊME playlist figée (le mode ne
      // change pas en cours de soirée ; pour changer, quitter puis relancer).
      const music = command.playlistId
        ? await freezePlaylist(admin, userId, command.playlistId)
        : command.action === 'new_game' ? await currentMusic(admin, sessionId) : null
      return call({ settings: command.settings, phases: command.phases, ...(command.lots ? { lots: command.lots } : {}), ...(music ? { music } : {}) })
    }
    case 'new_round': return call({ ...(command.settings ? { settings: command.settings } : {}), ...(command.phases ? { phases: command.phases } : {}), ...(command.lots ? { lots: command.lots } : {}) })
    case 'settings': return call({ settings: command.settings, ...(command.phases ? { phases: command.phases } : {}), ...(command.lots ? { lots: command.lots } : {}) })
    case 'next_phase': case 'advance': case 'jump_final': return call(command.expect !== undefined ? { expect: command.expect } : {})
    case 'draw': return call({ expect: command.expect })
    case 'auto': return call({ mode: command.mode, ...(command.ms ? { ms: command.ms } : {}) })
    case 'decide': return call({ claimId: command.claimId, accept: command.accept, ...(command.name ? { name: command.name } : {}) })
    case 'paper_win': return call({ serial: command.serial })
    case 'paper_check': return paperCheck(admin, sessionId, command.serial)
    case 'paper_add': return paperAdd(admin, sessionId, command.count)
    case 'paper_list': return paperList(admin, sessionId)
    default: return call()
  }
}
