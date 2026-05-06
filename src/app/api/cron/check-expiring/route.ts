// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendExpiredEmail, sendTrialExpiredEmail } from '@/lib/resend'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Called by Vercel Cron Job daily
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/check-expiring", "schedule": "0 9 * * *" }] }
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const now = new Date()
  // ============================================================
  // AUTO-EXPIRE: Set status to 'expired' for subscriptions
  // where current_period_end has passed but status is still 'active'
  // This is the safety net that fixes the core bug.
  // ============================================================
  const { data: staleActive } = await supabase
    .from('subscriptions')
    .select('id, user_id')
    .eq('status', 'active')
    .lt('current_period_end', now.toISOString())

  const expiredUsers: string[] = []

  if (staleActive && staleActive.length > 0) {
    for (const sub of staleActive) {
      // Update subscription status to expired
      await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('id', sub.id)

      // Deactivate all sessions for this user
      await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('user_id', sub.user_id)

      // Send expired email
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', sub.user_id)
        .single()

      if (profile?.email) {
        await sendExpiredEmail({ to: profile.email })
        expiredUsers.push(profile.email)
      }
    }
  }

  // Also expire stale 'trialing' subscriptions
  const { data: staleTrialing } = await supabase
    .from('subscriptions')
    .select('id, user_id')
    .eq('status', 'trialing')
    .lt('trial_end', now.toISOString())

  const trialExpiredUsers: string[] = []

  if (staleTrialing && staleTrialing.length > 0) {
    for (const sub of staleTrialing) {
      await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('id', sub.id)

      await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('user_id', sub.user_id)

      // Send trial expired email
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', sub.user_id)
        .single()

      if (profile?.email) {
        await sendTrialExpiredEmail({ to: profile.email })
        trialExpiredUsers.push(profile.email)
      }
    }
  }

  // Expirer les passes week-end dont pass_validity_until est dépassé
  const { data: staleWeekendPass } = await supabase
    .from('subscriptions')
    .select('id, user_id')
    .eq('status', 'weekend_pass')
    .lt('pass_validity_until', now.toISOString())

  let weekendPassExpired = 0
  if (staleWeekendPass && staleWeekendPass.length > 0) {
    for (const sub of staleWeekendPass) {
      await supabase.from('subscriptions').update({ status: 'expired' }).eq('id', sub.id)
      await supabase.from('sessions').update({ is_active: false }).eq('user_id', sub.user_id)
      weekendPassExpired++
    }
  }

  return NextResponse.json({
    success: true,
    autoExpired: expiredUsers.length,
    trialExpired: trialExpiredUsers.length,
    weekendPassExpired,
    details: { expired: expiredUsers, trialExpired: trialExpiredUsers },
  })
}
