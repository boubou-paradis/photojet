// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo : statut public d'une session, pour /invite et /live.
// live    = lancé, aucun autre jeu actif, régie vivante (moins de 3 min) :
//           les nouveaux arrivants peuvent entrer.
// present = la partie existe et n'est pas masquée par un autre jeu (régie
//           éventuellement en panne) : l'écran et les joueurs déjà inscrits
//           la gardent, affichée « en pause ».
// held    = un autre jeu est lancé : AnimaBingo est en pause, rien n'est effacé.

import { NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { BingoError, findSession, getBingoAdmin } from '@/lib/bingo/server'
import { isSessionCode } from '@/lib/bingo/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('code')
  const code = raw ? raw.trim().toUpperCase() : null
  if (!isSessionCode(code)) return NextResponse.json({ error: 'Code de session invalide.' }, { status: 400 })
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()
  try {
    const s = await findSession(getBingoAdmin(), code)
    if (s.status === 'missing') await recordCodeFailure(request, 'session', code)
    return NextResponse.json(
      {
        live: s.status === 'live',
        present: s.status === 'live' || s.status === 'stale',
        held: s.status === 'other',
        sessionId: s.id,
        serverNow: new Date().toISOString(),
      },
      { headers: NO_STORE },
    )
  } catch (e) {
    const status = e instanceof BingoError ? e.status : 503
    return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status, headers: NO_STORE })
  }
}
