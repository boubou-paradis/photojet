// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Avant de supprimer un média de question (photo, audio de révélation, audio de
// question) du stockage, on vérifie qu'aucun autre quiz du compte ne l'utilise :
// la bibliothèque (saved_quizzes) et les autres sessions pointent vers les MÊMES
// fichiers, pas vers des copies. En cas de doute (erreur, utilisateur inconnu),
// la réponse est « ne pas supprimer » : le média est seulement retiré de la question.

import type { SupabaseClient } from '@supabase/supabase-js'

const MEDIA_KEYS = ['photoUrl', 'audioUrl', 'questionAudioUrl'] as const

// Chemin du fichier dans le bucket photos, quelle que soit la forme de l'adresse
// (adresse publique complète, éventuellement avec ?paramètres, ou chemin brut).
export function quizMediaPath(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || url.trim() === '') return null
  const clean = url.split(/[?#]/)[0]
  const m = clean.match(/\/object\/(?:public|sign)\/photos\/(.+)$/)
  let path = m ? m[1] : clean.replace(/^\/+/, '')
  try { path = decodeURIComponent(path) } catch { /* adresse mal encodée : gardée telle quelle */ }
  return path || null
}

// Chemins de tous les médias d'une liste de questions (tableau ou JSON texte).
export function collectQuizMediaPaths(questions: unknown): Set<string> {
  const out = new Set<string>()
  let list = questions
  if (typeof list === 'string') {
    try { list = JSON.parse(list) } catch { return out }
  }
  if (!Array.isArray(list)) return out
  for (const q of list) {
    if (!q || typeof q !== 'object') continue
    for (const key of MEDIA_KEYS) {
      const p = quizMediaPath((q as Record<string, unknown>)[key] as string | null | undefined)
      if (p) out.add(p)
    }
  }
  return out
}

// true seulement si la vérification a abouti ET que le fichier n'est utilisé
// nulle part ailleurs : quiz en cours (hors le média retiré), bibliothèque du
// compte, autres sessions du compte. Toute erreur renvoie false.
export async function canDeleteQuizMedia(
  supabase: SupabaseClient,
  options: { url: string; sessionId: string; remainingQuestions: unknown },
): Promise<boolean> {
  try {
    const path = quizMediaPath(options.url)
    if (!path) return false
    if (collectQuizMediaPaths(options.remainingQuestions).has(path)) return false

    const { data: auth, error: authError } = await supabase.auth.getUser()
    const userId = auth?.user?.id
    if (authError || !userId) return false

    const [saved, sessions] = await Promise.all([
      supabase.from('saved_quizzes').select('questions').eq('user_id', userId),
      supabase.from('sessions').select('id, quiz_questions').eq('user_id', userId).neq('id', options.sessionId),
    ])
    if (saved.error || sessions.error || !Array.isArray(saved.data) || !Array.isArray(sessions.data)) return false

    for (const row of saved.data as { questions: unknown }[]) {
      if (collectQuizMediaPaths(row.questions).has(path)) return false
    }
    for (const row of sessions.data as { quiz_questions: unknown }[]) {
      if (collectQuizMediaPaths(row.quiz_questions).has(path)) return false
    }
    return true
  } catch {
    return false
  }
}
