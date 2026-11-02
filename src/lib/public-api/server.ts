// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Lectures publiques côté serveur : remplacent peu à peu les lectures directes
// des pages invités. Clé service, donc chaque route choisit ses colonnes en
// liste blanche et ne renvoie jamais user_id ni les codes de borne.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const NO_STORE = { 'Cache-Control': 'no-store' }

/** Colonnes de Matching lues par le téléphone du joueur. */
export const MATCHING_PUBLIC_COLUMNS =
  'affinity_active, affinity_phase, affinity_questions, affinity_current_question, affinity_deadline, affinity_reveal'

export function getPublicAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface SessionVisibilityRow {
  is_active: boolean | null
  quiz_active: boolean | null
  quiz_lobby_visible: boolean | null
}

/** Garde uniquement les colonnes de la liste. */
export function pickColumns(row: Record<string, unknown>, columns: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(columns.map((column) => [column, row[column]]))
}

/** Même condition que les règles de lecture publiques de `sessions`. */
export function isPubliclyVisible(row: SessionVisibilityRow): boolean {
  return row.is_active === true || row.quiz_active === true || row.quiz_lobby_visible === true
}
