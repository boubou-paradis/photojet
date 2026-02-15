// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendExpiringEmail } from '@/lib/resend'

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
  const emailsSent: string[] = []

  // Check for subscriptions expiring in 7 days
  const in7Days = new Date(now)
  in7Days.setDate(in7Days.getDate() + 7)
  const in7DaysStart = new Date(in7Days)
  in7DaysStart.setHours(0, 0, 0, 0)
  const in7DaysEnd = new Date(in7Days)
  in7DaysEnd.setHours(23, 59, 59, 999)

  const { data: expiring7Days } = await supabase
    .from('subscriptions')
    .select('id, user_id, current_period_end')
    .eq('status', 'active')
    .eq('cancel_at_period_end', true)
    .gte('current_period_end', in7DaysStart.toISOString())
    .lte('current_period_end', in7DaysEnd.toISOString())

  if (expiring7Days) {
    for (const sub of expiring7Days) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', sub.user_id)
        .single()

      if (profile?.email) {
        await sendExpiringEmail({ to: profile.email, daysLeft: 7 })
        emailsSent.push(`7d: ${profile.email}`)
      }
    }
  }

  // Check for subscriptions expiring in 3 days
  const in3Days = new Date(now)
  in3Days.setDate(in3Days.getDate() + 3)
  const in3DaysStart = new Date(in3Days)
  in3DaysStart.setHours(0, 0, 0, 0)
  const in3DaysEnd = new Date(in3Days)
  in3DaysEnd.setHours(23, 59, 59, 999)

  const { data: expiring3Days } = await supabase
    .from('subscriptions')
    .select('id, user_id, current_period_end')
    .eq('status', 'active')
    .eq('cancel_at_period_end', true)
    .gte('current_period_end', in3DaysStart.toISOString())
    .lte('current_period_end', in3DaysEnd.toISOString())

  if (expiring3Days) {
    for (const sub of expiring3Days) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', sub.user_id)
        .single()

      if (profile?.email) {
        await sendExpiringEmail({ to: profile.email, daysLeft: 3 })
        emailsSent.push(`3d: ${profile.email}`)
      }
    }
  }

  // Check for subscriptions expiring today
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const { data: expiringToday } = await supabase
    .from('subscriptions')
    .select('id, user_id, current_period_end')
    .eq('status', 'active')
    .eq('cancel_at_period_end', true)
    .gte('current_period_end', todayStart.toISOString())
    .lte('current_period_end', todayEnd.toISOString())

  if (expiringToday) {
    for (const sub of expiringToday) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', sub.user_id)
        .single()

      if (profile?.email) {
        await sendExpiringEmail({ to: profile.email, daysLeft: 0 })
        emailsSent.push(`0d: ${profile.email}`)
      }
    }
  }

  console.log(`[Cron] check-expiring: ${emailsSent.length} emails sent`, emailsSent)

  return NextResponse.json({
    success: true,
    emailsSent: emailsSent.length,
    details: emailsSent,
  })
}
