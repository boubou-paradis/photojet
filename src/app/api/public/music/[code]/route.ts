// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Téléphone invité : envoi d'une demande de musique (Titre + Artiste).
// Seule porte d'écriture : la table est fermée au public. Aucune limite de
// nombre (choix produit), seulement les longueurs. Aucune donnée sur l'invité.

import { NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { NO_STORE, getPublicAdmin } from '@/lib/public-api/server'
import { parseMusicInput } from '@/lib/music/normalize'
import { isMissingTable, readMusicEnabled } from '@/lib/music/server'

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE })

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()

  let body: { title?: unknown; artist?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail(400, 'invalid')
  }
  const input = parseMusicInput(body?.title, body?.artist)
  if (!input.ok) return fail(400, input.error)

  const admin = getPublicAdmin()
  const { data: session, error } = await admin.from('sessions').select('id, is_active').eq('code', code).maybeSingle()
  if (error) return fail(503, 'busy')
  if (!session) {
    await recordCodeFailure(request, 'session', code)
    return fail(404, 'not_found')
  }
  if (session.is_active !== true) return fail(404, 'not_found')

  let enabled: boolean | null
  try {
    enabled = await readMusicEnabled(admin, session.id as string)
  } catch {
    return fail(503, 'busy')
  }
  if (!enabled) return fail(403, 'disabled')

  const insert = await admin.from('music_requests').insert({
    session_id: session.id,
    title: input.title,
    artist: input.artist,
    norm_key: input.key,
  })
  if (isMissingTable(insert.error)) return fail(403, 'disabled')
  if (insert.error) return fail(503, 'busy')

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
