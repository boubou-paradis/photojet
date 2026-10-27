// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — points et classement, côté animateur. Réservé au propriétaire
// de la session (cookies vérifiés côté serveur). Toutes les actions passent
// par buzzer_score_admin, sous le verrou de la partie.

import { NextResponse } from 'next/server'
import { parseScoreArgs, SCORE_ACTIONS, type ScoreAction } from '@/lib/buzzer/scores'
import { BuzzerActionError, getBuzzerAdmin, mapAdminError, requireSessionOwner } from '@/lib/buzzer/server'
import { isUuid } from '@/lib/buzzer/validation'

const noStore = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  const { sessionId, action, args } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session invalide.' }, { status: 400 })
  if (typeof action !== 'string' || !(SCORE_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
  }
  const a = action as ScoreAction
  const parsed = parseScoreArgs(a, args)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (!(await requireSessionOwner(sessionId))) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const admin = getBuzzerAdmin()
  try {
    const { data, error } = await admin.rpc('buzzer_score_admin', { p_session_id: sessionId, p_action: a, p_args: parsed.value })
    if (error) {
      const mapped = mapAdminError(error.message)
      if (mapped) throw mapped
      throw new Error(error.message)
    }
    return NextResponse.json({ ok: true, scores: data }, { headers: noStore })
  } catch (e) {
    if (e instanceof BuzzerActionError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error(`[AnimaBuzz] points ${a} :`, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Action impossible, réessayez.' }, { status: 500 })
  }
}
