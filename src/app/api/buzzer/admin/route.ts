// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz : actions de l'animateur. Réservées au propriétaire de la
// session (cookies vérifiés côté serveur). Les changements d'état sont faits
// par la fonction SQL buzzer_admin, sous le verrou de la partie : chaque
// action n'est acceptée que dans les phases prévues, donc un double appui
// (souris ou télécommande) ne s'applique qu'une fois.
// `snapshot` (lecture seule) : état, joueurs et historique pour la page animateur.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BUZZER_OFFLINE_AFTER_MS } from '@/lib/buzzer/constants'
import { BuzzerActionError, getBuzzerAdmin, loadPublicState, mapAdminError, requireSessionOwner } from '@/lib/buzzer/server'
import type { BuzzerAdminPlayer, BuzzerOutcome, BuzzerRoundSummary } from '@/lib/buzzer/types'
import { parseAdminRequest } from '@/lib/buzzer/validation'

async function snapshot(admin: SupabaseClient, sessionId: string) {
  const state = await loadPublicState(admin, sessionId)
  if (!state.active) return { state, players: [], rounds: [] }

  const { data: runtime, error: runtimeError } = await admin
    .from('buzzer_runtime')
    .select('game_id')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (runtimeError) throw new Error(runtimeError.message)
  if (!runtime) return { state, players: [], rounds: [] }
  const gameId = runtime.game_id as string

  const [playersRes, roundsRes] = await Promise.all([
    admin
      .from('buzzer_players')
      .select('id, nickname, team_label, last_seen_at, last_rtt_ms, tested_at')
      .eq('game_id', gameId)
      .is('removed_at', null)
      .order('joined_at'),
    admin
      .from('buzzer_rounds')
      .select('round_no, outcome, winner_label')
      .eq('game_id', gameId)
      .order('round_no', { ascending: false })
      .limit(50),
  ])
  if (playersRes.error) throw new Error(playersRes.error.message)
  if (roundsRes.error) throw new Error(roundsRes.error.message)

  const now = Date.now()
  const players: BuzzerAdminPlayer[] = (playersRes.data ?? []).map((p) => ({
    id: p.id as string,
    label: (p.nickname as string | null) ?? (p.team_label as string),
    team: (p.team_label as string | null) ?? null,
    online: now - Date.parse(p.last_seen_at as string) <= BUZZER_OFFLINE_AFTER_MS,
    rttMs: (p.last_rtt_ms as number | null) ?? null,
    tested: p.tested_at !== null,
  }))
  const rounds: BuzzerRoundSummary[] = (roundsRes.data ?? []).map((r) => ({
    roundNo: r.round_no as number,
    outcome: (r.outcome as BuzzerOutcome | null) ?? null,
    winner: (r.winner_label as string | null) ?? null,
  }))
  return { state, players, rounds }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const parsed = parseAdminRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { sessionId, action, args } = parsed.value

  if (!(await requireSessionOwner(sessionId))) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const admin = getBuzzerAdmin()
  try {
    if (action === 'snapshot') {
      return NextResponse.json({ ok: true, ...(await snapshot(admin, sessionId)) }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const { data, error } = await admin.rpc('buzzer_admin', { p_session_id: sessionId, p_action: action, p_args: args })
    if (error) {
      const mapped = mapAdminError(error.message)
      if (mapped) throw mapped
      throw new Error(error.message)
    }
    return NextResponse.json({ ok: true, state: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof BuzzerActionError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error(`[AnimaBuzz] action ${action} :`, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Action impossible, réessayez.' }, { status: 500 })
  }
}
