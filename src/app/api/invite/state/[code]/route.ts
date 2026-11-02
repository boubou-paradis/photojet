// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { createClient } from '@supabase/supabase-js'

type InviteState = 'ended_album' | 'ended_no_album' | 'inactive' | 'not_found'

function reply(state: InviteState, status = 200) {
  return NextResponse.json({ state }, { status, headers: { 'Cache-Control': 'no-store' } })
}

// /invite appelle cette route quand il ne peut pas lire la session : un invité
// n'a pas accès à une session inactive. Elle ne renvoie que l'état, rien de la
// session. Une session active ou une erreur donne « introuvable ».
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: session, error } = await admin
    .from('sessions')
    .select('id, is_active, album_enabled')
    .eq('code', code)
    .maybeSingle()

  if (error) {
    console.error('[Invite] Lecture de la session impossible:', error.message)
    return reply('not_found', 500)
  }
  if (!session) await recordCodeFailure(request, 'session', code)
  if (!session || session.is_active) return reply('not_found')

  // Mêmes photos que l'album : les approuvées seulement.
  const { count, error: photosError } = await admin
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', session.id)
    .eq('status', 'approved')

  if (photosError) {
    console.error('[Invite] Lecture des photos impossible:', photosError.message)
    return reply('not_found', 500)
  }

  if (!count) return reply('inactive')
  return reply(session.album_enabled === false ? 'ended_no_album' : 'ended_album')
}
