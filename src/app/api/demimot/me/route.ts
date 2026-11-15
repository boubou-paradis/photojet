// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot : le téléphone d'un capitaine reprend après un rechargement,
// une coupure réseau ou une mise en veille. Vérifie que ce téléphone est
// toujours le capitaine de son équipe (sinon : remplacé par l'animateur, ou
// partie terminée) et renvoie l'état public.
// POST (jeton dans le corps, pas dans l'URL, pour ne pas finir dans les logs).

import { NextResponse } from 'next/server'
import { hashPlayerToken } from '@/lib/affinity/token'
import { getDemiMotAdmin, loadPublicState } from '@/lib/demimot/server'
import { parseCaptainRequest } from '@/lib/demimot/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  const parsed = parseCaptainRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { sessionId, teamId, token } = parsed.value

  const admin = getDemiMotAdmin()
  const [team, runtime] = await Promise.all([
    admin.from('demimot_teams').select('game_id, name, captain_token_hash').eq('id', teamId).eq('session_id', sessionId).maybeSingle(),
    admin.from('demimot_runtime').select('game_id').eq('session_id', sessionId).maybeSingle(),
  ])
  if (team.error || runtime.error) return NextResponse.json({ error: 'Réseau saturé, réessaie dans un instant.' }, { status: 503, headers: NO_STORE })
  if (!runtime.data || !team.data || team.data.game_id !== runtime.data.game_id) {
    return NextResponse.json({ error: 'Cette partie est terminée.', reason: 'gone' }, { status: 410, headers: NO_STORE })
  }
  if (team.data.captain_token_hash !== hashPlayerToken(token)) {
    return NextResponse.json({ error: 'L’animateur a confié ton équipe à un autre téléphone.', reason: 'revoked' }, { status: 403, headers: NO_STORE })
  }
  try {
    const state = await loadPublicState(admin, sessionId)
    return NextResponse.json({ teamId, teamName: team.data.name, state }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Réseau saturé, réessaie dans un instant.' }, { status: 503, headers: NO_STORE })
  }
}
