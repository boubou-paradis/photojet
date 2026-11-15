// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Cron horaire d'À Demi-Mot : efface les parties abandonnées 23 h après le
// DERNIER signal de vie de la régie (une soirée longue avec des pauses n'est
// jamais effacée en cours). Ne touche QUE les données de partie À Demi-Mot
// (état, équipes, capitaines, buzz) et remet demimot_active à false. La
// bibliothèque d'énigmes de l'animateur est gardée.
// Configure in vercel.json: { "path": "/api/cron/purge-demimot", "schedule": "15 * * * *" }

import { NextRequest, NextResponse } from 'next/server'
import { DEMIMOT_PURGE_AFTER_MS } from '@/lib/demimot/constants'
import { getDemiMotAdmin } from '@/lib/demimot/server'

export async function GET(request: NextRequest) {
  // Même protection que les autres crons.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getDemiMotAdmin()
  const cutoff = new Date(Date.now() - DEMIMOT_PURGE_AFTER_MS).toISOString()
  let gamesDeleted = 0
  let flagsReset = 0
  let error: string | null = null

  try {
    // 1. Parties sans signal de vie depuis 23 h : demimot_exit efface la
    //    partie (buzz, équipes, état) et éteint le drapeau, sous verrou.
    const { data: stale, error: staleError } = await admin
      .from('demimot_runtime')
      .select('session_id')
      .lt('heartbeat_at', cutoff)
    if (staleError) throw new Error(staleError.message)
    for (const row of stale ?? []) {
      const { error: exitError } = await admin.rpc('demimot_exit', { p_session_id: row.session_id as string })
      if (exitError) throw new Error(exitError.message)
      gamesDeleted++
    }

    // 2. Filet de sécurité : drapeau resté allumé sans aucune partie
    //    (l'écran et /invite l'ignorent déjà, faute de signal de vie).
    const { data: flagged, error: flaggedError } = await admin.from('sessions').select('id').eq('demimot_active', true)
    if (flaggedError) throw new Error(flaggedError.message)
    const flaggedIds = (flagged ?? []).map((row) => row.id as string)
    if (flaggedIds.length > 0) {
      const { data: live, error: liveError } = await admin.from('demimot_runtime').select('session_id').in('session_id', flaggedIds)
      if (liveError) throw new Error(liveError.message)
      const withGame = new Set((live ?? []).map((row) => row.session_id as string))
      const orphans = flaggedIds.filter((id) => !withGame.has(id))
      if (orphans.length > 0) {
        const { data: reset, error: resetError } = await admin
          .from('sessions')
          .update({ demimot_active: false })
          .in('id', orphans)
          .eq('demimot_active', true)
          .select('id')
        if (resetError) throw new Error(resetError.message)
        flagsReset = reset?.length ?? 0
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    console.error('[Cron purge-demimot]', error)
  }

  // Trace d'audit : une ligne par passage, comme les autres purges.
  const { error: logError } = await admin.from('purge_log').insert({
    kind: 'demimot',
    files_deleted: 0,
    reason: `parties=${gamesDeleted} drapeaux=${flagsReset}`,
    error,
  })
  if (logError) console.error('[Cron purge-demimot] purge_log :', logError.message)

  return NextResponse.json(
    { success: !error, gamesDeleted, flagsReset, logged: !logError, error },
    { status: error ? 500 : 200 },
  )
}
