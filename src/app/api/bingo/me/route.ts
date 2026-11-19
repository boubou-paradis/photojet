// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo : le téléphone reprend après un rechargement, une fermeture du
// navigateur ou une coupure réseau. Renvoie SES cartons (par jeton), sans
// rien créer, même si la régie est en panne ou qu'un autre jeu est lancé.
// POST (jeton dans le corps, pas dans l'URL, pour ne pas finir dans les logs).
// gone (410) = la partie n'existe plus (quittée par l'animateur, ou remise à zéro).

import { NextResponse } from 'next/server'
import { hashPlayerToken } from '@/lib/affinity/token'
import { BingoError, findPlayer, findSession, getBingoAdmin } from '@/lib/bingo/server'
import { isSessionCode } from '@/lib/bingo/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  let body: Record<string, unknown> | null
  try {
    body = (await request.json()) as Record<string, unknown> | null
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE })
  }
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
  const token = body?.token
  if (!isSessionCode(code) || typeof token !== 'string' || token.length < 32 || token.length > 128) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE })
  }
  try {
    const admin = getBingoAdmin()
    const s = await findSession(admin, code)
    if (s.status === 'missing' || s.status === 'off') return NextResponse.json({ reason: 'gone' }, { status: 410, headers: NO_STORE })
    const player = await findPlayer(admin, s.gameId, hashPlayerToken(token))
    if (!player) return NextResponse.json({ reason: 'gone' }, { status: 410, headers: NO_STORE })
    return NextResponse.json(
      { sessionId: s.id, gameId: s.gameId, presence: s.status, playerId: player.playerId, name: player.name, cards: player.cards },
      { headers: NO_STORE },
    )
  } catch (e) {
    const status = e instanceof BingoError ? e.status : 503
    return NextResponse.json({ error: 'Reconnexion…' }, { status, headers: NO_STORE })
  }
}
