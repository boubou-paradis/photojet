// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Demande d'impression depuis /invite ou /borne : le fichier est déjà envoyé,
// le serveur crée la photo et la demande, et décompte la limite. La modération
// et la limite sont relues ici, jamais reprises du navigateur.

import { NextResponse } from 'next/server'
import { isUuid } from '@/lib/affinity/validation'
import { NO_STORE, getPublicAdmin } from '@/lib/public-api/server'

const COUNT_ATTEMPTS = 5

interface PrintBody {
  sessionId?: unknown
  storagePath?: unknown
  guestName?: unknown
  source?: unknown
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PrintBody | null
  const { sessionId, storagePath, guestName, source } = body ?? {}

  const validPath = typeof storagePath === 'string'
    && storagePath.startsWith(`${String(sessionId)}/`)
    && !storagePath.includes('..')
  if (!isUuid(sessionId) || !validPath || (source !== 'invite' && source !== 'borne')) {
    return NextResponse.json({ error: 'Demande invalide.' }, { status: 400, headers: NO_STORE })
  }
  const path = storagePath as string
  const name = typeof guestName === 'string' && guestName.trim() ? guestName.trim().slice(0, 100) : null

  const admin = getPublicAdmin()
  const busy = () => NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })
  const refuse = async (code: 'print_disabled' | 'print_limit') => {
    await admin.storage.from('photos').remove([path])
    return NextResponse.json({ error: 'Impression impossible.', code }, { status: 409, headers: NO_STORE })
  }

  // Réserve une place : la mise à jour ne passe que si le compteur n'a pas bougé.
  let moderated = false
  let reserved = false
  let printCount = 0
  for (let attempt = 0; attempt < COUNT_ATTEMPTS && !reserved; attempt++) {
    const { data: session, error } = await admin
      .from('sessions')
      .select('is_active, print_enabled, print_limit, print_count, moderation_enabled')
      .eq('id', sessionId)
      .maybeSingle()
    if (error) return busy()
    if (!session?.is_active || !session.print_enabled) return refuse('print_disabled')
    if (session.print_limit !== null && session.print_count >= session.print_limit) return refuse('print_limit')

    moderated = session.moderation_enabled === true
    printCount = session.print_count + 1
    const { data: updated, error: updateError } = await admin
      .from('sessions')
      .update({ print_count: printCount })
      .eq('id', sessionId)
      .eq('print_count', session.print_count)
      .select('id')
    if (updateError) return busy()
    reserved = (updated?.length ?? 0) > 0
  }
  if (!reserved) return busy()

  const release = async () => {
    const { data } = await admin.from('sessions').select('print_count').eq('id', sessionId).maybeSingle()
    if (data) await admin.from('sessions').update({ print_count: Math.max(0, data.print_count - 1) }).eq('id', sessionId)
  }

  const { data: photo, error: photoError } = await admin
    .from('photos')
    .insert({
      session_id: sessionId,
      storage_path: path,
      status: moderated ? 'pending' : 'approved',
      uploader_name: name,
      approved_at: moderated ? null : new Date().toISOString(),
      source,
    })
    .select('id')
    .single()
  if (photoError || !photo) {
    await release()
    return busy()
  }

  const { error: requestError } = await admin.from('print_requests').insert({
    session_id: sessionId,
    photo_id: photo.id,
    guest_name: name,
    status: 'pending',
    printed_at: null,
  })
  if (requestError) {
    await release()
    return busy()
  }

  return NextResponse.json({ moderated, printCount }, { headers: NO_STORE })
}
