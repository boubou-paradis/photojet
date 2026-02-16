// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Manual subscription sync endpoint.
// Syncs a user's subscription from Stripe → Supabase and sends renewal email.
//
// Usage: GET /api/admin/sync-subscription?email=user@example.com&secret=ADMIN_PIN

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

  // ============================================================
  // STEP 1: Find the Stripe customer by email
  // ============================================================
  const customers = await stripe.customers.list({ email: email.toLowerCase(), limit: 5 })

  if (customers.data.length === 0) {
    return NextResponse.json({
      error: `No Stripe customer found for email: ${email}`,
      hint: 'Check the email in the Stripe dashboard',
    }, { status: 404 })
  }

  const stripeCustomer = customers.data[0]

  // ============================================================
  // STEP 2: Find active subscription in Stripe for this customer
  // ============================================================
  const stripeSubs = await stripe.subscriptions.list({
    customer: stripeCustomer.id,
    limit: 5,
  })

  // Try active first, then any status
  let stripeSub = stripeSubs.data.find(s => s.status === 'active')
    || stripeSubs.data.find(s => s.status === 'trialing')
    || stripeSubs.data[0]

  if (!stripeSub) {
    return NextResponse.json({
      error: 'No subscription found in Stripe',
      stripeCustomer: { id: stripeCustomer.id, email: stripeCustomer.email },
    }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSub = stripeSub as any
  const stripePeriodEnd = rawSub.current_period_end
    ? new Date(rawSub.current_period_end * 1000).toISOString()
    : rawSub.items?.data?.[0]?.current_period_end
      ? new Date(rawSub.items.data[0].current_period_end * 1000).toISOString()
      : ''
  const stripePeriodStart = rawSub.current_period_start
    ? new Date(rawSub.current_period_start * 1000).toISOString()
    : rawSub.items?.data?.[0]?.current_period_start
      ? new Date(rawSub.items.data[0].current_period_start * 1000).toISOString()
      : ''

  // ============================================================
  // STEP 3: Find subscription in Supabase (by customer_id or subscription_id)
  // ============================================================
  let { data: dbSub } = await supabase
    .from('subscriptions')
    .select('id, user_id, status, current_period_end, stripe_subscription_id, stripe_customer_id')
    .eq('stripe_customer_id', stripeCustomer.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!dbSub) {
    const result = await supabase
      .from('subscriptions')
      .select('id, user_id, status, current_period_end, stripe_subscription_id, stripe_customer_id')
      .eq('stripe_subscription_id', stripeSub.id)
      .single()
    dbSub = result.data
  }

  if (!dbSub) {
    return NextResponse.json({
      error: 'No subscription found in Supabase DB',
      stripeCustomer: { id: stripeCustomer.id, email: stripeCustomer.email },
      stripeSubscription: { id: stripeSub.id, status: stripeSub.status, period_end: stripePeriodEnd },
      hint: 'The subscription exists in Stripe but not in the database',
    }, { status: 404 })
  }

  const previousStatus = dbSub.status
  const previousPeriodEnd = dbSub.current_period_end

  // ============================================================
  // STEP 4: Check user_profiles
  // ============================================================
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email')
    .eq('id', dbSub.user_id)
    .single()

  // ============================================================
  // STEP 5: Update DB with Stripe data
  // ============================================================
  const dbStatus = stripeSub.status === 'active' ? 'active'
    : stripeSub.status === 'trialing' ? 'trialing'
    : stripeSub.status === 'past_due' ? 'past_due'
    : stripeSub.status === 'canceled' ? 'canceled'
    : 'expired'

  await supabase
    .from('subscriptions')
    .update({
      stripe_subscription_id: stripeSub.id,
      stripe_customer_id: stripeCustomer.id,
      status: dbStatus,
      ...(stripePeriodEnd ? { current_period_end: stripePeriodEnd } : {}),
      ...(stripePeriodStart ? { current_period_start: stripePeriodStart } : {}),
    })
    .eq('id', dbSub.id)

  // Reactivate sessions if active
  if (dbStatus === 'active') {
    await supabase
      .from('sessions')
      .update({ is_active: true })
      .eq('user_id', dbSub.user_id)
  }

  // ============================================================
  // STEP 6: Fix missing profile if needed
  // ============================================================
  let profileFixed = false
  if (!profile) {
    await supabase.from('user_profiles').upsert({
      id: dbSub.user_id,
      email: email.toLowerCase(),
      role: 'user',
    })
    profileFixed = true
  }

  // ============================================================
  // STEP 7: Send renewal confirmation email
  // ============================================================
  let emailSent = false
  const sendTo = profile?.email || email
  if (dbStatus === 'active' && stripePeriodEnd) {
    const result = await sendRenewalConfirmationEmail({
      to: sendTo,
      nextBillingDate: stripePeriodEnd,
    })
    emailSent = result.success === true
  }

  return NextResponse.json({
    success: true,
    stripeCustomer: { id: stripeCustomer.id, email: stripeCustomer.email },
    stripeSubscription: { id: stripeSub.id, status: stripeSub.status },
    before: { status: previousStatus, period_end: previousPeriodEnd },
    after: { status: dbStatus, period_end: stripePeriodEnd },
    profileInDb: profile ? { id: profile.id, email: profile.email } : null,
    profileFixed,
    sessionsReactivated: dbStatus === 'active',
    emailSentTo: sendTo,
    emailSent,
  })
}
