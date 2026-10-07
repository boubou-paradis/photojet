// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Accès base de Matching, côté serveur uniquement (routes API et cron).
// Les tables affinity_* sont fermées (RLS sans policy) : seul ce client
// service_role les lit. Ne jamais importer ce fichier depuis un composant client.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { AFFINITY_HEARTBEAT_STALE_MS } from './constants'
import type { AffinityMatch, AffinityPhase, AffinityScoringPlayer } from './types'

export function getAffinityAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Colonnes publiques de Matching sur la ligne sessions. */
export interface AffinitySessionRow {
  id: string
  code: string
  affinity_active: boolean
  affinity_phase: AffinityPhase | null
  affinity_questions: unknown
  affinity_current_question: number
  affinity_deadline: string | null
}

export const AFFINITY_SESSION_COLUMNS =
  'id, code, affinity_active, affinity_phase, affinity_questions, affinity_current_question, affinity_deadline'

export interface AffinityRuntimeRow {
  session_id: string
  round_id: string
  launched_at: string
  heartbeat_at: string
  revealed_question_ids: string[]
  finished_at: string | null
}

export interface AffinityPlayerRow {
  id: string
  session_id: string
  round_id: string
  nickname: string
  nickname_key: string
  table_label: string | null
  consent: boolean
  token_hash: string
  joined_at: string
  top5: AffinityMatch[] | null
}

/** Colonnes des autres jeux : Matching s'efface dès que l'une est vraie. */
export const OTHER_GAME_FLAGS = [
  'quiz_active',
  'quiz_lobby_visible',
  'lineup_active',
  'wheel_active',
  'mystery_photo_active',
] as const

export function isHeartbeatFresh(heartbeatAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!heartbeatAt) return false
  const at = Date.parse(heartbeatAt)
  return Number.isFinite(at) && now - at <= AFFINITY_HEARTBEAT_STALE_MS
}

/**
 * Vérifie que l'utilisateur connecté (cookies) possède la session.
 * Renvoie l'id utilisateur, ou null si non connecté / pas propriétaire.
 */
export async function requireSessionOwner(sessionId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await getAffinityAdmin()
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  return data ? user.id : null
}

const PAGE_SIZE = 1000 // limite de lignes par requête côté Supabase

async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

/** Joueurs et réponses d'une partie, pour le calcul final (serveur uniquement). */
export async function loadScoringPlayers(admin: SupabaseClient, roundId: string): Promise<AffinityScoringPlayer[]> {
  const players = await fetchAllPages<Pick<AffinityPlayerRow, 'id' | 'nickname' | 'table_label' | 'consent' | 'joined_at'>>((from, to) =>
    admin
      .from('affinity_players')
      .select('id, nickname, table_label, consent, joined_at')
      .eq('round_id', roundId)
      .order('id')
      .range(from, to),
  )
  const answers = await fetchAllPages<{ player_id: string; question_id: string; answer_index: number }>((from, to) =>
    admin
      .from('affinity_answers')
      .select('player_id, question_id, answer_index')
      .eq('round_id', roundId)
      .order('player_id')
      .order('question_id')
      .range(from, to),
  )

  const byPlayer = new Map<string, AffinityScoringPlayer>()
  for (const p of players) {
    byPlayer.set(p.id, { id: p.id, nickname: p.nickname, table: p.table_label, consent: p.consent, joinedAt: p.joined_at, answers: {} })
  }
  for (const a of answers) {
    const player = byPlayer.get(a.player_id)
    if (player) player.answers[a.question_id] = a.answer_index
  }
  return [...byPlayer.values()]
}

/** Index de réponse reçus pour une question (serveur uniquement, jamais nominatif). */
export async function loadQuestionAnswerIndexes(admin: SupabaseClient, roundId: string, questionId: string): Promise<number[]> {
  const rows = await fetchAllPages<{ answer_index: number }>((from, to) =>
    admin
      .from('affinity_answers')
      .select('answer_index')
      .eq('round_id', roundId)
      .eq('question_id', questionId)
      .order('player_id')
      .range(from, to),
  )
  return rows.map((r) => r.answer_index)
}

/** Nombre de réponses à une question, pour le compteur de l'écran géant. */
export async function countQuestionAnswers(admin: SupabaseClient, roundId: string, questionId: string): Promise<number> {
  const { count, error } = await admin
    .from('affinity_answers')
    .select('player_id', { count: 'exact', head: true })
    .eq('round_id', roundId)
    .eq('question_id', questionId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Supprime toutes les données joueurs d'une session (réponses en cascade). */
export async function deleteSessionPlayers(admin: SupabaseClient, sessionId: string): Promise<number> {
  const { count, error } = await admin.from('affinity_players').delete({ count: 'exact' }).eq('session_id', sessionId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Valeurs de sessions qui remettent Matching à l'état inactif (config conservée). */
export const AFFINITY_RESET = {
  affinity_active: false,
  affinity_phase: null,
  affinity_current_question: 0,
  affinity_deadline: null,
  affinity_reveal: null,
  affinity_final_stats: null,
} as const
