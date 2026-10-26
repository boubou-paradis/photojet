// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaVote : statut public d'une session, pour /invite et /live.
// `live` = AnimaVote lancé, aucun autre jeu actif ET page animateur vivante
// (signal de vie de moins de 3 min, lu dans vote_runtime, table hors realtime).

import { NextResponse } from 'next/server'
import { OTHER_GAME_FLAGS, getVoteAdmin, isAnimatorAlive, type OtherGameFlags } from '@/lib/vote/server'
import { isSessionCode } from '@/lib/vote/validation'

type StatusSessionRow = { id: string; vote_active: boolean | null } & OtherGameFlags

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code')
  if (!isSessionCode(code)) return NextResponse.json({ error: 'Code de session invalide.' }, { status: 400 })

  const admin = getVoteAdmin()
  const notLive = () => NextResponse.json({ live: false, sessionId: null, serverNow: new Date().toISOString() }, { headers: NO_STORE })
  const busy = () => NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })

  const { data: sessionData, error: sessionError } = await admin
    .from('sessions')
    .select(`id, vote_active, ${OTHER_GAME_FLAGS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()
  if (sessionError) return busy()
  const session = sessionData as StatusSessionRow | null
  if (!session?.vote_active || OTHER_GAME_FLAGS.some((flag) => session[flag] === true)) return notLive()

  const { data: runtime, error: runtimeError } = await admin
    .from('vote_runtime')
    .select('heartbeat_at')
    .eq('session_id', session.id)
    .maybeSingle()
  if (runtimeError) return busy()
  if (!runtime || !isAnimatorAlive(runtime.heartbeat_at as string)) return notLive()

  return NextResponse.json({ live: true, sessionId: session.id, serverNow: new Date().toISOString() }, { headers: NO_STORE })
}
