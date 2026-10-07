// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching : actions de l'animateur. Réservées au propriétaire de la session
// (cookies vérifiés côté serveur). Chaque changement de phase est conditionnel
// à la phase attendue : un double appui (souris ou télécommande) ne s'applique
// qu'une fois. Ne renvoie jamais de réponse nominative.

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeTopMatches } from '@/lib/affinity/score'
import {
  AFFINITY_RESET,
  AFFINITY_SESSION_COLUMNS,
  deleteSessionPlayers,
  getAffinityAdmin,
  loadQuestionAnswerIndexes,
  loadScoringPlayers,
  requireSessionOwner,
  type AffinityPlayerRow,
  type AffinityRuntimeRow,
  type AffinitySessionRow,
} from '@/lib/affinity/server'
import { buildReveal, computeFinalStats } from '@/lib/affinity/stats'
import type { AffinityPhase, AffinityQuestion } from '@/lib/affinity/types'
import { parseAdminRequest, validateQuestions } from '@/lib/affinity/validation'

class ActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

const WRONG_STEP = 'Action impossible à cette étape de la partie.'

function deadlineFor(question: AffinityQuestion): string | null {
  return question.timeLimit === null ? null : new Date(Date.now() + question.timeLimit * 1000).toISOString()
}

/** Change la phase seulement si elle est encore celle attendue. */
async function transition(
  admin: SupabaseClient,
  sessionId: string,
  from: readonly AffinityPhase[],
  patch: Record<string, unknown>,
  currentQuestion?: number,
): Promise<void> {
  let query = admin.from('sessions').update(patch).eq('id', sessionId).eq('affinity_active', true).in('affinity_phase', from)
  if (currentQuestion !== undefined) query = query.eq('affinity_current_question', currentQuestion)
  const { data, error } = await query.select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new ActionError(WRONG_STEP, 409)
}

async function loadState(admin: SupabaseClient, sessionId: string) {
  const [{ data: sessionData, error }, { data: runtimeData }] = await Promise.all([
    admin.from('sessions').select(AFFINITY_SESSION_COLUMNS).eq('id', sessionId).single(),
    admin.from('affinity_runtime').select('*').eq('session_id', sessionId).maybeSingle(),
  ])
  if (error || !sessionData) throw new ActionError('Session introuvable.', 404)
  const session = sessionData as AffinitySessionRow
  const runtime = runtimeData as AffinityRuntimeRow | null
  const questions = Array.isArray(session.affinity_questions) ? (session.affinity_questions as AffinityQuestion[]) : []
  return { session, runtime, questions }
}

function requireRuntime(runtime: AffinityRuntimeRow | null): AffinityRuntimeRow {
  if (!runtime) throw new ActionError('Aucune partie Matching lancée.', 409)
  return runtime
}

/** Lancer (ou relancer) : nouvelle partie, anciennes réponses effacées, autres jeux désactivés. */
async function launch(admin: SupabaseClient, sessionId: string) {
  const { session } = await loadState(admin, sessionId)
  const questions = validateQuestions(session.affinity_questions)
  if (!questions.ok) throw new ActionError(questions.error, 400)

  await deleteSessionPlayers(admin, sessionId)
  const roundId = randomUUID()
  const now = new Date().toISOString()
  const { error: runtimeError } = await admin.from('affinity_runtime').upsert({
    session_id: sessionId,
    round_id: roundId,
    launched_at: now,
    heartbeat_at: now,
    revealed_question_ids: [],
    finished_at: null,
  })
  if (runtimeError) throw new Error(runtimeError.message)

  const { error } = await admin
    .from('sessions')
    .update({
      // Désactiver les autres jeux, comme chaque jeu le fait à son lancement.
      mystery_photo_active: false,
      mystery_is_playing: false,
      lineup_active: false,
      wheel_active: false,
      quiz_active: false,
      quiz_lobby_visible: false,
      ...AFFINITY_RESET,
      affinity_active: true,
      affinity_phase: 'lobby',
      affinity_questions: questions.value,
    })
    .eq('id', sessionId)
  if (error) throw new Error(error.message)
}

/** Lobby → première question ouverte. */
async function start(admin: SupabaseClient, sessionId: string) {
  const { runtime, questions } = await loadState(admin, sessionId)
  requireRuntime(runtime)
  const first = questions[0]
  if (!first) throw new ActionError('Aucune question.', 400)
  await transition(admin, sessionId, ['lobby'], {
    affinity_phase: 'question',
    affinity_current_question: 0,
    affinity_deadline: deadlineFor(first),
    affinity_reveal: null,
  })
}

/** Fermer le vote (fin du chrono) sans révéler. */
async function close(admin: SupabaseClient, sessionId: string) {
  await transition(admin, sessionId, ['question'], { affinity_phase: 'closed' })
}

