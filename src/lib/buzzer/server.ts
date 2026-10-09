// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Accès base d'AnimaBuzz, côté serveur uniquement (routes API et cron).
// Les tables buzzer_* sont fermées (RLS sans policy) : seul ce client
// service_role les lit. Ne jamais importer ce fichier depuis un composant client.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { BUZZER_LIVE_STALE_MS } from './constants'
import type { BuzzerState } from './types'

// Vérification du propriétaire de la session : la même que Matching (réutilisée, non modifiée).
export { requireSessionOwner } from '@/lib/affinity/server'

export function getBuzzerAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Colonnes des autres jeux : AnimaBuzz s'efface dès que l'une est vraie. */
export const OTHER_GAME_FLAGS = [
  'quiz_active',
  'quiz_lobby_visible',
  'lineup_active',
  'wheel_active',
  'mystery_photo_active',
  'affinity_active',
] as const

export type OtherGameFlags = Partial<Record<(typeof OTHER_GAME_FLAGS)[number], boolean | null>>

export function isAnimatorAlive(heartbeatAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!heartbeatAt) return false
  const at = Date.parse(heartbeatAt)
  return Number.isFinite(at) && now - at <= BUZZER_LIVE_STALE_MS
}

/** Erreur métier d'une action (message déjà rédigé pour l'animateur). */
export class BuzzerActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/** Erreurs levées par la fonction SQL buzzer_admin → message et statut HTTP. */
export function mapAdminError(message: string): BuzzerActionError | null {
  if (message.includes('no_game')) return new BuzzerActionError('Aucune partie AnimaBuzz lancée.', 409)
  if (message.includes('wrong_step')) return new BuzzerActionError('Action impossible à cette étape de la partie.', 409)
  if (message.includes('invalid')) return new BuzzerActionError('Action invalide.', 400)
  return null
}

/** État public d'une session (même contenu que les diffusions). */
export async function loadPublicState(admin: SupabaseClient, sessionId: string): Promise<BuzzerState> {
  const { data, error } = await admin.rpc('buzzer_public_state', { p_session_id: sessionId })
  if (error) throw new Error(error.message)
  return data as BuzzerState
}
