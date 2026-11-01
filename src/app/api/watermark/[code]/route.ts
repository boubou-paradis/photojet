// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { isTrialCode } from '@/lib/watermark/access'

// Revérification périodique de /live et de la borne : retire le filigrane d'un
// écran déjà ouvert quand le compte s'abonne.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const kind = request.nextUrl.searchParams.get('kind') === 'borne' ? 'borne' : 'session'

  const watermark = await isTrialCode(code, kind)
  return NextResponse.json({ watermark }, { headers: { 'Cache-Control': 'no-store' } })
}
