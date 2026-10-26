// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Cron horaire d'AnimaVote : efface les parties abandonnées 23 h après le
// DERNIER signal de vie de l'animateur (une soirée longue avec des pauses
// n'est jamais effacée en cours). Ne touche QUE les données AnimaVote
// (scrutins, candidats, participants, bulletins). Le brouillon de l'éditeur
// et ses photos sont gardés (l'animateur les retrouve pour sa prochaine soirée).
// Configure in vercel.json: { "path": "/api/cron/purge-vote", "schedule": "45 * * * *" }

import { NextRequest, NextResponse } from 'next/server'
import { VOTE_PURGE_AFTER_MS } from '@/lib/vote/constants'
import { getVoteAdmin } from '@/lib/vote/server'

export async function GET(request: NextRequest) {
  // Même protection que les autres crons.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getVoteAdmin()
  const cutoff = new Date(Date.now() - VOTE_PURGE_AFTER_MS).toISOString()
  let sessionsReset = 0
  let participantsDeleted = 0
  let error: string | null = null

  try {
    // 1. Parties sans signal de vie depuis 23 h : tout est effacé, AnimaVote
    //    désactivé sur la session.
    const { data: stale, error: staleError } = await admin
      .from('vote_runtime')
      .select('session_id')
      .lt('heartbeat_at', cutoff)
    if (staleError) throw new Error(staleError.message)
    const sessionIds = (stale ?? []).map((row) => row.session_id as string)

    if (sessionIds.length > 0) {
      const { error: eventsError } = await admin.from('vote_events').delete().in('session_id', sessionIds)
      if (eventsError) throw new Error(eventsError.message)

      const { count, error: participantsError } = await admin
        .from('vote_participants')
        .delete({ count: 'exact' })
        .in('session_id', sessionIds)
      if (participantsError) throw new Error(participantsError.message)
      participantsDeleted += count ?? 0

      const { error: runtimeError } = await admin.from('vote_runtime').delete().in('session_id', sessionIds)
      if (runtimeError) throw new Error(runtimeError.message)

      const { data: reset, error: resetError } = await admin
        .from('sessions')
        .update({ vote_active: false })
        .in('id', sessionIds)
        .eq('vote_active', true)
        .select('id')
      if (resetError) throw new Error(resetError.message)
      sessionsReset = reset?.length ?? 0
    }

    // 2. Filet de sécurité : scrutins et participants d'une partie qui
    //    n'existe plus (relancée ou quittée sans nettoyage complet), vieux de
    //    plus de 23 h.
    const { data: live, error: liveError } = await admin.from('vote_runtime').select('game_id')
    if (liveError) throw new Error(liveError.message)
    const liveGames = (live ?? []).map((row) => row.game_id as string)
    const notLive = liveGames.length > 0 ? `(${liveGames.join(',')})` : null

    let orphanEvents = admin.from('vote_events').delete().lt('created_at', cutoff)
    if (notLive) orphanEvents = orphanEvents.not('game_id', 'in', notLive)
    const { error: orphanEventsError } = await orphanEvents
    if (orphanEventsError) throw new Error(orphanEventsError.message)

    let orphanParticipants = admin.from('vote_participants').delete({ count: 'exact' }).lt('joined_at', cutoff)
    if (notLive) orphanParticipants = orphanParticipants.not('game_id', 'in', notLive)
    const { count: orphanCount, error: orphanError } = await orphanParticipants
    if (orphanError) throw new Error(orphanError.message)
    participantsDeleted += orphanCount ?? 0
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    console.error('[Cron purge-vote]', error)
  }

  // Trace d'audit : une ligne par passage, comme les autres purges.
  const { error: logError } = await admin.from('purge_log').insert({
    kind: 'vote',
    files_deleted: 0,
    reason: `sessions=${sessionsReset} participants=${participantsDeleted}`,
    error,
  })
  if (logError) console.error('[Cron purge-vote] purge_log :', logError.message)

  return NextResponse.json(
    { success: !error, sessionsReset, participantsDeleted, logged: !logError, error },
    { status: error ? 500 : 200 },
  )
}
