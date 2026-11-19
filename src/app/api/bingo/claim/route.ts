// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo : « QUINE ! » depuis un téléphone. Les coches partent ICI et
// seulement ici (jamais enregistrées autrement) ; la base garde le nombre de
// boules sorties au moment de l'appui, la régie vérifie à partir de là.
//
// Renvoi sans risque : un téléphone qui renvoie sa demande après une coupure
// retrouve la même demande (en attente ou déjà validée), jamais un doublon.
//
// { code, token, cardId, marks }  → envoie la demande
// { code, token, claimId }        → statut de SA demande (suivi tant qu'elle attend)

import { NextResponse } from 'next/server'
import { hashPlayerToken } from '@/lib/affinity/token'
import { BingoError, claim, claimStatus, findPlayer, findSession, getBingoAdmin } from '@/lib/bingo/server'
import { isSessionCode, parseClaim, parseMarks } from '@/lib/bingo/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }
const bad = () => NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE })

export async function POST(request: Request) {
  let body: Record<string, unknown> | null
  try {
    body = (await request.json()) as Record<string, unknown> | null
  } catch {
    return bad()
  }
  if (!body || typeof body !== 'object') return bad()

  try {
    const admin = getBingoAdmin()

    // Suivi d'une demande déjà envoyée.
    if (body.claimId !== undefined) {
      const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
      const token = body.token
      if (!isSessionCode(code) || typeof token !== 'string' || token.length < 32 || token.length > 128 || !Number.isSafeInteger(body.claimId)) return bad()
      const s = await findSession(admin, code)
      if (s.status === 'missing' || s.status === 'off') return NextResponse.json({ reason: 'gone' }, { status: 410, headers: NO_STORE })
      const player = await findPlayer(admin, s.gameId, hashPlayerToken(token))
      if (!player) return NextResponse.json({ reason: 'gone' }, { status: 410, headers: NO_STORE })
      const status = await claimStatus(admin, body.claimId as number, player.playerId)
      return NextResponse.json({ claimId: body.claimId, status: status ?? 'gone' }, { headers: NO_STORE })
    }

    const parsed = parseClaim(body)
    if (!parsed.ok) return bad()
    const { code, token, cardId } = parsed.value
    const s = await findSession(admin, code)
    if (s.status === 'missing' || s.status === 'off') return NextResponse.json({ reason: 'gone', error: 'Cette partie est terminée.' }, { status: 410, headers: NO_STORE })
    const tokenHash = hashPlayerToken(token)
    const player = await findPlayer(admin, s.gameId, tokenHash)
    const card = player?.cards.find((c) => c.id === cardId)
    if (!player || !card) return NextResponse.json({ error: 'Carton introuvable pour ce téléphone.', code: 'forbidden' }, { status: 403, headers: NO_STORE })
    const marks = parseMarks(parsed.value.marks, card.cells)
    if (!marks) return bad()
    const result = await claim(admin, s.id, player.playerId, tokenHash, cardId, marks)
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (e) {
    if (e instanceof BingoError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: NO_STORE })
    console.error('[AnimaBingo] demande :', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Réseau saturé, la demande sera renvoyée.' }, { status: 503, headers: NO_STORE })
  }
}
