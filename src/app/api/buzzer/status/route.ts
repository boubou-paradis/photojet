// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz : statut public d'une session, pour /invite et /live.
// `live` = AnimaBuzz lancé, aucun autre jeu actif ET page animateur vivante
// (signal de vie de moins de 3 min, lu dans buzzer_runtime, table hors
// realtime). Compteurs, et les 24 derniers pseudos (ou équipes) inscrits pour
// le mur du lobby : affichés de toute façon sur l'écran géant.

import { NextResponse } from 'next/server'
import { OTHER_GAME_FLAGS, getBuzzerAdmin, isAnimatorAlive, type OtherGameFlags } from '@/lib/buzzer/server'
import { isSessionCode } from '@/lib/buzzer/validation'

type StatusSessionRow = { id: string; buzzer_active: boolean | null } & OtherGameFlags

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code')
  if (!isSessionCode(code)) return NextResponse.json({ error: 'Code de session invalide.' }, { status: 400 })

  const admin = getBuzzerAdmin()
  const notLive = () =>
    NextResponse.json({ live: false, sessionId: null, phase: null, playerCount: 0, testedCount: 0, recent: [], serverNow: new Date().toISOString() }, { headers: NO_STORE })
  const busy = () => NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })

  const { data: sessionData, error: sessionError } = await admin
    .from('sessions')
    .select(`id, buzzer_active, ${OTHER_GAME_FLAGS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()
  if (sessionError) return busy()
  const session = sessionData as StatusSessionRow | null
  if (!session?.buzzer_active || OTHER_GAME_FLAGS.some((flag) => session[flag] === true)) return notLive()

  const { data: runtime, error: runtimeError } = await admin
    .from('buzzer_runtime')
    .select('game_id, phase, heartbeat_at')
    .eq('session_id', session.id)
    .maybeSingle()
  if (runtimeError) return busy()
  if (!runtime || !isAnimatorAlive(runtime.heartbeat_at as string)) return notLive()

  const [players, tested, latest] = await Promise.all([
    admin.from('buzzer_players').select('id', { count: 'exact', head: true }).eq('game_id', runtime.game_id as string).is('removed_at', null),
    admin.from('buzzer_players').select('id', { count: 'exact', head: true }).eq('game_id', runtime.game_id as string).is('removed_at', null).not('tested_at', 'is', null),
    admin.from('buzzer_players').select('nickname, team_label').eq('game_id', runtime.game_id as string).is('removed_at', null).order('joined_at', { ascending: false }).limit(24),
  ])
  if (players.error || tested.error || latest.error) return busy()
  // Mode équipe : une équipe n'apparaît qu'une fois.
  const recent = [...new Set((latest.data ?? []).map((p) => (p.nickname as string | null) ?? (p.team_label as string)))]

  return NextResponse.json(
    {
      live: true,
      sessionId: session.id,
      phase: runtime.phase,
      playerCount: players.count ?? 0,
      testedCount: tested.count ?? 0,
      recent,
      serverNow: new Date().toISOString(),
    },
    { headers: NO_STORE },
  )
}
