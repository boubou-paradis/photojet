// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz : inscription d'un joueur (pseudo, ou équipe selon le mode).
// Renvoie un jeton secret (gardé par le téléphone) ; seule son empreinte
// est stockée. Plafond de joueurs et pseudo unique vérifiés en base.

import { NextResponse } from 'next/server'
import { BUZZER_LIMITS } from '@/lib/buzzer/constants'
import { OTHER_GAME_FLAGS, getBuzzerAdmin, isAnimatorAlive, type OtherGameFlags } from '@/lib/buzzer/server'
import { nicknameKey, parseJoinRequest, resolveTeam, suggestNickname } from '@/lib/buzzer/validation'
import { generatePlayerToken, hashPlayerToken } from '@/lib/affinity/token'

const NO_GAME = 'Aucune partie AnimaBuzz en cours.'
// Base injoignable ou saturée : le joueur doit réessayer, pas croire qu'il n'y a pas de partie.
const busy = () => NextResponse.json({ error: 'Réseau saturé, réessaie dans un instant.' }, { status: 503 })

type JoinSessionRow = { id: string; buzzer_active: boolean | null } & OtherGameFlags

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const parsed = parseJoinRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { code, nickname, team } = parsed.value

  const admin = getBuzzerAdmin()

  const { data: sessionData, error: sessionError } = await admin
    .from('sessions')
    .select(`id, buzzer_active, ${OTHER_GAME_FLAGS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()
  if (sessionError) return busy()
  const session = sessionData as JoinSessionRow | null
  if (!session?.buzzer_active || OTHER_GAME_FLAGS.some((flag) => session[flag] === true)) {
    return NextResponse.json({ error: NO_GAME }, { status: 409 })
  }

  const { data: runtime, error: runtimeError } = await admin
    .from('buzzer_runtime')
    .select('game_id, mode, teams, heartbeat_at')
    .eq('session_id', session.id)
    .maybeSingle()
  if (runtimeError) return busy()
  if (!runtime || !isAnimatorAlive(runtime.heartbeat_at as string)) {
    return NextResponse.json({ error: NO_GAME }, { status: 409 })
  }

  const mode = runtime.mode as 'solo' | 'team'
  let teamKey: string | null = null
  let teamLabel: string | null = null
  if (mode === 'solo') {
    if (!nickname) return NextResponse.json({ error: 'Choisis un pseudo.' }, { status: 400 })
  } else {
    if (!team) return NextResponse.json({ error: 'Choisis ton équipe.' }, { status: 400 })
    const resolved = resolveTeam(team, (runtime.teams as string[] | null) ?? [])
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 })
    teamKey = resolved.value.key
    teamLabel = resolved.value.label
  }

  const token = generatePlayerToken()
  const { data, error } = await admin.rpc('buzzer_join', {
    p_session_id: session.id,
    p_nickname: mode === 'solo' ? nickname : null,
    p_nickname_key: mode === 'solo' && nickname ? nicknameKey(nickname) : null,
    p_team_key: teamKey,
    p_team_label: teamLabel,
    p_token_hash: hashPlayerToken(token),
    p_max_players: BUZZER_LIMITS.maxPlayers,
  })
  if (error) {
    console.error('[AnimaBuzz] inscription :', error.message)
    return busy()
  }

  const result = data as { ok: boolean; reason?: string; playerId?: string }
  if (!result.ok) {
    if (result.reason === 'full') return NextResponse.json({ error: 'La partie est complète.' }, { status: 409 })
    if (result.reason === 'nickname_taken' && nickname) {
      const { data: taken } = await admin
        .from('buzzer_players')
        .select('nickname_key')
        .eq('game_id', runtime.game_id as string)
        .not('nickname_key', 'is', null)
      const suggestion = suggestNickname(nickname, new Set((taken ?? []).map((row) => row.nickname_key as string)))
      return NextResponse.json({ error: 'Ce pseudo est déjà pris.', suggestion }, { status: 409 })
    }
    if (result.reason === 'invalid') return NextResponse.json({ error: 'Inscription invalide.' }, { status: 400 })
    return NextResponse.json({ error: NO_GAME }, { status: 409 })
  }

  const playerId = result.playerId as string
  return NextResponse.json({
    sessionId: session.id,
    playerId,
    token,
    mode,
    nickname: mode === 'solo' ? nickname : null,
    team: teamLabel,
    unit: mode === 'solo' ? `p:${playerId}` : `t:${teamKey}`,
  })
}
