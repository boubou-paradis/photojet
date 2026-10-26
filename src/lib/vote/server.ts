// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Accès base d'AnimaVote, côté serveur uniquement (routes API et cron).
// Les tables vote_* sont fermées (RLS sans policy) : seul ce client
// service_role les lit. Ne jamais importer ce fichier depuis un composant client.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { VOTE_LIVE_STALE_MS, VOTE_PHOTO_BUCKET } from './constants'
import type { VoteResults, VoteState } from './types'

// Vérification du propriétaire de la session : la même que Matching (réutilisée, non modifiée).
export { requireSessionOwner } from '@/lib/affinity/server'

export function getVoteAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Base publique des photos : `${SUPABASE_URL}/storage/v1/object/public/photos`. */
export function votePhotoBase(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, '')}/storage/v1/object/public/${VOTE_PHOTO_BUCKET}`
}

/**
 * Colonnes des autres jeux : AnimaVote s'efface dès que l'une est vraie (un
 * jeu lancé après AnimaVote ne connaît pas vote_active et ne le remet pas à
 * faux ; c'est donc AnimaVote qui s'efface, sans toucher aux autres jeux).
 */
export const OTHER_GAME_FLAGS = [
  'quiz_active',
  'quiz_lobby_visible',
  'lineup_active',
  'wheel_active',
  'mystery_photo_active',
  'affinity_active',
  'buzzer_active',
] as const

export type OtherGameFlags = Partial<Record<(typeof OTHER_GAME_FLAGS)[number], boolean | null>>

export function isAnimatorAlive(heartbeatAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!heartbeatAt) return false
  const at = Date.parse(heartbeatAt)
  return Number.isFinite(at) && now - at <= VOTE_LIVE_STALE_MS
}

/** Erreur métier d'une action (message déjà rédigé pour l'animateur). */
export class VoteActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/** Erreurs levées par la fonction SQL vote_admin → message et statut HTTP. */
export function mapAdminError(message: string): VoteActionError | null {
  if (message.includes('no_game')) return new VoteActionError('Aucun vote AnimaVote lancé.', 409)
  if (message.includes('wrong_step')) return new VoteActionError('Action impossible à cette étape du vote.', 409)
  if (message.includes('invalid')) return new VoteActionError('Action invalide.', 400)
  return null
}

/** État public d'une session. `forPhone` : sans aucun résultat (les téléphones regardent l'écran géant). */
export async function loadPublicState(admin: SupabaseClient, sessionId: string, forPhone: boolean): Promise<VoteState> {
  const { data, error } = await admin.rpc('vote_public_state', { p_session_id: sessionId, p_for_phone: forPhone })
  if (error) throw new Error(error.message)
  return data as VoteState
}

/** Totaux complets d'un scrutin, pour l'animateur seulement (même en mode caché). */
export async function loadTally(admin: SupabaseClient, eventId: string): Promise<VoteResults & { total: number }> {
  const { data, error } = await admin.rpc('vote_tally', { p_event_id: eventId })
  if (error) throw new Error(error.message)
  return data as VoteResults & { total: number }
}
