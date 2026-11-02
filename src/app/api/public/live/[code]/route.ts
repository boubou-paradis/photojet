// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Écran /live : session, photos et messages approuvés en une seule lecture,
// relue toutes les 5 secondes et à chaque signal temps réel. Le propriétaire
// connecté garde l'accès à sa session désactivée, comme avec la lecture directe.

import { NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { LIVE_MESSAGE_COLUMNS, LIVE_PHOTO_COLUMNS, LIVE_SESSION_COLUMNS } from '@/lib/public-api/columns'
import { NO_STORE, getPublicAdmin, isPubliclyVisible, pickColumns, type SessionVisibilityRow } from '@/lib/public-api/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function isOwner(userId: unknown): Promise<boolean> {
  if (typeof userId !== 'string') return false
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.id === userId
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()
  const admin = getPublicAdmin()
  const busy = NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })

  const { data, error } = await admin
    .from('sessions')
    .select(`is_active, user_id, ${LIVE_SESSION_COLUMNS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()
  if (error) return busy

  const row = data as (SessionVisibilityRow & Record<string, unknown>) | null
  if (!row) await recordCodeFailure(request, 'session', code)
  if (!row || !(isPubliclyVisible(row) || (await isOwner(row.user_id)))) {
    return NextResponse.json({ error: 'Session introuvable.' }, { status: 404, headers: NO_STORE })
  }

  const [photos, messages] = await Promise.all([
    admin
      .from('photos')
      .select(LIVE_PHOTO_COLUMNS.join(', '))
      .eq('session_id', row.id as string)
      .eq('status', 'approved')
      .order('approved_at', { ascending: true }),
    admin
      .from('messages')
      .select(LIVE_MESSAGE_COLUMNS.join(', '))
      .eq('session_id', row.id as string)
      .eq('status', 'approved')
      .order('created_at', { ascending: true }),
  ])
  if (photos.error || messages.error) return busy

  // Les questions et leurs réponses ne sortent que pendant une partie.
  const session = pickColumns(row, LIVE_SESSION_COLUMNS)
  if (row.quiz_active !== true && row.quiz_lobby_visible !== true) session.quiz_questions = null

  return NextResponse.json({ session, photos: photos.data, messages: messages.data }, { headers: NO_STORE })
}
