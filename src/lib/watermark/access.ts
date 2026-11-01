// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isFreeTrialAccount, type TrialSubscriptionRow } from '@/lib/trial'

export type WatermarkCodeKind = 'session' | 'borne'

// Au-delà, on répond « pas d'essai » : un Supabase lent ne doit ralentir aucun écran
const STATUS_TIMEOUT_MS = 2500

export function createWatermarkAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function readTrialAccount(admin: SupabaseClient, userId: string | null): Promise<boolean> {
  if (!userId) return false

  const [{ data: profile, error: profileError }, { data: subscriptions, error: subscriptionsError }] =
    await Promise.all([
      admin.from('user_profiles').select('role').eq('id', userId).maybeSingle(),
      admin
        .from('subscriptions')
        .select('status, stripe_subscription_id, pass_validity_until')
        .eq('user_id', userId),
    ])

  if (profileError) throw profileError
  if (subscriptionsError) throw subscriptionsError

  return isFreeTrialAccount(profile?.role, (subscriptions ?? []) as TrialSubscriptionRow[])
}

/**
 * RÈGLE : en cas de doute ou d'erreur, pas de filigrane et pas de blocage. Toute
 * erreur ou lenteur donne `false` : un client payant ne doit jamais être pénalisé
 * par une panne, quitte à laisser passer un compte d'essai le temps de la panne.
 * Toute lecture du statut d'essai doit passer par cette fonction.
 */
async function failOpen(check: () => Promise<boolean>): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      console.warn('Watermark status timeout')
      resolve(false)
    }, STATUS_TIMEOUT_MS)
  })

  try {
    return await Promise.race([check(), timeout])
  } catch (error) {
    console.error('Watermark status error:', error)
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Ne lève jamais d'erreur : voir failOpen. */
export function isTrialAccount(admin: SupabaseClient, userId: string | null): Promise<boolean> {
  return failOpen(() => readTrialAccount(admin, userId))
}

/** Statut d'une session à partir du code public (/live, /invite) ou de borne. Ne lève jamais d'erreur. */
export function isTrialCode(code: string, kind: WatermarkCodeKind = 'session'): Promise<boolean> {
  return failOpen(async () => {
    const admin = createWatermarkAdminClient()
    const { data: session, error } = await admin
      .from('sessions')
      .select('user_id')
      .eq(kind === 'borne' ? 'borne_qr_code' : 'code', code)
      .maybeSingle()

    if (error) throw error
    return readTrialAccount(admin, session?.user_id ?? null)
  })
}
