// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaVote : arrivée d'un téléphone (sans pseudo). Renvoie un jeton secret
// (gardé par le téléphone) ; seule son empreinte est stockée. Un téléphone
// qui revient avec un jeton encore valable garde SON identité : pas de
// nouveau droit de vote après un rechargement. Plafond vérifié en base.

import { NextResponse } from 'next/server'
import { VOTE_LIMITS } from '@/lib/vote/constants'
import { OTHER_GAME_FLAGS, getVoteAdmin, isAnimatorAlive, type OtherGameFlags } from '@/lib/vote/server'
import { parseJoinRequest } from '@/lib/vote/validation'
import { generatePlayerToken, hashPlayerToken } from '@/lib/affinity/token'

const NO_GAME = 'Aucun vote en cours.'
// Base injoignable ou saturée : le téléphone doit réessayer, pas croire qu'il n'y a pas de vote.
const busy = () => NextResponse.json({ error: 'Réseau saturé, réessaie dans un instant.' }, { status: 503 })

type JoinSessionRow = { id: string; vote_active: boolean | null } & OtherGameFlags

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const parsed = parseJoinRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { code, previous } = parsed.value

  const admin = getVoteAdmin()

  const { data: sessionData, error: sessionError } = await admin
    .from('sessions')
    .select(`id, vote_active, ${OTHER_GAME_FLAGS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()
  if (sessionError) return busy()
  const session = sessionData as JoinSessionRow | null
  if (!session?.vote_active || OTHER_GAME_FLAGS.some((flag) => session[flag] === true)) {
    return NextResponse.json({ error: NO_GAME }, { status: 409 })
  }

  const { data: runtime, error: runtimeError } = await admin
    .from('vote_runtime')
    .select('game_id, heartbeat_at')
    .eq('session_id', session.id)
    .maybeSingle()
  if (runtimeError) return busy()
  if (!runtime || !isAnimatorAlive(runtime.heartbeat_at as string)) {
    return NextResponse.json({ error: NO_GAME }, { status: 409 })
  }

  // Retour du même téléphone : identité réutilisée si elle appartient à la partie en cours.
  if (previous) {
    const { data: known, error: knownError } = await admin
      .from('vote_participants')
      .select('id')
      .eq('id', previous.participantId)
      .eq('session_id', session.id)
      .eq('game_id', runtime.game_id as string)
      .eq('token_hash', hashPlayerToken(previous.token))
      .maybeSingle()
    if (knownError) return busy()
    if (known) {
      return NextResponse.json({ sessionId: session.id, participantId: previous.participantId, token: previous.token, resumed: true })
    }
  }

  const token = generatePlayerToken()
  const { data, error } = await admin.rpc('vote_join', {
    p_session_id: session.id,
    p_token_hash: hashPlayerToken(token),
    p_max_participants: VOTE_LIMITS.maxParticipants,
  })
  if (error) {
    console.error('[AnimaVote] arrivée :', error.message)
    return busy()
  }

  const result = data as { ok: boolean; reason?: string; participantId?: string }
  if (!result.ok) {
    if (result.reason === 'full') return NextResponse.json({ error: 'Le vote est complet.' }, { status: 409 })
    return NextResponse.json({ error: NO_GAME }, { status: 409 })
  }

  // Compteur « participants connectés » de l'écran géant : diffusé sur le canal
  // de l'écran seulement (les téléphones n'en ont pas besoin). Attendu : une
  // requête Supabase non attendue ne part jamais. Échec sans gravité (l'écran relit).
  const { error: notifyError } = await admin.rpc('vote_notify_tally', { p_session_id: session.id })
  if (notifyError) console.error('[AnimaVote] diffusion arrivée :', notifyError.message)

  return NextResponse.json({ sessionId: session.id, participantId: result.participantId as string, token, resumed: false })
}
