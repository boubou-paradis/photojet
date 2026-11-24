// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo · Tombola : état public (numéros sortis, lots, tickets).
// Lu toutes les 3 s par les téléphones, SANS temps réel ; mis en cache 1 s
// par le CDN, comme le loto. Pas de tombola → { active: false } ; autre jeu
// à l'écran → { active: false, held: true } (rien n'est effacé).

import { NextResponse } from 'next/server'
import { BINGO_STATE_CACHE } from '@/lib/bingo/constants'
import { getBingoAdmin } from '@/lib/bingo/server'
import { TombolaError, findTombola, tombolaState } from '@/lib/bingo/tombola-server'
import { isSessionCode } from '@/lib/bingo/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('code')
  const code = raw ? raw.trim().toUpperCase() : null
  if (!isSessionCode(code)) return NextResponse.json({ error: 'Code de session invalide.' }, { status: 400, headers: NO_STORE })
  const cached = { 'Cache-Control': BINGO_STATE_CACHE }
  try {
    const admin = getBingoAdmin()
    const t = await findTombola(admin, code)
    const now = new Date().toISOString()
    if (t.status === 'missing' || t.status === 'off') return NextResponse.json({ active: false, held: false, serverNow: now }, { headers: cached })
    if (t.status === 'other') return NextResponse.json({ active: false, held: true, serverNow: now }, { headers: cached })
    return NextResponse.json(await tombolaState(admin, t.id), { headers: cached })
  } catch (e) {
    const status = e instanceof TombolaError ? e.status : 503
    return NextResponse.json({ error: 'Reconnexion…' }, { status, headers: NO_STORE })
  }
}
