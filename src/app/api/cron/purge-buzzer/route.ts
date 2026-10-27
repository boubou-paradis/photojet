// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Cron horaire d'AnimaBuzz : efface les parties abandonnées 23 h après le
// DERNIER signal de vie de l'animateur (une soirée longue avec des pauses
// n'est jamais effacée en cours). Ne touche QUE les données AnimaBuzz
// (buzzer_*) et ses médias (photos/buzzer-media/). Les crons cleanup-expired
// et purge-matching ne sont pas concernés.
// Configure in vercel.json: { "path": "/api/cron/purge-buzzer", "schedule": "30 * * * *" }

import { NextRequest, NextResponse } from 'next/server'
import { BUZZER_DATA_TTL_MS, BUZZER_PURGE_AFTER_MS } from '@/lib/buzzer/constants'
import { BUZZER_MEDIA_BUCKET } from '@/lib/buzzer/prep'
import { listStoredMedia, loadReferencedMedia, selectOrphanMedia } from '@/lib/buzzer/prep-server'
import { getBuzzerAdmin } from '@/lib/buzzer/server'

export async function GET(request: NextRequest) {
  // Même protection que les autres crons.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getBuzzerAdmin()
  const cutoff = new Date(Date.now() - BUZZER_PURGE_AFTER_MS).toISOString()
  let sessionsReset = 0
  let playersDeleted = 0
  let prepDeleted = 0
  let scoresDeleted = 0
  let filesDeleted = 0
  let error: string | null = null

  try {
    // 1. Parties sans signal de vie depuis 23 h : joueurs (et leurs buzz),
    //    manches et état effacés, AnimaBuzz désactivé sur la session.
    const { data: stale, error: staleError } = await admin
      .from('buzzer_runtime')
      .select('session_id')
      .lt('heartbeat_at', cutoff)
    if (staleError) throw new Error(staleError.message)
    const sessionIds = (stale ?? []).map((row) => row.session_id as string)

    if (sessionIds.length > 0) {
      const { count, error: playersError } = await admin
        .from('buzzer_players')
        .delete({ count: 'exact' })
        .in('session_id', sessionIds)
      if (playersError) throw new Error(playersError.message)
      playersDeleted += count ?? 0

      const { error: roundsError } = await admin.from('buzzer_rounds').delete().in('session_id', sessionIds)
      if (roundsError) throw new Error(roundsError.message)

      const { error: runtimeError } = await admin.from('buzzer_runtime').delete().in('session_id', sessionIds)
      if (runtimeError) throw new Error(runtimeError.message)

      const { data: reset, error: resetError } = await admin
        .from('sessions')
        .update({ buzzer_active: false })
        .in('id', sessionIds)
        .eq('buzzer_active', true)
        .select('id')
      if (resetError) throw new Error(resetError.message)
      sessionsReset = reset?.length ?? 0
    }

    // 2. Filet de sécurité : joueurs et manches d'une partie qui n'existe plus
    //    (relancée ou quittée sans nettoyage complet), vieux de plus de 23 h.
    const { data: live, error: liveError } = await admin.from('buzzer_runtime').select('game_id')
    if (liveError) throw new Error(liveError.message)
    const liveGames = (live ?? []).map((row) => row.game_id as string)
    const notLive = liveGames.length > 0 ? `(${liveGames.join(',')})` : null

    let orphanPlayers = admin.from('buzzer_players').delete({ count: 'exact' }).lt('joined_at', cutoff)
    if (notLive) orphanPlayers = orphanPlayers.not('game_id', 'in', notLive)
    const { count: orphanCount, error: orphanError } = await orphanPlayers
    if (orphanError) throw new Error(orphanError.message)
    playersDeleted += orphanCount ?? 0

    let orphanRounds = admin.from('buzzer_rounds').delete().lt('started_at', cutoff)
    if (notLive) orphanRounds = orphanRounds.not('game_id', 'in', notLive)
    const { error: orphanRoundsError } = await orphanRounds
    if (orphanRoundsError) throw new Error(orphanRoundsError.message)

    // 3. Manches préparées d'une partie qui n'existe plus (relancée, quittée
    //    ou purgée ci-dessus) : déjà ignorées par la base, effacées ici.
    let orphanPrep = admin.from('buzzer_prep_runtime').delete({ count: 'exact' }).lt('started_at', cutoff)
    if (notLive) orphanPrep = orphanPrep.not('game_id', 'in', notLive)
    const { count: prepCount, error: prepError } = await orphanPrep
    if (prepError) throw new Error(prepError.message)
    prepDeleted = prepCount ?? 0

    // 3 bis. Points d'une partie qui n'existe plus (vieux de plus de 23 h).
    let orphanScores = admin.from('buzzer_score_events').delete({ count: 'exact' }).lt('created_at', cutoff)
    if (notLive) orphanScores = orphanScores.not('game_id', 'in', notLive)
    const { count: scoresCount, error: scoresError } = await orphanScores
    if (scoresError) throw new Error(scoresError.message)
    scoresDeleted = scoresCount ?? 0

    let orphanScoreState = admin.from('buzzer_score_state').delete().lt('updated_at', cutoff)
    if (notLive) orphanScoreState = orphanScoreState.not('game_id', 'in', notLive)
    const { error: scoreStateError } = await orphanScoreState
    if (scoreStateError) throw new Error(scoreStateError.message)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    console.error('[Cron purge-buzzer]', error)
  }

  // 4. Médias des manches préparées (photos/buzzer-media/) cités nulle part :
  //    ni liste en préparation, ni bibliothèque, ni partie en cours, et
  //    envoyés il y a plus de 24 h. Étape séparée : une erreur ici n'empêche
  //    pas la purge des parties, et inversement aucun fichier n'est effacé si
  //    la lecture des références échoue.
  try {
    const used = await loadReferencedMedia(admin)
    const orphans = selectOrphanMedia(await listStoredMedia(admin), used, Date.now(), BUZZER_DATA_TTL_MS)
    for (let i = 0; i < orphans.length; i += 100) {
      const { data: removed, error: removeError } = await admin.storage.from(BUZZER_MEDIA_BUCKET).remove(orphans.slice(i, i + 100))
      if (removeError) throw new Error(removeError.message)
      filesDeleted += removed?.length ?? 0
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    error = error ? `${error} | médias : ${message}` : `médias : ${message}`
    console.error('[Cron purge-buzzer] médias', message)
  }

  // Trace d'audit : une ligne par passage, comme les autres purges.
  const { error: logError } = await admin.from('purge_log').insert({
    kind: 'buzzer',
    files_deleted: filesDeleted,
    reason: `sessions=${sessionsReset} joueurs=${playersDeleted} manches=${prepDeleted} points=${scoresDeleted} medias=${filesDeleted}`,
    error,
  })
  if (logError) console.error('[Cron purge-buzzer] purge_log :', logError.message)

  return NextResponse.json(
    { success: !error, sessionsReset, playersDeleted, prepDeleted, scoresDeleted, filesDeleted, logged: !logError, error },
    { status: error ? 500 : 200 },
  )
}
