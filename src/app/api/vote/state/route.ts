// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaVote : état public d'une partie pour l'écran géant (scrutin, nombre
// de bulletins, et les totaux seulement quand ils peuvent être montrés).
// Même contenu que les diffusions du canal « vote-live » ; sert à la
// relecture (reconnexion, version sautée). Jamais de bulletin individuel.

import { NextResponse } from 'next/server'
import { getVoteAdmin, loadPublicState } from '@/lib/vote/server'
import { isUuid } from '@/lib/vote/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session')
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session invalide.' }, { status: 400 })
  try {
    const state = await loadPublicState(getVoteAdmin(), sessionId, false)
    return NextResponse.json(state, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })
  }
}
