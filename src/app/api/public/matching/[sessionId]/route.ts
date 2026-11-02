// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching : état public de la partie pour le téléphone du joueur.

import { NextResponse } from 'next/server'
import { isUuid } from '@/lib/affinity/validation'
import {
  MATCHING_PUBLIC_COLUMNS,
  NO_STORE,
  getPublicAdmin,
  isPubliclyVisible,
  type SessionVisibilityRow,
} from '@/lib/public-api/server'

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session invalide.' }, { status: 400, headers: NO_STORE })

  const { data, error } = await getPublicAdmin()
    .from('sessions')
    .select(`is_active, quiz_active, quiz_lobby_visible, ${MATCHING_PUBLIC_COLUMNS}`)
    .eq('id', sessionId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })

  const row = data as (SessionVisibilityRow & Record<string, unknown>) | null
  if (!row || !isPubliclyVisible(row)) {
    return NextResponse.json({ error: 'Session introuvable.' }, { status: 404, headers: NO_STORE })
  }

  const state = Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith('affinity_')))
  return NextResponse.json(state, { headers: NO_STORE })
}
