import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { isTrialAccount } from '@/lib/watermark/access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  if (!code) {
    return NextResponse.json({ error: 'Code required' }, { status: 400 })
  }
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, code, name, album_enabled, album_password, created_at, user_id')
    .eq('code', code)
    .single()

  if (error?.code === 'PGRST116') await recordCodeFailure(request, 'session', code)
  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Le mot de passe ne quitte jamais le serveur : la vérification se fait dans /api/album/photos
  const { user_id: userId, album_password: albumPassword, ...album } = session
  const watermark = await isTrialAccount(supabase, userId)

  return NextResponse.json({ ...album, has_password: Boolean(albumPassword), watermark })
}
