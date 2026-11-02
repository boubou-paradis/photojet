// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Quiz : retrouve une session à partir du code saisi ou scanné par le joueur.
// `open` = lobby ouvert ou partie en cours.

import { NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { NO_STORE, getPublicAdmin, isPubliclyVisible, type SessionVisibilityRow } from '@/lib/public-api/server'

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()

  const { data, error } = await getPublicAdmin()
    .from('sessions')
    .select('id, is_active, quiz_active, quiz_lobby_visible')
    .eq('code', code)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })

  const session = data as (SessionVisibilityRow & { id: string }) | null
  if (!session) await recordCodeFailure(request, 'session', code)
  if (!session || !isPubliclyVisible(session)) {
    return NextResponse.json({ error: 'Session introuvable.' }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json(
    { sessionId: session.id, open: session.quiz_lobby_visible === true || session.quiz_active === true },
    { headers: NO_STORE },
  )
}
