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

  // ============================================================
  // STEP 3b: If no DB record, find auth user and CREATE records
  // ============================================================
  const dbStatus = stripeSub.status === 'active' ? 'active'
    : stripeSub.status === 'trialing' ? 'trialing'
    : stripeSub.status === 'past_due' ? 'past_due'
    : stripeSub.status === 'canceled' ? 'canceled'
    : 'expired'

  let userId: string
  let previousStatus = 'none'
  let previousPeriodEnd = ''
  let profileCreated = false
  let subscriptionCreated = false

  if (!dbSub) {
    // Find auth user
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const authUser = authUsers?.users?.find(u =>
      u.email?.toLowerCase() === email.toLowerCase()
    )

    if (!authUser) {
      // Auth user was fully deleted - try multiple methods to recreate

      let newUserId: string | null = null

      // Method 1: admin.createUser
      const tempPassword = `Recover_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
      })
      if (created?.user) {
        newUserId = created.user.id
      }

      // Method 2: inviteUserByEmail (bypasses signup restrictions)
      if (!newUserId) {
        const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
          email.toLowerCase()
        )
        if (invited?.user) {
          newUserId = invited.user.id
        }
      }

      // Method 3: Direct GoTrue Admin API call
      if (!newUserId) {
        const gotrueRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
            },
            body: JSON.stringify({
              email: email.toLowerCase(),
              password: tempPassword,
              email_confirm: true,
            }),
          }
        )
        const gotrueData = await gotrueRes.json()
        if (gotrueData?.id) {
          newUserId = gotrueData.id
        }
      }

      // Method 4: Check if user actually exists but was soft-deleted (re-list with broader search)
      if (!newUserId) {
        // Try GoTrue list endpoint with broader params
        const listRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=50`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
            },
          }
        )
        const listData = await listRes.json()
        const allUsers = listData?.users || listData || []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const found = Array.isArray(allUsers) ? allUsers.find((u: any) =>
          u.email?.toLowerCase() === email.toLowerCase()
        ) : null
        if (found?.id) {
          newUserId = found.id
          // Unban / reactivate if needed
          await supabase.auth.admin.updateUserById(found.id, {
            ban_duration: 'none',
          })
        }
      }

      if (!newUserId) {
        return NextResponse.json({
          error: 'Could not create or find auth user (all methods failed)',
          stripeCustomer: { id: stripeCustomer.id, email: stripeCustomer.email },
          stripeSubscription: { id: stripeSub.id, status: stripeSub.status, period_end: stripePeriodEnd },
          hint: 'Check Supabase Auth settings: enable email signups, or check if user is soft-deleted in auth.users table via Supabase SQL editor.',
        }, { status: 500 })
      }

      userId = newUserId

      // Send password reset so user can set their own password
      await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: email.toLowerCase(),
      })
    } else {
      userId = authUser.id
    }

    // Create user_profiles record
    await supabase.from('user_profiles').upsert({
      id: userId,
      email: email.toLowerCase(),
      role: 'user',
    })
    profileCreated = true

    // Create subscription record
    const { data: newSub } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        stripe_customer_id: stripeCustomer.id,
        stripe_subscription_id: stripeSub.id,
        stripe_price_id: stripeSub.items.data[0]?.price.id || null,
        status: dbStatus,
        current_period_start: stripePeriodStart || new Date().toISOString(),
        current_period_end: stripePeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    subscriptionCreated = true
    dbSub = newSub

    // Reactivate existing sessions or note there are none
    if (dbStatus === 'active') {
      await supabase.from('sessions').update({ is_active: true }).eq('user_id', userId)
    }
  } else {
    // Record exists - update it
    userId = dbSub.user_id
    previousStatus = dbSub.status
    previousPeriodEnd = dbSub.current_period_end

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

    if (dbStatus === 'active') {
      await supabase.from('sessions').update({ is_active: true }).eq('user_id', userId)
    }

    // Fix missing profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!profile) {
      await supabase.from('user_profiles').upsert({
        id: userId,
        email: email.toLowerCase(),
        role: 'user',
      })
      profileCreated = true
    }
  }

  // ============================================================
  // STEP 5: Send renewal confirmation email
  // ============================================================
  let emailSent = false
  if (dbStatus === 'active' && stripePeriodEnd) {
    const result = await sendRenewalConfirmationEmail({
      to: email,
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
    profileCreated,
    subscriptionCreated,
    sessionsReactivated: dbStatus === 'active',
    emailSentTo: email,
    emailSent,
  })
}
