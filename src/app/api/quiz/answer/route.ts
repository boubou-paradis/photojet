import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { sessionId, playerId, playerName, questionId, answerIndex, pointsEarned, isCorrect } = await req.json()
    if (!sessionId || !playerId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data, error } = await getAdmin().rpc('submit_quiz_answer', {
      p_session_id: sessionId,
      p_player_id: playerId,
      p_player_name: playerName || 'Joueur',
      p_question_id: questionId,
      p_answer_index: answerIndex ?? 0,
      p_points: pointsEarned ?? 0,
      p_is_correct: !!isCorrect,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
