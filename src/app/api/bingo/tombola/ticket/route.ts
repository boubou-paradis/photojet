// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo · Tombola : ticket du téléphone. Aucun nom, aucune saisie.
// Le téléphone garde un jeton secret (seule son empreinte est stockée) :
// même jeton = même numéro, toujours (rechargement, panne, distribution
// fermée). Nouveau ticket seulement si la distribution est ouverte.
// POST { code, token? } → { token, tombolaId, number }

import { NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { generatePlayerToken, hashPlayerToken } from '@/lib/affinity/token'
import { getBingoAdmin } from '@/lib/bingo/server'
import { TombolaError, findTombola, tombolaTicket } from '@/lib/bingo/tombola-server'
import { isSessionCode } from '@/lib/bingo/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  let body: { code?: unknown; token?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE })
  }
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : null
  const given = typeof body?.token === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(body.token) ? body.token : null
  if (!isSessionCode(code)) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE })
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()
  try {
    const admin = getBingoAdmin()
    const t = await findTombola(admin, code)
    if (t.status === 'missing') await recordCodeFailure(request, 'session', code)
    if (t.status === 'missing' || t.status === 'off') {
      return NextResponse.json({ error: 'Aucune tombola en cours.', code: 'no_game' }, { status: 409, headers: NO_STORE })
    }
    const token = given ?? generatePlayerToken()
    const r = await tombolaTicket(admin, t.id, hashPlayerToken(token))
    return NextResponse.json({ token, tombolaId: r.tombolaId, number: r.number }, { headers: NO_STORE })
  } catch (e) {
    if (e instanceof TombolaError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: NO_STORE })
    console.error('[AnimaBingo tombola] ticket :', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Réseau saturé, réessayez dans un instant.' }, { status: 503, headers: NO_STORE })
  }
}
