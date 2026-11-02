// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Tablette AnimaBooth : vérifie le code de verrouillage côté serveur.

import { NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { NO_STORE, getPublicAdmin } from '@/lib/public-api/server'

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()
  const body = (await request.json().catch(() => null)) as { pin?: unknown } | null

  const { data, error } = await getPublicAdmin()
    .from('sessions')
    .select('borne_lock_code')
    .eq('borne_qr_code', code)
    .eq('is_active', true)
    .eq('borne_enabled', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })
  if (!data) await recordCodeFailure(request, 'borne', code)
  if (!data) return NextResponse.json({ error: 'Borne non trouvée ou désactivée.' }, { status: 404, headers: NO_STORE })

  const unlocked = typeof body?.pin === 'string' && body.pin === data.borne_lock_code
  if (!unlocked) await recordCodeFailure(request, 'pin', `${code}:${String(body?.pin)}`)
  return NextResponse.json({ unlocked }, { headers: NO_STORE })
}
