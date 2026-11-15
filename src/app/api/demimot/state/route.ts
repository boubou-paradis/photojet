// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot : état public d'une partie (plateau sans la solution, porte des
// buzzers, scores). Même contenu que les diffusions du canal privé ; sert à
// la relecture (reconnexion, version sautée) de l'écran géant et des
// téléphones. Rien qui ne soit déjà affiché sur l'écran géant.

import { NextResponse } from 'next/server'
import { getDemiMotAdmin, loadPublicState } from '@/lib/demimot/server'
import { isUuid } from '@/lib/demimot/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session')
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session invalide.' }, { status: 400 })
  try {
    return NextResponse.json(await loadPublicState(getDemiMotAdmin(), sessionId), { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })
  }
}
