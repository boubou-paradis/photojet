import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe, generatePassword, generateSessionCode } from '@/lib/stripe'
import { sendWelcomeEmail, sendExpiredEmail } from '@/lib/resend'
import { createClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build-time errors
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log('[Webhook] Event received:', event.type)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription & { current_period_start: number; current_period_end: number }
        await handleSubscriptionUpdated(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        console.log('[Webhook] Unhandled event type:', event.type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Webhook] Error processing event:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const email = session.customer_email || session.metadata?.email
  const promoCode = session.metadata?.promoCode

  if (!email) {
    console.error('[Webhook] No email found in checkout session')
    return
  }

  console.log('[Webhook] Processing checkout for:', email)

  // Get subscription details
  const stripeSubscriptionResponse = await stripe.subscriptions.retrieve(
    session.subscription as string
  )
  const stripeSubscription = stripeSubscriptionResponse as unknown as Stripe.Subscription & {
    current_period_start: number
    current_period_end: number
  }

  // Generate password and session code
  const password = generatePassword()
  const sessionCode = generateSessionCode()

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    // User might already exist
    console.log('[Webhook] User might already exist:', authError.message)

    // Try to get existing user
    const { data: existingUsers } = await getSupabaseAdmin().auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      // Update existing user's subscription
      await updateExistingUser(existingUser.id, stripeSubscription, session, sessionCode, promoCode)
      return
    }

    throw authError
  }

  const userId = authData.user.id

  // Create user profile
  await getSupabaseAdmin().from('user_profiles').insert({
    id: userId,
    email,
    role: 'user',
  })

  // Handle promo code usage
  let promoCodeId: string | null = null
  if (promoCode) {
    const { data: promo } = await getSupabaseAdmin()
      .from('promo_codes')
      .select('id')
      .eq('code', promoCode.toUpperCase())
      .single()

    if (promo) {
      promoCodeId = promo.id

      // Record promo code usage
      await getSupabaseAdmin().from('promo_code_uses').insert({
        promo_code_id: promo.id,
        user_id: userId,
      })

      // Increment usage count
      await getSupabaseAdmin().rpc('increment_promo_uses', { promo_id: promo.id })
    }
  }

  // Create subscription record
  const { data: subscriptionData } = await getSupabaseAdmin()
    .from('subscriptions')
    .insert({
      user_id: userId,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: stripeSubscription.items.data[0]?.price.id,
      status: stripeSubscription.status === 'trialing' ? 'trialing' : 'active',
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      trial_start: stripeSubscription.trial_start
        ? new Date(stripeSubscription.trial_start * 1000).toISOString()
        : null,
      trial_end: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000).toISOString()
        : null,
      promo_code_id: promoCodeId,
    })
    .select()
    .single()

  // Create initial PhotoJet session
  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + 1)

  await getSupabaseAdmin().from('sessions').insert({
    code: sessionCode,
    name: 'Mon evenement',
    expires_at: expiresAt.toISOString(),
    user_id: userId,
    subscription_id: subscriptionData?.id,
    moderation_enabled: true,
    is_active: true,
  })

  // Send welcome email
  await sendWelcomeEmail({
    to: email,
    password,
    sessionCode,
  })

  console.log('[Webhook] New user created:', email, 'Session:', sessionCode)
}

async function updateExistingUser(
  userId: string,
  stripeSubscription: Stripe.Subscription & { current_period_start: number; current_period_end: number },
  checkoutSession: Stripe.Checkout.Session,
  sessionCode: string,
  promoCode?: string
) {
  // Update or create subscription
  const { data: existingSub } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .single()

  const subscriptionData = {
    user_id: userId,
    stripe_customer_id: checkoutSession.customer as string,
    stripe_subscription_id: stripeSubscription.id,
    stripe_price_id: stripeSubscription.items.data[0]?.price.id,
    status: stripeSubscription.status === 'trialing' ? 'trialing' : 'active',
    current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
  }

  if (existingSub) {
    await getSupabaseAdmin()
      .from('subscriptions')
      .update(subscriptionData)
      .eq('id', existingSub.id)
  } else {
    await getSupabaseAdmin().from('subscriptions').insert(subscriptionData)
  }

  // Reactivate sessions
  await getSupabaseAdmin()
    .from('sessions')
    .update({ is_active: true })
    .eq('user_id', userId)

  console.log('[Webhook] Existing user reactivated:', userId)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription & { current_period_start: number; current_period_end: number }) {
  const { data } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('id, user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (!data) return

  await getSupabaseAdmin()
    .from('subscriptions')
    .update({
      status: subscription.status as 'active' | 'trialing' | 'canceled' | 'expired' | 'past_due',
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    })
    .eq('id', data.id)

  console.log('[Webhook] Subscription updated:', subscription.id)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { data } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('id, user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (!data) return

  // Update subscription status
  await getSupabaseAdmin()
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('id', data.id)

  // Deactivate sessions
  await getSupabaseAdmin()
    .from('sessions')
    .update({ is_active: false })
    .eq('user_id', data.user_id)

  // Get user email and send expired notification
  const { data: profile } = await getSupabaseAdmin()
    .from('user_profiles')
    .select('email')
    .eq('id', data.user_id)
    .single()

  if (profile?.email) {
    await sendExpiredEmail({ to: profile.email })
  }

  console.log('[Webhook] Subscription deleted:', subscription.id)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptionId = (invoice as any).subscription as string
  if (!subscriptionId) return

  const { data } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!data) return

  await getSupabaseAdmin()
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('id', data.id)

  console.log('[Webhook] Payment failed for subscription:', subscriptionId)
}
