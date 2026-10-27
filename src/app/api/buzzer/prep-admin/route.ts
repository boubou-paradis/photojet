// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — déroulé des manches préparées, côté animateur. Réservé au
// propriétaire de la session (cookies vérifiés côté serveur).
// - check : la liste enregistrée est-elle jouable ? (rien n'est modifié)
// - start : la liste est RELUE ici (jamais reçue du navigateur), validée
//   strictement puis figée par buzzer_prep_admin. Modifier la liste ensuite
//   ne change pas la soirée en cours.
// - snapshot : état public + manches figées complètes (réponses, extraits,
//   bonne réponse du vote) pour la page animateur seulement.
// - autres actions : buzzer_prep_admin, sous le verrou de la partie (un
//   double appui, souris ou télécommande, ne s'applique qu'une fois).

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PREP_ACTIONS, type PrepAction } from '@/lib/buzzer/prep-flow'
import { parseRoundsForLaunch, type PrepRound } from '@/lib/buzzer/prep'
import { BuzzerActionError, getBuzzerAdmin, mapAdminError, requireSessionOwner } from '@/lib/buzzer/server'
import { isUuid } from '@/lib/buzzer/validation'

const noStore = { 'Cache-Control': 'no-store' }
const ACTIONS = ['check', 'snapshot', ...PREP_ACTIONS] as const
type Action = (typeof ACTIONS)[number]

async function loadLaunchRounds(admin: SupabaseClient, sessionId: string, userId: string): Promise<PrepRound[]> {
  const { data, error } = await admin.from('buzzer_prep_sets').select('data').eq('session_id', sessionId).maybeSingle()
  if (error) throw new Error(error.message)
  const rounds = (data?.data as { rounds?: unknown } | undefined)?.rounds ?? []
  const parsed = parseRoundsForLaunch(rounds, userId)
  if (!parsed.ok) throw new BuzzerActionError(parsed.error, 400)
  return parsed.value
}

/** Manches figées de la partie en cours (null si les manches ne sont pas lancées). */
async function loadFrozenRounds(admin: SupabaseClient, sessionId: string): Promise<PrepRound[] | null> {
  const { data: runtime, error: runtimeError } = await admin.from('buzzer_runtime').select('game_id').eq('session_id', sessionId).maybeSingle()
  if (runtimeError) throw new Error(runtimeError.message)
  if (!runtime) return null
  const { data, error } = await admin
    .from('buzzer_prep_runtime')
    .select('rounds')
    .eq('session_id', sessionId)
    .eq('game_id', runtime.game_id as string)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? (data.rounds as PrepRound[]) : null
}

function mapPrepError(message: string): BuzzerActionError | null {
  if (message.includes('no_prep')) return new BuzzerActionError('Les manches préparées ne sont pas lancées.', 409)
  return mapAdminError(message)
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  const { sessionId, action } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session invalide.' }, { status: 400 })
  if (typeof action !== 'string' || !(ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
  }
  const a = action as Action

  const userId = await requireSessionOwner(sessionId)
  if (!userId) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const admin = getBuzzerAdmin()
  try {
    if (a === 'check') {
      const rounds = await loadLaunchRounds(admin, sessionId, userId)
      return NextResponse.json({ ok: true, total: rounds.length }, { headers: noStore })
    }

    if (a === 'snapshot') {
      const [prepRes, rounds] = await Promise.all([
        admin.rpc('buzzer_prep_public', { p_session_id: sessionId }),
        loadFrozenRounds(admin, sessionId),
      ])
      if (prepRes.error) throw new Error(prepRes.error.message)
      return NextResponse.json({ ok: true, prep: prepRes.data, rounds }, { headers: noStore })
    }

    const args: Record<string, unknown> = {}
    let rounds: PrepRound[] | null = null
    if (a === 'start') {
      rounds = await loadLaunchRounds(admin, sessionId, userId)
      args.rounds = rounds
    }
    const { data, error } = await admin.rpc('buzzer_prep_admin', { p_session_id: sessionId, p_action: a satisfies PrepAction, p_args: args })
    if (error) {
      const mapped = mapPrepError(error.message)
      if (mapped) throw mapped
      throw new Error(error.message)
    }
    const result = data as { state: unknown; prep: unknown }
    return NextResponse.json({ ok: true, state: result.state, prep: result.prep, ...(rounds ? { rounds } : {}) }, { headers: noStore })
  } catch (e) {
    if (e instanceof BuzzerActionError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error(`[AnimaBuzz] manches ${a} :`, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Action impossible, réessayez.' }, { status: 500 })
  }
}
