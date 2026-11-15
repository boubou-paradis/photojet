// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot : un téléphone devient le capitaine d'une équipe. Renvoie un
// jeton secret (gardé par le téléphone) ; seule son empreinte est stockée.
// Une équipe qui a déjà son capitaine est refusée : l'animateur doit
// d'abord « Remplacer » (vérifié en base, sous le verrou de la partie).

import { NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { generatePlayerToken, hashPlayerToken } from '@/lib/affinity/token'
import { OTHER_GAME_FLAGS, act, getDemiMotAdmin, isAnimatorAlive, type OtherGameFlags } from '@/lib/demimot/server'
import { parseJoinRequest } from '@/lib/demimot/validation'

const NO_GAME = 'Aucune partie À Demi-Mot en cours.'
const busy = () => NextResponse.json({ error: 'Réseau saturé, réessaie dans un instant.' }, { status: 503 })

type JoinSessionRow = { id: string; demimot_active: boolean | null } & OtherGameFlags

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  const parsed = parseJoinRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { code, teamId } = parsed.value
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()

  const admin = getDemiMotAdmin()
  const { data: sessionData, error: sessionError } = await admin
    .from('sessions')
    .select(`id, demimot_active, ${OTHER_GAME_FLAGS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()
  if (sessionError) return busy()
  const session = sessionData as JoinSessionRow | null
  if (!session) await recordCodeFailure(request, 'session', code)
  if (!session?.demimot_active || OTHER_GAME_FLAGS.some((flag) => session[flag] === true)) {
    return NextResponse.json({ error: NO_GAME }, { status: 409 })
  }
  const { data: runtime, error: runtimeError } = await admin.from('demimot_runtime').select('heartbeat_at').eq('session_id', session.id).maybeSingle()
  if (runtimeError) return busy()
  if (!runtime || !isAnimatorAlive(runtime.heartbeat_at as string)) return NextResponse.json({ error: NO_GAME }, { status: 409 })

  const token = generatePlayerToken()
  const { data, error } = await admin.rpc('demimot_join', { p_session_id: session.id, p_team_id: teamId, p_token_hash: hashPlayerToken(token) })
  if (error) {
    console.error('[À Demi-Mot] capitaine :', error.message)
    return busy()
  }
  const result = data as { ok: boolean; reason?: string; teamName?: string }
  if (!result.ok) {
    if (result.reason === 'taken') return NextResponse.json({ error: 'Cette équipe a déjà son capitaine. Demande à l’animateur de te la confier.' }, { status: 409 })
    if (result.reason === 'unknown_team') return NextResponse.json({ error: 'Équipe introuvable : choisis-en une autre.' }, { status: 404 })
    return NextResponse.json({ error: NO_GAME }, { status: 409 })
  }

  // L'écran géant affiche le capitaine connecté : vue publique recalculée
  // (sans faire échouer l'arrivée du capitaine si elle ne passe pas).
  try {
    await act(admin, session.id, () => null)
  } catch (e) {
    console.error('[À Demi-Mot] mise à jour après arrivée du capitaine :', e instanceof Error ? e.message : e)
  }

  return NextResponse.json({ sessionId: session.id, teamId, teamName: result.teamName, token })
}
