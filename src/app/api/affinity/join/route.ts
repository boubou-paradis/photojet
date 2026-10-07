// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching : inscription d'un joueur. Renvoie un jeton secret (gardé par le
// téléphone) ; seule son empreinte est stockée.

import { NextResponse } from 'next/server'
import { AFFINITY_LIMITS } from '@/lib/affinity/constants'
import {
  AFFINITY_SESSION_COLUMNS,
  OTHER_GAME_FLAGS,
  getAffinityAdmin,
  isHeartbeatFresh,
  type AffinitySessionRow,
} from '@/lib/affinity/server'
import { generatePlayerToken, hashPlayerToken } from '@/lib/affinity/token'
import { nicknameKey, parseJoinRequest, suggestNickname } from '@/lib/affinity/validation'

type JoinSessionRow = AffinitySessionRow & Partial<Record<(typeof OTHER_GAME_FLAGS)[number], boolean | null>>

const NO_GAME = 'Aucune partie Matching en cours.'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const parsed = parseJoinRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { code, nickname, table, consent } = parsed.value

  const admin = getAffinityAdmin()

  const { data: sessionData } = await admin
    .from('sessions')
    .select(`${AFFINITY_SESSION_COLUMNS}, ${OTHER_GAME_FLAGS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()
  const session = sessionData as JoinSessionRow | null
  if (
    !session ||
    !session.affinity_active ||
    !session.affinity_phase ||
    session.affinity_phase === 'finished' ||
    OTHER_GAME_FLAGS.some((flag) => session[flag] === true)
  ) {
    return NextResponse.json({ error: NO_GAME }, { status: 409 })
  }

  const { data: runtime } = await admin
    .from('affinity_runtime')
    .select('round_id, heartbeat_at')
    .eq('session_id', session.id)
    .maybeSingle()
  if (!runtime || !isHeartbeatFresh(runtime.heartbeat_at as string)) {
    return NextResponse.json({ error: NO_GAME }, { status: 409 })
  }
  const roundId = runtime.round_id as string

  const { count } = await admin
    .from('affinity_players')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)
  if ((count ?? 0) >= AFFINITY_LIMITS.maxPlayers) {
    return NextResponse.json({ error: 'La partie est complète.' }, { status: 409 })
  }

  const token = generatePlayerToken()
  const { data: player, error } = await admin
    .from('affinity_players')
    .insert({
      session_id: session.id,
      round_id: roundId,
      nickname,
      nickname_key: nicknameKey(nickname),
      table_label: table,
      consent,
      token_hash: hashPlayerToken(token),
    })
    .select('id')
    .single()

  if (error) {
    // Pseudo déjà pris (contrainte unique round_id + nickname_key) : refus avec suggestion.
    if (error.code === '23505') {
      const { data: taken } = await admin.from('affinity_players').select('nickname_key').eq('round_id', roundId)
      const suggestion = suggestNickname(nickname, new Set((taken ?? []).map((row) => row.nickname_key as string)))
      return NextResponse.json({ error: 'Ce pseudo est déjà pris.', suggestion }, { status: 409 })
    }
    console.error('[Matching] inscription :', error.message)
    return NextResponse.json({ error: 'Inscription impossible, réessaie.' }, { status: 500 })
  }

  return NextResponse.json({ sessionId: session.id, playerId: player.id as string, token, nickname })
}
