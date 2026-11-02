// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Album : photos approuvées d'une session. Le mot de passe éventuel est vérifié
// ici et ne quitte jamais le serveur. Un album reste consultable après la
// désactivation de la session. Compte d'essai : pas de chemin vers l'original,
// la page passe par l'image filigranée.

import { NextRequest, NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { NO_STORE, getPublicAdmin } from '@/lib/public-api/server'
import { isTrialAccount } from '@/lib/watermark/access'

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()
  const body = (await request.json().catch(() => ({}))) as { password?: unknown }
  const admin = getPublicAdmin()
  const busy = NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })

  const { data: session, error } = await admin
    .from('sessions')
    .select('id, user_id, album_enabled, album_password')
    .eq('code', code)
    .maybeSingle()
  if (error) return busy
  if (!session) await recordCodeFailure(request, 'session', code)
  if (!session) return NextResponse.json({ error: 'Album introuvable.' }, { status: 404, headers: NO_STORE })
  if (session.album_enabled === false) {
    return NextResponse.json({ error: 'Album désactivé.' }, { status: 403, headers: NO_STORE })
  }
  if (session.album_password && body.password !== session.album_password) {
    return NextResponse.json({ error: 'Mot de passe incorrect.', code: 'wrong_password' }, { status: 403, headers: NO_STORE })
  }

  const { data: photos, error: photosError } = await admin
    .from('photos')
    .select('id, storage_path')
    .eq('session_id', session.id)
    .eq('status', 'approved')
    .order('uploaded_at', { ascending: false })
  if (photosError) return busy

  const watermark = await isTrialAccount(admin, session.user_id)
  return NextResponse.json(
    { photos: (photos ?? []).map((photo) => (watermark ? { id: photo.id, storage_path: null } : photo)) },
    { headers: NO_STORE },
  )
}
