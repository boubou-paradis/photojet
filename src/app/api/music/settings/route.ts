// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Paramètres : interrupteur « Demandes de musique » d'une session (propriétaire seul).
// Table à part : jamais de colonne sur sessions (l'enregistrement global des
// Paramètres échouerait si la migration manquait).

import { NextResponse } from 'next/server'
import { requireSessionOwner } from '@/lib/affinity/server'
import { NO_STORE, getPublicAdmin } from '@/lib/public-api/server'
import { MUSIC_UUID, isMissingTable, readMusicEnabled } from '@/lib/music/server'

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE })

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId') ?? ''
  if (!MUSIC_UUID.test(sessionId)) return fail(400, 'invalid')
  if (!(await requireSessionOwner(sessionId))) return fail(403, 'forbidden')
  try {
    const enabled = await readMusicEnabled(getPublicAdmin(), sessionId)
    return NextResponse.json({ available: enabled !== null, enabled: enabled === true }, { headers: NO_STORE })
  } catch {
    return fail(503, 'busy')
  }
}

export async function PUT(request: Request) {
  let body: { sessionId?: unknown; enabled?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail(400, 'invalid')
  }
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
  if (!MUSIC_UUID.test(sessionId) || typeof body.enabled !== 'boolean') return fail(400, 'invalid')
  if (!(await requireSessionOwner(sessionId))) return fail(403, 'forbidden')

  const { error } = await getPublicAdmin()
    .from('music_request_settings')
    .upsert({ session_id: sessionId, enabled: body.enabled, updated_at: new Date().toISOString() }, { onConflict: 'session_id' })
  if (isMissingTable(error)) return fail(409, 'unavailable')
  if (error) return fail(503, 'busy')
  return NextResponse.json({ available: true, enabled: body.enabled }, { headers: NO_STORE })
}
