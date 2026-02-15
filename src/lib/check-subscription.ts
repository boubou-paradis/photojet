// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Checks if a user has a valid subscription (status AND date).
 * Use this in API routes to protect them.
 * Returns { valid: true } or { valid: false, reason: string }
 */
export async function checkUserSubscription(userId: string): Promise<{
  valid: boolean
  reason?: string
}> {
  const supabase = getSupabaseAdmin()

  // Check user role first
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()

  // Owners always have access
  if (profile?.role === 'owner') {
    return { valid: true }
  }

  // Get subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, trial_end')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!subscription) {
    return { valid: false, reason: 'no_subscription' }
  }

  const now = new Date()
  const { status, current_period_end, trial_end } = subscription

  // past_due, canceled, expired = always blocked
  if (status !== 'active' && status !== 'trialing') {
    return { valid: false, reason: `subscription_${status}` }
  }

  // trialing: check trial_end date
  if (status === 'trialing') {
    if (!trial_end || now > new Date(trial_end)) {
      return { valid: false, reason: 'trial_expired' }
    }
    return { valid: true }
  }

  // active: check current_period_end date
  if (status === 'active') {
    if (current_period_end && now > new Date(current_period_end)) {
      return { valid: false, reason: 'period_expired' }
    }
    return { valid: true }
  }

  return { valid: false, reason: 'unknown' }
}
