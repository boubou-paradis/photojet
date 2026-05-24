// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Cron job : rappel téléchargement photos avant fin du Pass Week-end.
// Tourne chaque dimanche à 18h UTC (= 20h Paris été / 19h Paris hiver).
// Cible les passes qui expirent dans les 20 prochaines heures.
// Configure in vercel.json: { "path": "/api/cron/weekend-pass-reminder", "schedule": "0 18 * * 0" }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWeekendPassReminderEmail } from '@/lib/resend'

const getSupabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const now = new Date()
  const in20h = new Date(now.getTime() + 20 * 60 * 60 * 1000)

  // Passes actifs qui expirent dans les 20 prochaines heures
  const { data: passes, error } = await supabase
    .from('subscriptions')
    .select('id, user_id, pass_validity_until')
    .eq('status', 'weekend_pass')
    .gt('pass_validity_until', now.toISOString())
    .lt('pass_validity_until', in20h.toISOString())

  if (error) {
    console.error('[Cron weekend-pass-reminder] DB error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const remindersSent: string[] = []
  const errors: string[] = []

  if (passes && passes.length > 0) {
    for (const pass of passes) {
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', pass.user_id)
          .single()

        if (!profile?.email) continue

        await sendWeekendPassReminderEmail({
          to: profile.email,
          validUntil: new Date(pass.pass_validity_until),
        })

        remindersSent.push(profile.email)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`${pass.user_id}: ${msg}`)
        console.error('[Cron weekend-pass-reminder] Error for user', pass.user_id, msg)
      }
    }
  }

  console.log(`[Cron weekend-pass-reminder] Done: ${remindersSent.length} reminders sent, ${errors.length} errors`)

  return NextResponse.json({
    success: true,
    remindersSent: remindersSent.length,
    errors,
    details: remindersSent,
  })
}
