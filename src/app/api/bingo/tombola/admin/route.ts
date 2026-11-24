// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo · Tombola : régie, réservée au propriétaire de la session.
// Toute la tombola vit en base : une régie rouverte relit l'état exact (GET).
// GET  ?sessionId=  → { state, held, lotoRunning }
// POST { sessionId, action, ... } → launch | config | exit | heartbeat |
//      phones | draw | mark (voir parseTombolaCommand).

import { NextResponse } from 'next/server'
import { getBingoAdmin, requireSessionOwner } from '@/lib/bingo/server'
import { TombolaError, parseTombolaCommand, runTombola, tombolaSnapshot } from '@/lib/bingo/tombola-server'
import { isUuid } from '@/lib/bingo/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

function fail(e: unknown) {
  if (e instanceof TombolaError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: NO_STORE })
  console.error('[AnimaBingo tombola] régie :', e instanceof Error ? e.message : e)
  return NextResponse.json({ error: 'Réseau saturé, réessayez dans un instant.' }, { status: 503, headers: NO_STORE })
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE })
  if (!(await requireSessionOwner(sessionId))) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403, headers: NO_STORE })
  try {
    return NextResponse.json(await tombolaSnapshot(getBingoAdmin(), sessionId), { headers: NO_STORE })
  } catch (e) {
    return fail(e)
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE })
  }
  const sessionId = (body as { sessionId?: unknown } | null)?.sessionId
  const command = parseTombolaCommand(body)
  if (!isUuid(sessionId) || !command) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE })
  if (!(await requireSessionOwner(sessionId))) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403, headers: NO_STORE })
  try {
    return NextResponse.json(await runTombola(getBingoAdmin(), sessionId, command), { headers: NO_STORE })
  } catch (e) {
    return fail(e)
  }
}
