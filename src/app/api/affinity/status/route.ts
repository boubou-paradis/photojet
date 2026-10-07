// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching : état public d'une session, pour /invite et /live.
// `live` = Matching actif, aucun autre jeu actif ET page animateur vivante
// (signal de vie de moins de 3 min, lu dans affinity_runtime, table hors
// realtime). `playerCount` = joueurs inscrits, `answeredCount` = nombre de
// réponses à la question en cours.
// Aucune donnée nominative.

import { NextResponse } from 'next/server'
import {
  AFFINITY_SESSION_COLUMNS,
  OTHER_GAME_FLAGS,
  countQuestionAnswers,
  getAffinityAdmin,
  isHeartbeatFresh,
  type AffinitySessionRow,
} from '@/lib/affinity/server'
import type { AffinityQuestion } from '@/lib/affinity/types'
import { isSessionCode } from '@/lib/affinity/validation'

type StatusSessionRow = AffinitySessionRow & Partial<Record<(typeof OTHER_GAME_FLAGS)[number], boolean | null>>

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code')
  if (!isSessionCode(code)) return NextResponse.json({ error: 'Code de session invalide.' }, { status: 400 })

  const admin = getAffinityAdmin()
  const notLive = NextResponse.json({ live: false, phase: null, playerCount: 0, answeredCount: 0, serverNow: new Date().toISOString() }, { headers: NO_STORE })

  const { data: sessionData } = await admin
    .from('sessions')
    .select(`${AFFINITY_SESSION_COLUMNS}, ${OTHER_GAME_FLAGS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()
  const session = sessionData as StatusSessionRow | null
  if (!session?.affinity_active || !session.affinity_phase || OTHER_GAME_FLAGS.some((flag) => session[flag] === true)) {
    return notLive
  }

  const { data: runtime } = await admin
    .from('affinity_runtime')
    .select('round_id, heartbeat_at')
    .eq('session_id', session.id)
    .maybeSingle()
  if (!runtime || !isHeartbeatFresh(runtime.heartbeat_at as string)) return notLive

  const { count: playerCount, error: playersError } = await admin
    .from('affinity_players')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', runtime.round_id as string)
  if (playersError) throw new Error(playersError.message)

  let answeredCount = 0
  const questions = Array.isArray(session.affinity_questions) ? (session.affinity_questions as AffinityQuestion[]) : []
  const current = questions[session.affinity_current_question]
  if (current && (session.affinity_phase === 'question' || session.affinity_phase === 'closed')) {
    answeredCount = await countQuestionAnswers(admin, runtime.round_id as string, current.id)
  }

  return NextResponse.json({ live: true, phase: session.affinity_phase, playerCount: playerCount ?? 0, answeredCount, serverNow: new Date().toISOString() }, { headers: NO_STORE })
}
