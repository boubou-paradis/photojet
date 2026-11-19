// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo : état public de la partie (boules sorties, phase, dernier
// numéro, gagnants). Lu toutes les 3 s par les téléphones, SANS connexion
// temps réel ; réponse mise en cache 1 s par le CDN (300 téléphones = au
// plus une lecture base par seconde et par partie).
// Partie absente → { active: false }. Autre jeu lancé → { active: false,
// held: true } : la partie est gardée, le téléphone garde cartons et coches.
// Régie en panne → état normal avec paused: true.

import { NextResponse } from 'next/server'
import { BINGO_STATE_CACHE } from '@/lib/bingo/constants'
import { BingoError, findSession, getBingoAdmin, loadPublicState } from '@/lib/bingo/server'
import { isSessionCode } from '@/lib/bingo/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('code')
  const code = raw ? raw.trim().toUpperCase() : null
  if (!isSessionCode(code)) return NextResponse.json({ error: 'Code de session invalide.' }, { status: 400, headers: NO_STORE })
  const cached = { 'Cache-Control': BINGO_STATE_CACHE }
  try {
    const admin = getBingoAdmin()
    const s = await findSession(admin, code)
    const now = new Date().toISOString()
    if (s.status === 'missing' || s.status === 'off') return NextResponse.json({ active: false, held: false, serverNow: now }, { headers: cached })
    if (s.status === 'other') return NextResponse.json({ active: false, held: true, gameId: s.gameId, serverNow: now }, { headers: cached })
    return NextResponse.json(await loadPublicState(admin, s.id), { headers: cached })
  } catch (e) {
    // Panne passagère : le téléphone garde son affichage et réessaie (« Reconnexion… »).
    const status = e instanceof BingoError ? e.status : 503
    return NextResponse.json({ error: 'Reconnexion…' }, { status, headers: NO_STORE })
  }
}
