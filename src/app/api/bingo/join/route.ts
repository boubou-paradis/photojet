// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo : arrivée d'un joueur. Renvoie un jeton secret (gardé par le
// téléphone, seule son empreinte est stockée) et ses cartons, fabriqués ici.
// Même jeton = même joueur, mêmes cartons : rien n'est recréé.
// Nouveaux joueurs : seulement si la partie est en direct. Joueur déjà
// inscrit (jeton connu) : retrouvé même si la régie est en panne.

import { NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { generatePlayerToken, hashPlayerToken } from '@/lib/affinity/token'
import { BingoError, findPlayer, findSession, getBingoAdmin, joinPlayer, readGameSetup } from '@/lib/bingo/server'
import { parseJoin } from '@/lib/bingo/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }
const NO_GAME = 'Aucune partie AnimaBingo en cours.'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE })
  }
  const parsed = parseJoin(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE })
  const { code, name } = parsed.value
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()

  const admin = getBingoAdmin()
  try {
    const s = await findSession(admin, code)
    if (s.status === 'missing') await recordCodeFailure(request, 'session', code)
    if (s.status === 'missing' || s.status === 'off') return NextResponse.json({ error: NO_GAME }, { status: 409, headers: NO_STORE })

    // Retour d'un joueur déjà inscrit : ses cartons, sans rien créer.
    if (parsed.value.token) {
      const known = await findPlayer(admin, s.gameId, hashPlayerToken(parsed.value.token))
      if (known) {
        return NextResponse.json(
          { sessionId: s.id, gameId: s.gameId, token: parsed.value.token, playerId: known.playerId, name: known.name, cards: known.cards },
          { headers: NO_STORE },
        )
      }
    }
    if (s.status !== 'live') return NextResponse.json({ error: NO_GAME }, { status: 409, headers: NO_STORE })

    const token = parsed.value.token ?? generatePlayerToken()
    const { settings, music } = await readGameSetup(admin, s.id)
    const result = await joinPlayer(admin, s.id, hashPlayerToken(token), name, settings.cardsPerPlayer, music)
    return NextResponse.json({ sessionId: s.id, gameId: s.gameId, token, playerId: result.playerId, name, cards: result.cards }, { headers: NO_STORE })
  } catch (e) {
    if (e instanceof BingoError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: NO_STORE })
    console.error('[AnimaBingo] arrivée :', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Réseau saturé, réessaie dans un instant.' }, { status: 503, headers: NO_STORE })
  }
}
