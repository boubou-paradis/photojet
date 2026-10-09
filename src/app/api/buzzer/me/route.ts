// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz : état du joueur, pour reprendre après un rechargement, une
// coupure réseau ou une mise en veille. Renvoie l'état public et MA place
// dans la manche en cours (rang, écart, bloqué ou non). Rien sur les autres
// joueurs au-delà de ce que montre l'écran géant.
// POST (jeton dans le corps, pas dans l'URL, pour ne pas finir dans les logs).

import { NextResponse } from 'next/server'
import { BUZZER_DATA_TTL_MS } from '@/lib/buzzer/constants'
import { getBuzzerAdmin, loadPublicState } from '@/lib/buzzer/server'
import type { BuzzerMe, BuzzerMyRound, BuzzStatus } from '@/lib/buzzer/types'
import { parsePlayerAuth } from '@/lib/buzzer/validation'
import { hashPlayerToken } from '@/lib/affinity/token'

const GONE = 'Cette partie est terminée.'
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const parsed = parsePlayerAuth(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { sessionId, playerId, token } = parsed.value

  const admin = getBuzzerAdmin()

  const [{ data: player, error: playerError }, { data: runtime, error: runtimeError }] = await Promise.all([
    admin
      .from('buzzer_players')
      .select('game_id, nickname, team_key, team_label, tested_at, removed_at')
      .eq('id', playerId)
      .eq('session_id', sessionId)
      .eq('token_hash', hashPlayerToken(token))
      .maybeSingle(),
    admin
      .from('buzzer_runtime')
      .select('game_id, mode, round_id, attempt, first_buzz_at, heartbeat_at')
      .eq('session_id', sessionId)
      .maybeSingle(),
  ])
  if (playerError || runtimeError) {
    return NextResponse.json({ error: 'Réseau saturé, réessaie dans un instant.' }, { status: 503, headers: NO_STORE })
  }
  if (!player) return NextResponse.json({ error: 'Joueur inconnu. Rejoins la partie à nouveau.' }, { status: 403, headers: NO_STORE })
  if (player.removed_at) return NextResponse.json({ error: 'L’animateur t’a retiré de la partie.' }, { status: 403, headers: NO_STORE })
  // Partie remplacée, quittée, ou abandonnée depuis plus de 24 h : rien n'est renvoyé.
  if (
    !runtime ||
    runtime.game_id !== player.game_id ||
    Date.now() - Date.parse(runtime.heartbeat_at as string) > BUZZER_DATA_TTL_MS
  ) {
    return NextResponse.json({ error: GONE }, { status: 410, headers: NO_STORE })
  }

  const unit = runtime.mode === 'team' ? `t:${player.team_key as string}` : `p:${playerId}`

  let myRound: BuzzerMyRound | null = null
  if (runtime.round_id) {
    const { data: buzz } = await admin
      .from('buzzer_buzzes')
      .select('id, attempt, status, received_at')
      .eq('round_id', runtime.round_id as string)
      .eq('unit_key', unit)
      .maybeSingle()
    if (buzz) {
      const { count } = await admin
        .from('buzzer_buzzes')
        .select('id', { count: 'exact', head: true })
        .eq('round_id', runtime.round_id as string)
        .eq('attempt', buzz.attempt as number)
        .lte('id', buzz.id as number)
      const firstAt = buzz.attempt === runtime.attempt && runtime.first_buzz_at ? Date.parse(runtime.first_buzz_at as string) : null
      myRound = {
        rank: count ?? 1,
        gapMs: firstAt === null ? 0 : Math.max(0, Date.parse(buzz.received_at as string) - firstAt),
        status: buzz.status as BuzzStatus,
        attempt: buzz.attempt as number,
      }
    }
  }

  let state
  try {
    state = await loadPublicState(admin, sessionId)
  } catch {
    return NextResponse.json({ error: 'Réseau saturé, réessaie dans un instant.' }, { status: 503, headers: NO_STORE })
  }

  const me: BuzzerMe = {
    nickname: (player.nickname as string | null) ?? null,
    team: (player.team_label as string | null) ?? null,
    unit,
    tested: player.tested_at !== null,
    myRound,
    state,
  }
  return NextResponse.json(me, { headers: NO_STORE })
}
