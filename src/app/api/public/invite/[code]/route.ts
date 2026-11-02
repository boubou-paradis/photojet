// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// /invite : réglages publics de la session et jeux en cours pour la redirection.
// `session` vaut null si la session n'est pas active : la page affiche alors
// l'état donné par /api/invite/state.

import { NextResponse } from 'next/server'
import { INVITE_SESSION_COLUMNS } from '@/lib/public-api/columns'
import { NO_STORE, getPublicAdmin, isPubliclyVisible, pickColumns, type SessionVisibilityRow } from '@/lib/public-api/server'

const FLAGS = 'is_active, quiz_active, quiz_lobby_visible, affinity_active, buzzer_active, vote_active'

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const { data, error } = await getPublicAdmin()
    .from('sessions')
    .select(`${FLAGS}, ${INVITE_SESSION_COLUMNS.join(', ')}`)
    .eq('code', code)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503, headers: NO_STORE })

  const row = data as (SessionVisibilityRow & Record<string, unknown>) | null
  if (!row || !isPubliclyVisible(row)) {
    return NextResponse.json({ error: 'Session introuvable.' }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json(
    {
      session: row.is_active === true ? pickColumns(row, INVITE_SESSION_COLUMNS) : null,
      quizLobby: row.quiz_lobby_visible === true,
      affinityActive: row.affinity_active === true,
      buzzerActive: row.buzzer_active === true,
      voteActive: row.vote_active === true,
    },
    { headers: NO_STORE },
  )
}
