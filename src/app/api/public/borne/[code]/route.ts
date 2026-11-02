// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Tablette AnimaBooth : réglages publics, retrouvés par le code de borne.
// Le code de verrouillage n'est jamais envoyé : voir la route unlock.

import { NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { BORNE_SESSION_COLUMNS } from '@/lib/public-api/columns'
import { NO_STORE, getPublicAdmin } from '@/lib/public-api/server'

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()

  const { data, error } = await getPublicAdmin()
    .from('sessions')
    .select(BORNE_SESSION_COLUMNS.join(', '))
    .eq('borne_qr_code', code)
    .eq('is_active', true)
    .eq('borne_enabled', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })
  if (!data) await recordCodeFailure(request, 'borne', code)
  if (!data) return NextResponse.json({ error: 'Borne non trouvée ou désactivée.' }, { status: 404, headers: NO_STORE })

  return NextResponse.json(data, { headers: NO_STORE })
}
