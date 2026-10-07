// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching : envoi ou modification d'une réponse. Toutes les vérifications
// (vote ouvert, chrono, bonne question, réponse valide, jeton) sont faites
// atomiquement par la fonction SQL affinity_submit_answer.

import { NextResponse } from 'next/server'
import { getAffinityAdmin } from '@/lib/affinity/server'
import { hashPlayerToken } from '@/lib/affinity/token'
import { parseAnswerRequest } from '@/lib/affinity/validation'

const REJECTIONS: Record<string, { status: number; error: string }> = {
  closed: { status: 409, error: 'Les votes sont fermés.' },
  wrong_question: { status: 409, error: 'Cette question n\'est plus en cours.' },
  invalid_answer: { status: 400, error: 'Réponse invalide.' },
  unknown_player: { status: 403, error: 'Joueur inconnu. Rejoins la partie à nouveau.' },
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const parsed = parseAnswerRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { sessionId, playerId, token, questionId, answerIndex } = parsed.value

  const { data, error } = await getAffinityAdmin().rpc('affinity_submit_answer', {
    p_session_id: sessionId,
    p_player_id: playerId,
    p_token_hash: hashPlayerToken(token),
    p_question_id: questionId,
    p_answer_index: answerIndex,
  })

  if (error) {
    console.error('[Matching] réponse :', error.message)
    return NextResponse.json({ error: 'Réponse non enregistrée, réessaie.' }, { status: 500 })
  }

  const result = data as { ok: boolean; reason?: string } | null
  if (!result?.ok) {
    const rejection = REJECTIONS[result?.reason ?? ''] ?? { status: 400, error: 'Réponse refusée.' }
    return NextResponse.json({ error: rejection.error, reason: result?.reason ?? null }, { status: rejection.status })
  }
  return NextResponse.json({ ok: true })
}
