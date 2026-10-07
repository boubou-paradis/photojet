// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Cron horaire de Matching : rend vrai le texte « Tes réponses sont effacées
// au plus tard 24 h après la partie ». Purge à 23 h, un passage par heure.
// Ne touche QUE les données Matching (affinity_*). Le cron cleanup-expired
// n'est pas concerné.
// Configure in vercel.json: { "path": "/api/cron/purge-matching", "schedule": "0 * * * *" }

import { NextRequest, NextResponse } from 'next/server'
import { AFFINITY_PURGE_AFTER_MS } from '@/lib/affinity/constants'
import { AFFINITY_RESET, getAffinityAdmin } from '@/lib/affinity/server'

export async function GET(request: NextRequest) {
  // Même protection que les autres crons.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAffinityAdmin()
  const cutoff = new Date(Date.now() - AFFINITY_PURGE_AFTER_MS).toISOString()
  let sessionsReset = 0
  let playersDeleted = 0
  let error: string | null = null

  try {
    // 1. Parties lancées il y a plus de 23 h : joueurs et réponses effacés,
    //    état serveur supprimé, Matching désactivé sur la session.
    const { data: stale, error: staleError } = await admin
      .from('affinity_runtime')
      .select('session_id')
      .lt('launched_at', cutoff)
    if (staleError) throw new Error(staleError.message)
    const sessionIds = (stale ?? []).map((row) => row.session_id as string)

    if (sessionIds.length > 0) {
      const { count, error: playersError } = await admin
        .from('affinity_players')
        .delete({ count: 'exact' })
        .in('session_id', sessionIds)
      if (playersError) throw new Error(playersError.message)
      playersDeleted += count ?? 0

      const { error: runtimeError } = await admin.from('affinity_runtime').delete().in('session_id', sessionIds)
      if (runtimeError) throw new Error(runtimeError.message)

      // N'écrit que sur les sessions où Matching est encore marqué actif.
      const { data: reset, error: resetError } = await admin
        .from('sessions')
        .update(AFFINITY_RESET)
        .in('id', sessionIds)
        .or('affinity_active.eq.true,affinity_phase.not.is.null')
        .select('id')
      if (resetError) throw new Error(resetError.message)
      sessionsReset = reset?.length ?? 0
    }

    // 2. Filet de sécurité : tout joueur inscrit il y a plus de 23 h.
    const { count, error: orphanError } = await admin
      .from('affinity_players')
      .delete({ count: 'exact' })
      .lt('joined_at', cutoff)
    if (orphanError) throw new Error(orphanError.message)
    playersDeleted += count ?? 0
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    console.error('[Cron purge-matching]', error)
  }

  // Trace d'audit : une ligne par passage, comme cleanup-expired.
  const { error: logError } = await admin.from('purge_log').insert({
    kind: 'matching',
    files_deleted: 0,
    reason: `sessions=${sessionsReset} joueurs=${playersDeleted}`,
    error,
  })
  if (logError) console.error('[Cron purge-matching] purge_log :', logError.message)

  return NextResponse.json(
    { success: !error, sessionsReset, playersDeleted, logged: !logError, error },
    { status: error ? 500 : 200 },
  )
}
