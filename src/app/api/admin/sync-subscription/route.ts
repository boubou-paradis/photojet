// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Manual subscription sync endpoint.
// Syncs a user's subscription from Stripe → Supabase and sends renewal email.
// Protected by CRON_SECRET.
//
// Usage: GET /api/admin/sync-subscription?email=user@example.com
// Header: Authorization: Bearer <CRON_SECRET>

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { sendRenewalConfirmationEmail } from '@/lib/resend'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // 1. Find user
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email')
    .eq('email', email)
    .single()

  if (!profile) {
    return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 })
  }

  // 2. Get subscription from DB
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, stripe_subscription_id, stripe_customer_id, status, current_period_end')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!subscription) {
    return NextResponse.json({ error: 'No subscription found for user' }, { status: 404 })
  }

  const previousStatus = subscription.status
  const previousPeriodEnd = subscription.current_period_end

  // 3. Try to get subscription from Stripe
  let stripeStatus = 'unknown'
  let stripePeriodEnd = ''
  let stripeSubId = subscription.stripe_subscription_id

  // First try by subscription ID
  if (subscription.stripe_subscription_id) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
      stripeStatus = stripeSub.status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawSub = stripeSub as any
      stripePeriodEnd = rawSub.current_period_end
        ? new Date(rawSub.current_period_end * 1000).toISOString()
        : ''
      stripeSubId = stripeSub.id
    } catch {
      console.log(`[Sync] Subscription ${subscription.stripe_subscription_id} not found in Stripe, trying by customer ID`)
    }
  }

  // If not found or deleted, try finding by customer ID
  if (stripeStatus === 'unknown' && subscription.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: subscription.stripe_customer_id,
        status: 'active',
        limit: 1,
      })

      if (subs.data.length > 0) {
        const stripeSub = subs.data[0]
        stripeStatus = stripeSub.status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawSub = stripeSub as any
        stripePeriodEnd = rawSub.current_period_end
          ? new Date(rawSub.current_period_end * 1000).toISOString()
          : ''
        stripeSubId = stripeSub.id
      }
    } catch (err) {
      console.error('[Sync] Error listing subscriptions by customer:', err)
    }
  }

  if (stripeStatus === 'unknown') {
    return NextResponse.json({
      error: 'Could not find active subscription in Stripe',
      db: { status: previousStatus, period_end: previousPeriodEnd },
    }, { status: 404 })
  }

  // 4. Update DB with Stripe data
  const dbStatus = stripeStatus === 'active' ? 'active'
    : stripeStatus === 'trialing' ? 'trialing'
    : stripeStatus === 'past_due' ? 'past_due'
    : stripeStatus === 'canceled' ? 'canceled'
    : 'expired'

  await supabase
    .from('subscriptions')
    .update({
      stripe_subscription_id: stripeSubId,
      status: dbStatus,
      current_period_end: stripePeriodEnd || undefined,
    })
    .eq('id', subscription.id)

  // 5. Reactivate sessions if now active
  if (dbStatus === 'active') {
    await supabase
      .from('sessions')
      .update({ is_active: true })
      .eq('user_id', profile.id)
  }

  // 6. Send renewal confirmation email if reactivated
  let emailSent = false
  if (dbStatus === 'active' && previousStatus !== 'active' && stripePeriodEnd) {
    await sendRenewalConfirmationEmail({
      to: email,
      nextBillingDate: stripePeriodEnd,
    })
    emailSent = true
  }

  return NextResponse.json({
    success: true,
    user: email,
    before: { status: previousStatus, period_end: previousPeriodEnd },
    after: { status: dbStatus, period_end: stripePeriodEnd, stripe_subscription_id: stripeSubId },
    sessionsReactivated: dbStatus === 'active',
    emailSent,
  })
}
