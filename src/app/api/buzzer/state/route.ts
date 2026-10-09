// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz : état public d'une partie (phase, prioritaire, file des 5
// premiers). Même contenu que les diffusions du canal privé ; sert à la
// relecture (reconnexion, version sautée) de l'écran géant et des téléphones.
// Rien qui ne soit déjà affiché sur l'écran géant.

import { NextResponse } from 'next/server'
import { getBuzzerAdmin, loadPublicState } from '@/lib/buzzer/server'
import { isUuid } from '@/lib/buzzer/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session')
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session invalide.' }, { status: 400 })
  try {
    const state = await loadPublicState(getBuzzerAdmin(), sessionId)
    return NextResponse.json(state, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })
  }
}
