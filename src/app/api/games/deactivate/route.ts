// © 2025 AnimaJet
// Désactivation d'un jeu à la fermeture de l'onglet admin (navigator.sendBeacon).
// Un fetch classique dans beforeunload est souvent tué par le navigateur avant
// d'aboutir → flags *_active résiduels en base → /live reste bloqué sur le jeu.
// sendBeacon garantit l'envoi même pendant le déchargement de la page.
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Liste blanche des colonnes réinitialisées par jeu — ne jamais accepter de
// colonnes arbitraires depuis le client.
const GAME_RESET_FLAGS: Record<string, Record<string, boolean>> = {
  mystery: { mystery_photo_active: false, mystery_is_playing: false },
  lineup: { lineup_active: false },
  wheel: { wheel_active: false },
}

export async function POST(request: Request) {
  let body: { sessionId?: unknown; game?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { sessionId, game } = body
  const updates = typeof game === 'string' ? GAME_RESET_FLAGS[game] : undefined
  if (typeof sessionId !== 'string' || !sessionId || !updates) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  // Client SSR (anon + cookies) : la RLS garantit que seul le propriétaire
  // de la session peut modifier sa ligne — pas de service role ici.
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', sessionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
