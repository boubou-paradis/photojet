// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Cron horaire d'AnimaBingo : efface uniquement les parties SANS AUCUNE
// activité depuis plus de 24 h (dernier signal de la régie ET dernière
// action). Une partie de moins de 24 h n'est jamais touchée, même régie
// fermée. Les cartons papier ne sont jamais supprimés ici (ils partent avec
// la session, purge des comptes à 30 jours). Toute la règle est dans la
// fonction SQL bingo_purge_stale (atomique).
// Loto musical : les morceaux envoyés mais jamais enregistrés dans une
// playlist (et cités par aucune partie) sont effacés après 24 h.
// Configuré dans vercel.json : { "path": "/api/cron/purge-bingo", "schedule": "50 * * * *" }

import { NextRequest, NextResponse } from 'next/server'
import { getBingoAdmin } from '@/lib/bingo/server'
import { purgeOrphanMusic } from '@/lib/bingo/library'

export async function GET(request: NextRequest) {
  // Même protection que les autres crons.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getBingoAdmin()
  let games = 0
  let error: string | null = null
  const { data, error: rpcError } = await admin.rpc('bingo_purge_stale')
  if (rpcError) {
    error = rpcError.message
    console.error('[Cron purge-bingo]', error)
  } else {
    games = Number((data as { games?: number } | null)?.games ?? 0)
  }

  // Tombola : même règle (24 h sans aucune activité), fonction SQL à part.
  let tombolas = 0
  const { data: tData, error: tError } = await admin.rpc('bingo_tombola_purge_stale')
  if (tError) {
    console.error('[Cron purge-bingo] tombola :', tError.message)
    error = error ? `${error} ; tombola : ${tError.message}` : `tombola : ${tError.message}`
  } else {
    tombolas = Number((tData as { tombolas?: number } | null)?.tombolas ?? 0)
  }

  let files = 0
  try {
    files = await purgeOrphanMusic(admin, 24 * 3600_000)
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error('[Cron purge-bingo] morceaux :', m)
    error = error ? `${error} ; morceaux : ${m}` : `morceaux : ${m}`
  }

  // Trace d'audit : une ligne par passage, comme les autres purges.
  const { error: logError } = await admin.from('purge_log').insert({ kind: 'bingo', files_deleted: files, reason: `parties=${games} tombolas=${tombolas}`, error })
  if (logError) console.error('[Cron purge-bingo] purge_log :', logError.message)

  return NextResponse.json({ success: !error, games, tombolas, files, logged: !logError, error }, { status: error ? 500 : 200 })
}
