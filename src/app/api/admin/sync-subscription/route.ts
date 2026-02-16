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
  // Auth check: accept CRON_SECRET (header) or ADMIN_SECRET_PIN (query param)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const secretParam = request.nextUrl.searchParams.get('secret')
  const adminPin = process.env.ADMIN_SECRET_PIN

  const isAuthorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (adminPin && secretParam === adminPin)

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // 1. Find user - try multiple approaches
  // Try exact match first
  let { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email')
    .eq('email', email)
    .single()

  // Try case-insensitive match
  if (!profile) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .ilike('email', email)
    if (profiles && profiles.length > 0) {
      profile = profiles[0]
    }
  }

  // Try via Supabase Auth
  if (!profile) {
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const authUser = authUsers?.users?.find(u =>
      u.email?.toLowerCase() === email.toLowerCase()
    )
    if (authUser) {
      // User exists in auth but maybe not in user_profiles
      // Try finding subscription directly by user_id
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, stripe_subscription_id, stripe_customer_id, status, current_period_end, user_id')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      return NextResponse.json({
        debug: true,
        message: 'User found in auth but NOT in user_profiles table',
        authUser: { id: authUser.id, email: authUser.email },
        subscription: sub || 'none',
        fix: 'Profile row missing - need to check user_profiles table',
      })
    }

    // Last resort: list all profiles to find similar emails
    const { data: allProfiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .ilike('email', `%${email.split('@')[0]}%`)

    return NextResponse.json({
      error: `User not found: ${email}`,
      similarProfiles: allProfiles || [],
      hint: 'Check if the email is spelled correctly or if the user was deleted',
    }, { status: 404 })
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
    return NextResponse.json({
      error: 'No subscription found for user',
      user: { id: profile.id, email: profile.email },
    }, { status: 404 })
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

  // 6. Send renewal confirmation email (always when active, this is a manual sync)
  let emailSent = false
  if (dbStatus === 'active' && stripePeriodEnd) {
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