/** Fermer le vote si besoin, compter, puis révéler les pourcentages. */
async function reveal(admin: SupabaseClient, sessionId: string) {
  const { session, runtime, questions } = await loadState(admin, sessionId)
  const run = requireRuntime(runtime)
  const index = session.affinity_current_question
  const question = questions[index]
  if (!question) throw new ActionError('Question introuvable.', 400)

  // 1. Fermer : la fonction SQL refuse toute réponse dès que la phase change,
  //    et les réponses en cours sont terminées avant (verrou partagé).
  if (session.affinity_phase === 'question') {
    await transition(admin, sessionId, ['question'], { affinity_phase: 'closed' }, index)
  } else if (session.affinity_phase !== 'closed') {
    throw new ActionError(WRONG_STEP, 409)
  }

  // 2. Compter (agrégé), 3. révéler.
  const revealData = buildReveal(question, await loadQuestionAnswerIndexes(admin, run.round_id, question.id))
  await transition(admin, sessionId, ['closed'], { affinity_phase: 'revealed', affinity_reveal: revealData, affinity_deadline: null }, index)

  if (!run.revealed_question_ids.includes(question.id)) {
    const { error } = await admin
      .from('affinity_runtime')
      .update({ revealed_question_ids: [...run.revealed_question_ids, question.id] })
      .eq('session_id', sessionId)
    if (error) throw new Error(error.message)
  }
}

/** Révélée → question suivante ouverte. Rien après la dernière question. */
async function next(admin: SupabaseClient, sessionId: string) {
  const { session, questions } = await loadState(admin, sessionId)
  const index = session.affinity_current_question
  const following = questions[index + 1]
  if (!following) throw new ActionError('C\'était la dernière question. Cliquez sur Terminer.', 409)
  await transition(
    admin,
    sessionId,
    ['revealed'],
    { affinity_phase: 'question', affinity_current_question: index + 1, affinity_deadline: deadlineFor(following), affinity_reveal: null },
    index,
  )
}

/** Terminer : calcul serveur des Top 5 et des statistiques, une seule fois. */
async function finish(admin: SupabaseClient, sessionId: string) {
  const { session, runtime, questions } = await loadState(admin, sessionId)
  const run = requireRuntime(runtime)
  if (session.affinity_phase !== 'revealed') throw new ActionError(WRONG_STEP, 409)

  const players = await loadScoringPlayers(admin, run.round_id)
  const tops = computeTopMatches(players, run.revealed_question_ids)
  const stats = computeFinalStats(questions, run.revealed_question_ids, players)

  // Top 5 écrits avant le passage en « finished » : un téléphone qui réagit
  // au changement de phase trouve toujours son résultat.
  if (players.length > 0) {
    const { data: rows, error: readError } = await admin.from('affinity_players').select('*').eq('round_id', run.round_id)
    if (readError) throw new Error(readError.message)
    const updated = (rows as AffinityPlayerRow[]).map((row) => ({ ...row, top5: tops.get(row.id) ?? [] }))
    const { error } = await admin.from('affinity_players').upsert(updated)
    if (error) throw new Error(error.message)
  }

  await transition(admin, sessionId, ['revealed'], { affinity_phase: 'finished', affinity_final_stats: stats, affinity_deadline: null })

  const { error } = await admin.from('affinity_runtime').update({ finished_at: new Date().toISOString() }).eq('session_id', sessionId)
  if (error) throw new Error(error.message)
}

/** Quitter : réponses effacées, Matching désactivé, questions conservées. */
async function exit(admin: SupabaseClient, sessionId: string) {
  await deleteSessionPlayers(admin, sessionId)
  const { error: runtimeError } = await admin.from('affinity_runtime').delete().eq('session_id', sessionId)
  if (runtimeError) throw new Error(runtimeError.message)
  const { error } = await admin.from('sessions').update(AFFINITY_RESET).eq('id', sessionId)
  if (error) throw new Error(error.message)
}

/** Signal de vie : table hors realtime, ne notifie aucune page. */
async function heartbeat(admin: SupabaseClient, sessionId: string) {
  const { data, error } = await admin
    .from('affinity_runtime')
    .update({ heartbeat_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .select('session_id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new ActionError('Aucune partie Matching lancée.', 409)
}

const ACTIONS = { launch, start, close, reveal, next, finish, exit, heartbeat } as const

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const parsed = parseAdminRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { sessionId, action } = parsed.value

  if (!(await requireSessionOwner(sessionId))) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  try {
    await ACTIONS[action](getAffinityAdmin(), sessionId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ActionError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error(`[Matching] action ${action} :`, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Action impossible, réessayez.' }, { status: 500 })
  }
}
