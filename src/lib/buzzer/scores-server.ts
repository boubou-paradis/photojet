// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — points, côté serveur. L'attribution automatique (bonne
// réponse, bon vote) suit l'action de jeu sans jamais la faire échouer :
// en cas d'erreur, la partie continue et les points pourront être corrigés
// à la main. Chaque attribution est unique en base (une manche ou un vote
// ne rapporte qu'une fois, même après un double appui).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScoresState } from './scores'

export async function awardScores(
  admin: SupabaseClient,
  sessionId: string,
  action: 'award_round' | 'award_vote',
): Promise<ScoresState | null> {
  try {
    const { data, error } = await admin.rpc('buzzer_score_admin', { p_session_id: sessionId, p_action: action, p_args: {} })
    if (error) throw new Error(error.message)
    return data as ScoresState
  } catch (e) {
    console.error(`[AnimaBuzz] points ${action} :`, e instanceof Error ? e.message : e)
    return null
  }
}
