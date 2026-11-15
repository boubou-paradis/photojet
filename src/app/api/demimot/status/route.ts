// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot : statut public d'une session, pour /invite, /live et la page
// d'arrivée des capitaines. `live` = À Demi-Mot lancé, aucun autre jeu actif
// ET régie vivante (signal de vie de moins de 3 min, lu dans demimot_runtime,
// table hors realtime). Équipes : nom, couleur et « déjà prise », affichés
// de toute façon sur l'écran géant.

import { NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { OTHER_GAME_FLAGS, getDemiMotAdmin, isAnimatorAlive, type OtherGameFlags } from '@/lib/demimot/server'
import { isSessionCode } from '@/lib/demimot/validation'

type StatusSessionRow = { id: string; demimot_active: boolean | null } & OtherGameFlags

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('code')
  const code = raw ? raw.trim().toUpperCase() : null
  if (!isSessionCode(code)) return NextResponse.json({ error: 'Code de session invalide.' }, { status: 400 })
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()

  const admin = getDemiMotAdmin()
  const notLive = () => NextResponse.json({ live: false, sessionId: null, teams: [], serverNow: new Date().toISOString() }, { headers: NO_STORE })
  const busy = () => NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })

  const { data: sessionData, error: sessionError } = await admin
    .from('sessions')
    .select(`id, demimot_active, ${OTHER_GAME_FLAGS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()
  if (sessionError) return busy()
  const session = sessionData as StatusSessionRow | null
  if (!session) await recordCodeFailure(request, 'session', code)
  if (!session?.demimot_active || OTHER_GAME_FLAGS.some((flag) => session[flag] === true)) return notLive()

  const { data: runtime, error: runtimeError } = await admin
    .from('demimot_runtime')
    .select('game_id, heartbeat_at')
    .eq('session_id', session.id)
    .maybeSingle()
  if (runtimeError) return busy()
  if (!runtime || !isAnimatorAlive(runtime.heartbeat_at as string)) return notLive()

  const { data: teams, error: teamsError } = await admin
    .from('demimot_teams')
    .select('id, name, color, captain_token_hash')
    .eq('game_id', runtime.game_id as string)
    .order('position')
  if (teamsError) return busy()

  return NextResponse.json(
    {
      live: true,
      sessionId: session.id,
      teams: (teams ?? []).map((t) => ({ id: t.id as string, name: t.name as string, color: t.color as string, taken: t.captain_token_hash !== null })),
      serverNow: new Date().toISOString(),
    },
    { headers: NO_STORE },
  )
}
