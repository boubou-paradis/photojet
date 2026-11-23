// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Tableau de bord, onglet « Musique » (propriétaire seul) :
//   GET  : demandes regroupées + compteurs + état de l'interrupteur ;
//   POST : decide (Joué / Pas ce soir / Remettre à traiter), merge (Regrouper),
//          split (Séparer). Répond avec la liste à jour.
// Relu toutes les 20 s par le tableau de bord ; aucun temps réel.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSessionOwner } from '@/lib/affinity/server'
import { NO_STORE, getPublicAdmin } from '@/lib/public-api/server'
import { countMusicGroups, planMerge } from '@/lib/music/group'
import { MUSIC_UUID, MusicUnavailable, loadMusicGroups, readMusicEnabled } from '@/lib/music/server'

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE })
const KEY_MAX = 160
const isKey = (v: unknown): v is string => typeof v === 'string' && v.length >= 1 && v.length <= KEY_MAX

async function snapshot(admin: SupabaseClient, sessionId: string) {
  const enabled = await readMusicEnabled(admin, sessionId)
  if (enabled === null) return NextResponse.json({ available: false }, { headers: NO_STORE })
  const { groups } = await loadMusicGroups(admin, sessionId)
  return NextResponse.json(
    { available: true, enabled, groups, counts: countMusicGroups(groups) },
    { headers: NO_STORE },
  )
}

function handle(err: unknown) {
  if (err instanceof MusicUnavailable) return NextResponse.json({ available: false }, { headers: NO_STORE })
  return fail(503, 'busy')
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId') ?? ''
  if (!MUSIC_UUID.test(sessionId)) return fail(400, 'invalid')
  if (!(await requireSessionOwner(sessionId))) return fail(403, 'forbidden')
  try {
    return await snapshot(getPublicAdmin(), sessionId)
  } catch (err) {
    return handle(err)
  }
}

export async function POST(request: Request) {
  let body: { sessionId?: unknown; action?: unknown; key?: unknown; keys?: unknown; status?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail(400, 'invalid')
  }
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
  if (!MUSIC_UUID.test(sessionId)) return fail(400, 'invalid')
  if (!(await requireSessionOwner(sessionId))) return fail(403, 'forbidden')
  const admin = getPublicAdmin()

  try {
    if (body.action === 'decide') {
      if (!isKey(body.key) || !['played', 'skipped', 'pending'].includes(body.status as string)) return fail(400, 'invalid')
      const r = body.status === 'pending'
        ? await admin.from('music_request_decisions').delete().eq('session_id', sessionId).eq('group_key', body.key)
        : await admin.from('music_request_decisions').upsert(
            { session_id: sessionId, group_key: body.key, status: body.status, decided_at: new Date().toISOString() },
            { onConflict: 'session_id,group_key' },
          )
      if (r.error) throw new Error(r.error.message)
    } else if (body.action === 'merge') {
      const keys = Array.isArray(body.keys) ? body.keys.filter(isKey) : []
      if (keys.length < 2 || keys.length > 50) return fail(400, 'invalid')
      const { groups, aliases } = await loadMusicGroups(admin, sessionId)
      const plan = planMerge(groups, keys, aliases)
      if (!plan) return fail(409, 'stale')
      const a = await admin.from('music_request_aliases').upsert(
        plan.aliases.map((x) => ({ session_id: sessionId, from_key: x.from_key, to_key: x.to_key })),
        { onConflict: 'session_id,from_key' },
      )
      if (a.error) throw new Error(a.error.message)
      const d = await admin.from('music_request_decisions').delete().eq('session_id', sessionId).in('group_key', plan.dropDecisions)
      if (d.error) throw new Error(d.error.message)
    } else if (body.action === 'split') {
      if (!isKey(body.key)) return fail(400, 'invalid')
      const r = await admin.from('music_request_aliases').delete().eq('session_id', sessionId).eq('to_key', body.key)
      if (r.error) throw new Error(r.error.message)
    } else {
      return fail(400, 'invalid')
    }
    return await snapshot(admin, sessionId)
  } catch (err) {
    return handle(err)
  }
}
