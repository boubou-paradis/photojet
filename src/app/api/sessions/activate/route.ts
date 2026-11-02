// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ACTIVATION_DENIED_CODE, ACTIVATION_DENIED_MESSAGE } from '@/lib/sessions/activation'
import { activateUserSession, mayActivateSession } from '@/lib/sessions/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Active ou désactive une session du compte connecté. L'utilisateur vient du
// cookie, jamais du corps de la requête.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const sessionId = body?.sessionId
  const active = body?.active
  const confirmedIds = body?.confirmedIds

  if (
    typeof sessionId !== 'string' || !UUID.test(sessionId) || typeof active !== 'boolean' ||
    (confirmedIds !== undefined && !(Array.isArray(confirmedIds) && confirmedIds.every((id) => typeof id === 'string' && UUID.test(id))))
  ) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  try {
    if (!active) {
      const { data, error } = await admin
        .from('sessions')
        .update({ is_active: false })
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
      return NextResponse.json({ status: 'deactivated' })
    }

    if (!(await mayActivateSession(admin, user.id))) {
      return NextResponse.json({ error: ACTIVATION_DENIED_MESSAGE, code: ACTIVATION_DENIED_CODE }, { status: 403 })
    }

    const result = await activateUserSession(admin, user.id, sessionId, confirmedIds ?? null)
    if (result.status === 'not_found') return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Sessions] Route activate en échec:', error)
    return NextResponse.json({ error: 'Erreur technique' }, { status: 500 })
  }
}
