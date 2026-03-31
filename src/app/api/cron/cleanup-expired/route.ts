// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Cron job for data deletion after subscription expiration.
// - Sends warning emails at 23 days and 29 days after expiration
// - Deletes all user data 30 days after expiration
// Configure in vercel.json: { "path": "/api/cron/cleanup-expired", "schedule": "0 3 * * *" }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendDataDeletionWarningEmail } from '@/lib/resend'
import { stripe } from '@/lib/stripe'

const GRACE_PERIOD_DAYS = 30
const WARNING_DAYS = [7, 1] // Send warnings at 7 days and 1 day before deletion

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const now = new Date()
  const results: {
    warningsSent: string[]
    usersDeleted: string[]
    skippedStillActive?: string[]
    errors: string[]
  } = {
    warningsSent: [],
    usersDeleted: [],
    errors: [],
  }

  // ============================================================
  // 1. Send warning emails for users approaching data deletion
  // ============================================================
  for (const warningDaysBefore of WARNING_DAYS) {
    // Calculate the expiration date that corresponds to X days before deletion
    // If grace period is 30 days and warning is 7 days before deletion,
    // we look for subscriptions expired 23 days ago (30 - 7 = 23)
    const daysAfterExpiration = GRACE_PERIOD_DAYS - warningDaysBefore
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() - daysAfterExpiration)
    const targetStart = new Date(targetDate)
    targetStart.setHours(0, 0, 0, 0)
    const targetEnd = new Date(targetDate)
    targetEnd.setHours(23, 59, 59, 999)

    const { data: expiringUsers } = await supabase
      .from('subscriptions')
      .select('id, user_id, current_period_end, stripe_customer_id, stripe_subscription_id')
      .in('status', ['expired', 'canceled', 'past_due'])
      .gte('current_period_end', targetStart.toISOString())
      .lte('current_period_end', targetEnd.toISOString())

    if (expiringUsers) {
      for (const sub of expiringUsers) {
        // SAFETY CHECK: Don't warn users who have renewed in Stripe
        const isStillActive = await checkStripeSubscriptionActive(sub.stripe_customer_id, sub.stripe_subscription_id)
        if (isStillActive.active) {
          // Only reset to active if Stripe confirms a FUTURE period end
          // (avoids resetting on API errors or missing periodEnd which causes daily email loops)
          if (isStillActive.periodEnd && new Date(isStillActive.periodEnd) > now) {
            await supabase
              .from('subscriptions')
              .update({
                status: 'active',
                current_period_end: isStillActive.periodEnd,
                ...(isStillActive.periodStart ? { current_period_start: isStillActive.periodStart } : {}),
              })
              .eq('id', sub.id)
            results.skippedStillActive = results.skippedStillActive || []
            results.skippedStillActive.push(sub.user_id)
          }
          continue
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', sub.user_id)
          .single()

        if (profile?.email) {
          await sendDataDeletionWarningEmail({
            to: profile.email,
            daysLeft: warningDaysBefore,
          })
          results.warningsSent.push(`${warningDaysBefore}d: ${profile.email}`)
        }
      }
    }
  }

  // ============================================================
  // 2. Delete data for users whose grace period has expired
  // ============================================================
  const deletionThreshold = new Date(now)
  deletionThreshold.setDate(deletionThreshold.getDate() - GRACE_PERIOD_DAYS)

  const { data: usersToDelete } = await supabase
    .from('subscriptions')
    .select('id, user_id, stripe_customer_id, stripe_subscription_id')
    .in('status', ['expired', 'canceled', 'past_due'])
    .lt('current_period_end', deletionThreshold.toISOString())

  if (usersToDelete) {
    for (const sub of usersToDelete) {
      try {
        // SAFETY CHECK: Verify subscription is truly inactive in Stripe before deleting
        const isStillActive = await checkStripeSubscriptionActive(sub.stripe_customer_id, sub.stripe_subscription_id)
        if (isStillActive.active) {
          // Only reset to active if Stripe confirms a FUTURE period end
          // (avoids resetting on API errors or missing periodEnd which causes daily email loops)
          const hasFuturePeriodEnd = isStillActive.periodEnd && new Date(isStillActive.periodEnd) > now
          if (hasFuturePeriodEnd) {
            console.log(`[Cron cleanup] SKIPPING user ${sub.user_id}: Stripe subscription is still active (${isStillActive.status}, ends ${isStillActive.periodEnd}). Syncing DB instead.`)
            await supabase
              .from('subscriptions')
              .update({
                status: 'active',
                current_period_end: isStillActive.periodEnd,
                ...(isStillActive.periodStart ? { current_period_start: isStillActive.periodStart } : {}),
              })
              .eq('id', sub.id)
            results.skippedStillActive = results.skippedStillActive || []
            results.skippedStillActive.push(sub.user_id)
          } else {
            console.log(`[Cron cleanup] SKIPPING deletion for user ${sub.user_id}: Stripe says active but no confirmed future period end (periodEnd=${isStillActive.periodEnd}). Keeping as expired.`)
          }
          continue
        }

        await deleteUserData(supabase, sub.user_id)
        results.usersDeleted.push(sub.user_id)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(`${sub.user_id}: ${msg}`)
        console.error(`[Cron cleanup] Error deleting data for user ${sub.user_id}:`, msg)
      }
    }
  }

  console.log(`[Cron cleanup] Done: ${results.warningsSent.length} warnings, ${results.usersDeleted.length} deletions, ${results.errors.length} errors`)

  return NextResponse.json({
    success: true,
    ...results,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteUserData(
  supabase: any,
  userId: string
) {
  console.log(`[Cron cleanup] Deleting data for user ${userId}`)

  // 1. Get all sessions for this user
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)

  if (sessions && sessions.length > 0) {
    const sessionIds = sessions.map((s: { id: string }) => s.id)

    // 2. Get all photos to delete from storage
    const { data: photos } = await supabase
      .from('photos')
      .select('id, storage_path')
      .in('session_id', sessionIds)

    // 3. Delete photo files from Supabase Storage
    if (photos && photos.length > 0) {
      const storagePaths = photos
        .map((p: { storage_path: string }) => p.storage_path)
        .filter(Boolean)

      if (storagePaths.length > 0) {
        // Delete in batches of 100
        for (let i = 0; i < storagePaths.length; i += 100) {
          const batch = storagePaths.slice(i, i + 100)
          const { error: storageError } = await supabase.storage
            .from('photos')
            .remove(batch)

          if (storageError) {
            console.error(`[Cron cleanup] Storage delete error for user ${userId}:`, storageError.message)
          }
        }
      }

      // 4. Delete photo records from DB
      await supabase
        .from('photos')
        .delete()
        .in('session_id', sessionIds)
    }

    // 5. Delete print requests
    await supabase
      .from('print_requests')
      .delete()
      .in('session_id', sessionIds)

    // 6. Delete borne connections
    await supabase
      .from('borne_connections')
      .delete()
      .in('session_id', sessionIds)

    // 7. Delete sessions
    await supabase
      .from('sessions')
      .delete()
      .eq('user_id', userId)
  }

  // 8. Delete invoices
  // First delete invoice PDFs from storage
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, pdf_path')
    .eq('user_id', userId)

  if (invoices && invoices.length > 0) {
    const pdfPaths = invoices.map((i: { pdf_path: string }) => i.pdf_path).filter(Boolean)
    if (pdfPaths.length > 0) {
      await supabase.storage
        .from('invoices')
        .remove(pdfPaths)
    }

    await supabase
      .from('invoices')
      .delete()
      .eq('user_id', userId)
  }

  // 9. Delete trial tokens
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (profile?.email) {
    await supabase
      .from('trial_tokens')
      .delete()
      .eq('email', profile.email)
  }

  // 10. Delete promo code uses
  await supabase
    .from('promo_code_uses')
    .delete()
    .eq('user_id', userId)

  // 11. Delete subscription record
  await supabase
    .from('subscriptions')
    .delete()
    .eq('user_id', userId)

  // 12. Delete user profile
  await supabase
    .from('user_profiles')
    .delete()
    .eq('id', userId)

  // 13. Delete auth user (this cascades to user_profiles if not already deleted)
  await supabase.auth.admin.deleteUser(userId)

  console.log(`[Cron cleanup] Successfully deleted all data for user ${userId}`)
}

// Check if a user's Stripe subscription is actually still active
// This prevents deleting data for users who renewed but whose DB wasn't updated
async function checkStripeSubscriptionActive(
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null
): Promise<{ active: boolean; status?: string; periodStart?: string; periodEnd?: string }> {
  try {
    // Check by subscription ID first
    if (stripeSubscriptionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId) as any
      if (sub.status === 'active' || sub.status === 'trialing') {
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : sub.items?.data?.[0]?.current_period_end
            ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
            : undefined
        const periodStart = sub.current_period_start
          ? new Date(sub.current_period_start * 1000).toISOString()
          : sub.items?.data?.[0]?.current_period_start
            ? new Date(sub.items.data[0].current_period_start * 1000).toISOString()
            : undefined
        return { active: true, status: sub.status, periodStart, periodEnd }
      }
    }

    // Fallback: check all subscriptions for this customer
    if (stripeCustomerId) {
      const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, limit: 5 })
      const activeSub = subs.data.find(s => s.status === 'active' || s.status === 'trialing')
      if (activeSub) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = activeSub as any
        const periodEnd = raw.current_period_end
          ? new Date(raw.current_period_end * 1000).toISOString()
          : raw.items?.data?.[0]?.current_period_end
            ? new Date(raw.items.data[0].current_period_end * 1000).toISOString()
            : undefined
        const periodStart = raw.current_period_start
          ? new Date(raw.current_period_start * 1000).toISOString()
          : raw.items?.data?.[0]?.current_period_start
            ? new Date(raw.items.data[0].current_period_start * 1000).toISOString()
            : undefined
        return { active: true, status: activeSub.status, periodStart, periodEnd }
      }
    }
  } catch (error) {
    // If Stripe lookup fails, err on the side of caution: don't delete
    console.error('[Cron cleanup] Stripe check failed:', error instanceof Error ? error.message : error)
    return { active: true, status: 'unknown_stripe_error' }
  }

  return { active: false }
}
