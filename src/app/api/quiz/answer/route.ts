import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function parseJsonArray<T = unknown>(raw: unknown): T[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as T[]
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return [] } }
  return []
}

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

    const supabase = getAdmin()
    const { data, error } = await supabase
      .from('sessions')
      .select('quiz_answers, quiz_participants')
      .eq('id', sessionId)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update answers
    const answers = parseJsonArray<{ odientId: string; questionId: string; answerIndex: number; timestamp: number }>(data?.quiz_answers)
    const alreadyAnswered = answers.some(a => a.odientId === playerId && a.questionId === questionId)
    if (!alreadyAnswered) {
      answers.push({ odientId: playerId, questionId, answerIndex, timestamp: Date.now() })
    }

    // Update participant score
    const participants = parseJsonArray<{ odientId: string; odientName: string; totalScore: number; correctAnswers: number }>(data?.quiz_participants)
    const idx = participants.findIndex(p => p.odientId === playerId)
    if (idx >= 0) {
      participants[idx].totalScore += pointsEarned || 0
      if (isCorrect) participants[idx].correctAnswers += 1
    } else {
      participants.push({ odientId: playerId, odientName: playerName || 'Joueur', totalScore: pointsEarned || 0, correctAnswers: isCorrect ? 1 : 0 })
    }

    await supabase.from('sessions').update({
      quiz_answers: JSON.stringify(answers),
      quiz_participants: JSON.stringify(participants),
    }).eq('id', sessionId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
