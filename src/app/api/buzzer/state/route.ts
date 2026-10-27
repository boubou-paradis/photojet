// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz : état public d'une partie (phase, prioritaire, file des 5
// premiers). Même contenu que les diffusions du canal privé ; sert à la
// relecture (reconnexion, version sautée) de l'écran géant et des téléphones.
// Rien qui ne soit déjà affiché sur l'écran géant.
// `prep=1` : ajoute l'état public des manches préparées (champ `prep`), dans
// la même requête. `scores=1` : ajoute le classement public (champ
// `scores`). Sans ces paramètres, la réponse est inchangée.

import { NextResponse } from 'next/server'
import { getBuzzerAdmin, loadPublicState } from '@/lib/buzzer/server'
import { isUuid } from '@/lib/buzzer/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const sessionId = params.get('session')
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session invalide.' }, { status: 400 })
  try {
    const admin = getBuzzerAdmin()
    const withPrep = params.get('prep') === '1'
    const withScores = params.get('scores') === '1'
    if (withPrep || withScores) {
      const [state, prep, scores] = await Promise.all([
        loadPublicState(admin, sessionId),
        withPrep ? admin.rpc('buzzer_prep_public', { p_session_id: sessionId }) : null,
        withScores ? admin.rpc('buzzer_scores_public', { p_session_id: sessionId }) : null,
      ])
      if (prep?.error) throw new Error(prep.error.message)
      if (scores?.error) throw new Error(scores.error.message)
      return NextResponse.json(
        { ...state, ...(prep ? { prep: prep.data } : {}), ...(scores ? { scores: scores.data } : {}) },
        { headers: NO_STORE },
      )
    }
    const state = await loadPublicState(admin, sessionId)
    return NextResponse.json(state, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })
  }
}
