// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createWatermarkAdminClient, isTrialAccount } from '@/lib/watermark/access'

const EXPORT_BLOCKED_MESSAGE =
  "L'export des parties est réservé aux abonnés. Abonnez-vous pour partager vos parties"

// Le zip étant fabriqué dans le navigateur, cette route ne sert qu'à dire oui ou
// non. En cas d'erreur, pas de blocage : même règle que le filigrane.
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ blocked: false })

    const blocked = await isTrialAccount(createWatermarkAdminClient(), user.id)
    return NextResponse.json(blocked ? { blocked, message: EXPORT_BLOCKED_MESSAGE } : { blocked })
  } catch (error) {
    console.error('Mystery export access error:', error)
    return NextResponse.json({ blocked: false })
  }
}
