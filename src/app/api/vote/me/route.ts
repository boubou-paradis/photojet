// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaVote : état du téléphone, pour reprendre après un rechargement, une
// coupure réseau ou une mise en veille. Renvoie l'état public (sans aucun
// résultat) et MON bulletin pour le scrutin affiché. Rien sur les autres.
// POST (jeton dans le corps, pas dans l'URL, pour ne pas finir dans les logs).

import { NextResponse } from 'next/server'
import { VOTE_DATA_TTL_MS } from '@/lib/vote/constants'
import { getVoteAdmin, loadPublicState } from '@/lib/vote/server'
import type { VoteMe } from '@/lib/vote/types'
import { parseParticipantAuth } from '@/lib/vote/validation'
import { hashPlayerToken } from '@/lib/affinity/token'

const GONE = 'Ce vote est terminé.'
const NO_STORE = { 'Cache-Control': 'no-store' }
const busy = () => NextResponse.json({ error: 'Réseau saturé, réessaie dans un instant.' }, { status: 503, headers: NO_STORE })

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const parsed = parseParticipantAuth(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { sessionId, participantId, token } = parsed.value

  const admin = getVoteAdmin()

  const [{ data: participant, error: participantError }, { data: runtime, error: runtimeError }] = await Promise.all([
    admin
      .from('vote_participants')
      .select('game_id')
      .eq('id', participantId)
      .eq('session_id', sessionId)
      .eq('token_hash', hashPlayerToken(token))
      .maybeSingle(),
    admin
      .from('vote_runtime')
      .select('game_id, event_id, heartbeat_at')
      .eq('session_id', sessionId)
      .maybeSingle(),
  ])
  if (participantError || runtimeError) return busy()
  if (!participant) return NextResponse.json({ error: 'Téléphone inconnu. Scanne à nouveau le QR code.' }, { status: 403, headers: NO_STORE })
  // Partie relancée, quittée, ou abandonnée depuis plus de 24 h : rien n'est renvoyé.
  if (
    !runtime ||
    runtime.game_id !== participant.game_id ||
    Date.now() - Date.parse(runtime.heartbeat_at as string) > VOTE_DATA_TTL_MS
  ) {
    return NextResponse.json({ error: GONE }, { status: 410, headers: NO_STORE })
  }

  let myBallot: VoteMe['myBallot'] = null
  if (runtime.event_id) {
    const { data: ballot, error: ballotError } = await admin
      .from('vote_ballots')
      .select('candidate_id')
      .eq('event_id', runtime.event_id as string)
      .eq('participant_id', participantId)
      .maybeSingle()
    if (ballotError) return busy()
    if (ballot) {
      const candidateId = (ballot.candidate_id as string | null) ?? null
      myBallot = { eventId: runtime.event_id as string, candidateId, blank: candidateId === null }
    }
  }

  let state
  try {
    state = await loadPublicState(admin, sessionId, true)
  } catch {
    return busy()
  }

  await admin.from('vote_participants').update({ last_seen_at: new Date().toISOString() }).eq('id', participantId)

  const me: VoteMe = { myBallot, state }
  return NextResponse.json(me, { headers: NO_STORE })
}
