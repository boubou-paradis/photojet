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
    const { sessionId, playerId, playerName } = await req.json()
    if (!sessionId || !playerId || !playerName) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = getAdmin()
    const { data, error } = await supabase
      .from('sessions')
      .select('quiz_participants')
      .eq('id', sessionId)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const participants = parseJsonArray<{ odientId: string; odientName: string; totalScore: number; correctAnswers: number }>(data?.quiz_participants)

    if (!participants.find(p => p.odientId === playerId)) {
      participants.push({ odientId: playerId, odientName: playerName, totalScore: 0, correctAnswers: 0 })
      await supabase.from('sessions').update({ quiz_participants: JSON.stringify(participants) }).eq('id', sessionId)
    }

    return NextResponse.json({ ok: true, participants })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
