// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching : état du joueur, pour reprendre après un rechargement ou une
// coupure réseau. Ne renvoie QUE les données de ce joueur : sa réponse en
// cours et, une fois la partie terminée, son Top 5 (déjà filtré par le
// consentement). Jamais les réponses des autres. `nobodyVisible` (fin de
// partie) dit seulement si aucun autre joueur n'a accepté d'apparaître.
// POST (jeton dans le corps, pas dans l'URL, pour ne pas finir dans les logs).

import { NextResponse } from 'next/server'
import { AFFINITY_DATA_TTL_MS } from '@/lib/affinity/constants'
import { AFFINITY_SESSION_COLUMNS, getAffinityAdmin, type AffinitySessionRow } from '@/lib/affinity/server'
import { hashPlayerToken } from '@/lib/affinity/token'
import type { AffinityMatch, AffinityQuestion } from '@/lib/affinity/types'
import { parsePlayerAuth } from '@/lib/affinity/validation'

const GONE = 'Cette partie est terminée.'

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

  const admin = getAffinityAdmin()

  const { data: player } = await admin
    .from('affinity_players')
    .select('round_id, nickname, table_label, consent, top5')
    .eq('id', playerId)
    .eq('session_id', sessionId)
    .eq('token_hash', hashPlayerToken(token))
    .maybeSingle()
  if (!player) return NextResponse.json({ error: 'Joueur inconnu. Rejoins la partie à nouveau.' }, { status: 403 })

  const { data: runtime } = await admin
    .from('affinity_runtime')
    .select('round_id, launched_at')
    .eq('session_id', sessionId)
    .maybeSingle()
  // Partie remplacée par une nouvelle, ou données de plus de 24 h (même si
  // le cron horaire ne les a pas encore effacées) : rien n'est renvoyé.
  if (
    !runtime ||
    runtime.round_id !== player.round_id ||
    Date.now() - Date.parse(runtime.launched_at as string) > AFFINITY_DATA_TTL_MS
  ) {
    return NextResponse.json({ error: GONE }, { status: 410 })
  }

  const { data: sessionData } = await admin.from('sessions').select(AFFINITY_SESSION_COLUMNS).eq('id', sessionId).maybeSingle()
  const session = sessionData as AffinitySessionRow | null
  if (!session?.affinity_active || !session.affinity_phase) return NextResponse.json({ error: GONE }, { status: 410 })

  const questions = Array.isArray(session.affinity_questions) ? (session.affinity_questions as AffinityQuestion[]) : []
  const current = questions[session.affinity_current_question]
  const inQuestion = session.affinity_phase !== 'lobby' && session.affinity_phase !== 'finished' && current

  let myAnswerIndex: number | null = null
  if (inQuestion) {
    const { data: answer } = await admin
      .from('affinity_answers')
      .select('answer_index')
      .eq('player_id', playerId)
      .eq('question_id', current.id)
      .maybeSingle()
    myAnswerIndex = (answer?.answer_index as number | undefined) ?? null
  }

  let nobodyVisible = false
  if (session.affinity_phase === 'finished') {
    const { count } = await admin
      .from('affinity_players')
      .select('id', { count: 'exact', head: true })
      .eq('round_id', player.round_id as string)
      .eq('consent', true)
      .neq('id', playerId)
    nobodyVisible = (count ?? 0) === 0
  }

  return NextResponse.json(
    {
      nickname: player.nickname as string,
      table: (player.table_label as string | null) ?? null,
      consent: player.consent as boolean,
      phase: session.affinity_phase,
      currentQuestionId: inQuestion ? current.id : null,
      myAnswerIndex,
      top5: session.affinity_phase === 'finished' ? ((player.top5 as AffinityMatch[] | null) ?? []) : null,
      nobodyVisible,
      serverNow: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
