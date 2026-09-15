// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { createClient } from '@/lib/supabase'
import type { Session } from '@/types/database'

type SupabaseBrowserClient = ReturnType<typeof createClient>

// Résout la session ciblée par `sessionId` (si fournie et appartenant à
// l'utilisateur), sinon retombe sur la session la plus récemment créée
// (comportement historique, conservé comme repli si aucun id n'est transmis).
// Centralise la requête pour que les pages admin ne la dupliquent plus
// chacune de leur côté — c'est cette duplication qui avait laissé le bug
// d'isolation de session non corrigé sur plusieurs pages à la fois.
export async function fetchUserSession(
  supabase: SupabaseBrowserClient,
  userId: string,
  sessionId?: string | null
): Promise<Session> {
  if (sessionId) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()

    if (!error && data) return data as Session
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) throw error
  return data as Session
}

// Variante pour les pages qui ont besoin de la liste complète en plus de la
// sélection (Paramètres, Borne).
export async function fetchUserSessions(
  supabase: SupabaseBrowserClient,
  userId: string
): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// Choisit `sessionId` dans `sessions` si présent et trouvé, sinon la plus
// récente (sessions[0], déjà triée par fetchUserSessions).
export function pickSession(sessions: Session[], sessionId?: string | null): Session | null {
  if (sessionId) {
    const found = sessions.find((s) => s.id === sessionId)
    if (found) return found
  }
  return sessions[0] ?? null
}
