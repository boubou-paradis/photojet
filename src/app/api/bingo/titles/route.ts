// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo, loto musical : titres et artistes de la playlist de la partie
// (écran géant et téléphones). JAMAIS les fichiers audio.
// La playlist est figée pendant la partie : la réponse ne change qu'avec son
// empreinte. Les clients demandent ?code=…&sig=<empreinte> et gardent la liste.
// Mise en cache par le CDN (une lecture base par minute et par partie au plus).

import { NextResponse } from 'next/server'
import { BingoError, findSession, getBingoAdmin, loadTitles } from '@/lib/bingo/server'
import { isSessionCode } from '@/lib/bingo/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }
const CACHED = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('code')
  const code = raw ? raw.trim().toUpperCase() : null
  if (!isSessionCode(code)) return NextResponse.json({ error: 'Code de session invalide.' }, { status: 400, headers: NO_STORE })
  try {
    const admin = getBingoAdmin()
    const s = await findSession(admin, code)
    if (s.status === 'missing' || s.status === 'off') return NextResponse.json({ sig: null, titles: [] }, { headers: NO_STORE })
    const t = await loadTitles(admin, s.id)
    return NextResponse.json(t ?? { sig: null, titles: [] }, { headers: t ? CACHED : NO_STORE })
  } catch (e) {
    const status = e instanceof BingoError ? e.status : 503
    return NextResponse.json({ error: 'Reconnexion…' }, { status, headers: NO_STORE })
  }
}
