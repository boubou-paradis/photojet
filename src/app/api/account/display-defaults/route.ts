// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Réglages d'affichage par défaut du compte connecté.
//   GET                                  → réglages enregistrés (ou null)
//   POST { action: 'save',  sessionId }  → enregistrer ceux de cette session
//   POST { action: 'apply', sessionId }  → appliquer à CETTE session uniquement
//   POST { action: 'delete' }            → supprimer les réglages par défaut
// L'utilisateur vient toujours des cookies, jamais du corps de la requête.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  DisplayDefaultsError,
  applyDisplayDefaults,
  deleteDisplayDefaults,
  getDefaultsAdmin,
  readDisplayDefaults,
  saveDisplayDefaults,
} from '@/lib/display-defaults/server'

// Jusqu'à 20 affiches à copier une par une
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function errorResponse(error: unknown) {
  if (error instanceof DisplayDefaultsError) {
    if (error.code === 'not_found') return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    if (error.code === 'copy_failed') return NextResponse.json({ error: error.message }, { status: 502 })
  }
  console.error('[display-defaults] Erreur:', error instanceof Error ? error.message : error)
  return NextResponse.json({ error: 'Erreur technique, réessayez.' }, { status: 500 })
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  try {
    const defaults = await readDisplayDefaults(getDefaultsAdmin(), user.id)
    return NextResponse.json({ defaults })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const action = body?.action
  const sessionId = body?.sessionId

  if (action !== 'save' && action !== 'apply' && action !== 'delete') {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }
  if (action !== 'delete' && (typeof sessionId !== 'string' || !UUID.test(sessionId))) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const admin = getDefaultsAdmin()
  try {
    if (action === 'save') {
      const defaults = await saveDisplayDefaults(supabase, admin, user.id, sessionId)
      return NextResponse.json({ defaults })
    }
    if (action === 'apply') {
      return NextResponse.json(await applyDisplayDefaults(supabase, admin, user.id, sessionId))
    }
    await deleteDisplayDefaults(admin, user.id)
    return NextResponse.json({ defaults: null })
  } catch (error) {
    return errorResponse(error)
  }
}
