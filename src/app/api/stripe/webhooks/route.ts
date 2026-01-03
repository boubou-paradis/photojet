// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe, generatePassword, generateSessionCode } from '@/lib/stripe'
import { sendWelcomeEmail, sendExpiredEmail } from '@/lib/resend'
import { createClient } from '@supabase/supabase-js'
import { generateInvoiceNumber, generateInvoicePDF, saveInvoice, PRICE } from '@/lib/invoice'

// Convert Stripe timestamp to ISO string with fallback
function safeTimestampToISO(
  timestamp: number | null | undefined,
  fallbackDate?: Date
): string {
  if (timestamp === null || timestamp === undefined || timestamp === 0) {
    return (fallbackDate || new Date()).toISOString()
  }
  if (typeof timestamp !== 'number' || isNaN(timestamp)) {
    return (fallbackDate || new Date()).toISOString()
  }
  const date = new Date(timestamp * 1000)
  if (isNaN(date.getTime())) {
    return (fallbackDate || new Date()).toISOString()
  }
  return date.toISOString()
}

function getDefaultPeriodEnd(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
}

const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  if (key === 'your_service_role_key_here' || key.length < 50) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY appears to be invalid')
  }

  return createClient(url, key)
}

async function generateUniqueSessionCode(): Promise<string> {
  const maxAttempts = 50

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateSessionCode()
    const { data: existing, error } = await getSupabaseAdmin()
      .from('sessions')
      .select('id')
      .eq('code', code)
      .single()

    if (error?.code === 'PGRST116' || !existing) {
      return code
    }
  }

  // Fallback: generate 4-char code with different charset
  const fallbackChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let fallbackCode = ''
  for (let i = 0; i < 4; i++) {
    fallbackCode += fallbackChars.charAt(Math.floor(Math.random() * fallbackChars.length))
  }
  return fallbackCode
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
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured')
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

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
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Webhook] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({
      error: 'Webhook handler failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const email = session.customer_details?.email || session.customer_email || session.metadata?.email
  const promoCode = session.metadata?.promoCode

  if (!email) {
    throw new Error('No email found in checkout session')
  }

  if (!session.subscription) {
    throw new Error('No subscription ID in checkout session')
  }

  // Get subscription from Stripe
  const stripeSubscriptionResponse = await stripe.subscriptions.retrieve(session.subscription as string)
  const stripeSubscription = stripeSubscriptionResponse as unknown as Stripe.Subscription & {
    current_period_start: number
    current_period_end: number
  }

  const password = generatePassword()
  const sessionCode = await generateUniqueSessionCode()

  // Create or get user
  const supabase = getSupabaseAdmin()
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      await updateExistingUser(existingUser.id, stripeSubscription, session, sessionCode, promoCode)
      return
    }
    throw authError
  }

  const userId = authData.user.id

  // Create profile
  await getSupabaseAdmin().from('user_profiles').insert({
    id: userId,
    email,
    role: 'user',
  })

  // Handle promo code
  let promoCodeId: string | null = null
  if (promoCode) {
    const { data: promo } = await getSupabaseAdmin()
      .from('promo_codes')
      .select('id')
      .eq('code', promoCode.toUpperCase())
      .single()

    if (promo) {
      promoCodeId = promo.id
      await getSupabaseAdmin().from('promo_code_uses').insert({
        promo_code_id: promo.id,
        user_id: userId,
      })
    }
  }

  // Create subscription record
  const now = new Date()
  const defaultEnd = getDefaultPeriodEnd()
  const periodStart = safeTimestampToISO(stripeSubscription.current_period_start, now)
  const periodEnd = safeTimestampToISO(stripeSubscription.current_period_end, defaultEnd)
  const trialStart = stripeSubscription.trial_start ? safeTimestampToISO(stripeSubscription.trial_start) : null
  const trialEnd = stripeSubscription.trial_end ? safeTimestampToISO(stripeSubscription.trial_end) : null

  const { data: subscriptionData, error: subError } = await getSupabaseAdmin()
    .from('subscriptions')
    .insert({
      user_id: userId,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: stripeSubscription.items.data[0]?.price.id,
      status: stripeSubscription.status === 'trialing' ? 'trialing' : 'active',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      trial_start: trialStart,
      trial_end: trialEnd,
      promo_code_id: promoCodeId,
    })
    .select()
    .single()

  if (subError) {
    console.error('[Webhook] Subscription insert failed:', subError.message)
    throw subError
  }

  // Create session
  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + 1)

  if (sessionCode.length !== 4) {
    throw new Error(`Session code must be 4 characters, got ${sessionCode.length}`)
  }

  const { error: sessionError } = await getSupabaseAdmin()
    .from('sessions')
    .insert({
      code: sessionCode,
      name: 'Mon evenement',
      expires_at: expiresAt.toISOString(),
      user_id: userId,
      subscription_id: subscriptionData?.id || null,
      moderation_enabled: true,
      is_active: true,
    })

  if (sessionError) {
    console.error('[Webhook] Session insert failed:', sessionError.message)
    throw sessionError
  }

  // Generate invoice
  let invoiceData: { pdfBuffer: Uint8Array; invoiceNumber: string } | undefined
  try {
    const invoiceNumber = await generateInvoiceNumber()
    const customerName = session.customer_details?.name || ''

    const pdfBuffer = await generateInvoicePDF({
      invoiceNumber,
      date: new Date(),
      customerName,
      customerEmail: email,
      amount: PRICE,
      stripePaymentId: session.payment_intent as string || undefined,
    })

    // Save invoice to database and storage
    await saveInvoice({
      userId,
      invoiceNumber,
      amount: PRICE,
      stripePaymentId: session.payment_intent as string || undefined,
      pdfBuffer,
    })

    invoiceData = { pdfBuffer, invoiceNumber }
    console.log(`[Webhook] Invoice ${invoiceNumber} generated for ${email}`)
  } catch (invoiceError) {
    console.error('[Webhook] Invoice generation failed:', invoiceError)
    // Continue without invoice - don't block the welcome email
  }

  // Send welcome email with invoice attached
  await sendWelcomeEmail({ to: email, password, sessionCode, invoice: invoiceData })
}

