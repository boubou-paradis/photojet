// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Tablette AnimaBooth : signal de présence, lu par l'écran d'administration.

import { NextResponse } from 'next/server'
import { isCodeLookupBlocked, recordCodeFailure, tooManyCodeAttempts } from '@/lib/public-api/code-guard'
import { NO_STORE, getPublicAdmin } from '@/lib/public-api/server'
import type { DeviceType } from '@/types/database'

const DEVICE_TYPES: DeviceType[] = ['ipad', 'android_tablet', 'other']

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (await isCodeLookupBlocked(request)) return tooManyCodeAttempts()
  const body = (await request.json().catch(() => null)) as { deviceId?: unknown; deviceType?: unknown; online?: unknown } | null
  const deviceId = body?.deviceId
  const deviceType = DEVICE_TYPES.find((type) => type === body?.deviceType)

  if (typeof deviceId !== 'string' || !deviceId || deviceId.length > 255 || !deviceType) {
    return NextResponse.json({ error: 'Demande invalide.' }, { status: 400, headers: NO_STORE })
  }

  const admin = getPublicAdmin()
  const { data: session, error } = await admin
    .from('sessions')
    .select('id')
    .eq('borne_qr_code', code)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })
  if (!session) await recordCodeFailure(request, 'borne', code)
  if (!session) return NextResponse.json({ error: 'Borne non trouvée.' }, { status: 404, headers: NO_STORE })

  const { error: writeError } = await admin.from('borne_connections').upsert(
    {
      session_id: session.id,
      device_id: deviceId,
      device_type: deviceType,
      is_online: body?.online !== false,
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'session_id,device_id' },
  )
  if (writeError) return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