async function updateExistingUser(
  userId: string,
  stripeSubscription: Stripe.Subscription & { current_period_start: number; current_period_end: number },
  checkoutSession: Stripe.Checkout.Session,
  sessionCode: string,
  promoCode?: string
) {
  const { data: profile } = await getSupabaseAdmin()
    .from('user_profiles')
    .select('email')
    .eq('id', userId)
    .single()

  const email = profile?.email || checkoutSession.customer_email
  const newPassword = generatePassword()

  // Update password
  await getSupabaseAdmin().auth.admin.updateUserById(userId, { password: newPassword })

  // Update or create subscription
  const { data: existingSub } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .single()

  const now = new Date()
  const defaultEnd = getDefaultPeriodEnd()
  const periodStart = safeTimestampToISO(stripeSubscription.current_period_start, now)
  const periodEnd = safeTimestampToISO(stripeSubscription.current_period_end, defaultEnd)

  const subscriptionData = {
    user_id: userId,
    stripe_customer_id: checkoutSession.customer as string,
    stripe_subscription_id: stripeSubscription.id,
    stripe_price_id: stripeSubscription.items.data[0]?.price.id,
    status: stripeSubscription.status === 'trialing' ? 'trialing' : 'active',
    current_period_start: periodStart,
    current_period_end: periodEnd,
  }

  if (existingSub) {
    await getSupabaseAdmin().from('subscriptions').update(subscriptionData).eq('id', existingSub.id)
  } else {
    await getSupabaseAdmin().from('subscriptions').insert(subscriptionData)
  }

  // Reactivate existing session or use new code
  const { data: existingSession } = await getSupabaseAdmin()
    .from('sessions')
    .select('code')
    .eq('user_id', userId)
    .single()

  let userSessionCode = sessionCode
  if (existingSession) {
    await getSupabaseAdmin().from('sessions').update({ is_active: true }).eq('user_id', userId)
    userSessionCode = existingSession.code
  }

  // Generate invoice for existing user
  let invoiceData: { pdfBuffer: Uint8Array; invoiceNumber: string } | undefined
  if (email) {
    try {
      const invoiceNumber = await generateInvoiceNumber()
      const customerName = checkoutSession.customer_details?.name || ''

      const pdfBuffer = await generateInvoicePDF({
        invoiceNumber,
        date: new Date(),
        customerName,
        customerEmail: email,
        amount: PRICE,
        stripePaymentId: checkoutSession.payment_intent as string || undefined,
      })

      // Save invoice to database and storage
      await saveInvoice({
        userId,
        invoiceNumber,
        amount: PRICE,
        stripePaymentId: checkoutSession.payment_intent as string || undefined,
        pdfBuffer,
      })

      invoiceData = { pdfBuffer, invoiceNumber }
      console.log(`[Webhook] Invoice ${invoiceNumber} generated for returning user ${email}`)
    } catch (invoiceError) {
      console.error('[Webhook] Invoice generation failed for existing user:', invoiceError)
      // Continue without invoice - don't block the welcome email
    }

    // Send email with invoice attached
    await sendWelcomeEmail({ to: email, password: newPassword, sessionCode: userSessionCode, invoice: invoiceData })
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription & { current_period_start: number; current_period_end: number }) {
  const { data } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('id, user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (!data) return

  const now = new Date()
  const defaultEnd = getDefaultPeriodEnd()
  const periodStart = safeTimestampToISO(subscription.current_period_start, now)
  const periodEnd = safeTimestampToISO(subscription.current_period_end, defaultEnd)
  const canceledAt = subscription.canceled_at ? safeTimestampToISO(subscription.canceled_at) : null

  await getSupabaseAdmin()
    .from('subscriptions')
    .update({
      status: subscription.status as 'active' | 'trialing' | 'canceled' | 'expired' | 'past_due',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: canceledAt,
    })
    .eq('id', data.id)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { data } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('id, user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (!data) return

  await getSupabaseAdmin().from('subscriptions').update({ status: 'expired' }).eq('id', data.id)
  await getSupabaseAdmin().from('sessions').update({ is_active: false }).eq('user_id', data.user_id)

  const { data: profile } = await getSupabaseAdmin()
    .from('user_profiles')
    .select('email')
    .eq('id', data.user_id)
    .single()

  if (profile?.email) {
    await sendExpiredEmail({ to: profile.email })
  }
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

  await getSupabaseAdmin().from('subscriptions').update({ status: 'past_due' }).eq('id', data.id)
}
