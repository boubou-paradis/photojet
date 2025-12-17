import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe, generatePassword, generateSessionCode } from '@/lib/stripe'
import { sendWelcomeEmail, sendExpiredEmail } from '@/lib/resend'
import { createClient } from '@supabase/supabase-js'

// Helper function to safely convert Stripe timestamp to ISO string
function safeTimestampToISO(
  timestamp: number | null | undefined,
  fieldName: string,
  fallbackDate?: Date
): string {
  console.log(`[Date] Converting ${fieldName}:`, timestamp, `(type: ${typeof timestamp})`)

  // If timestamp is missing or invalid, use fallback
  if (timestamp === null || timestamp === undefined || timestamp === 0) {
    const fallback = fallbackDate || new Date()
    console.log(`[Date] ${fieldName} is null/undefined/0, using fallback:`, fallback.toISOString())
    return fallback.toISOString()
  }

  if (typeof timestamp !== 'number' || isNaN(timestamp)) {
    const fallback = fallbackDate || new Date()
    console.error(`[Date] ${fieldName} is not a valid number:`, typeof timestamp, timestamp)
    console.log(`[Date] Using fallback:`, fallback.toISOString())
    return fallback.toISOString()
  }

  // Stripe timestamps are in seconds, convert to milliseconds
  const milliseconds = timestamp * 1000
  const date = new Date(milliseconds)

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    const fallback = fallbackDate || new Date()
    console.error(`[Date] ${fieldName} produced invalid date. Timestamp:`, timestamp, 'Milliseconds:', milliseconds)
    console.log(`[Date] Using fallback:`, fallback.toISOString())
    return fallback.toISOString()
  }

  const isoString = date.toISOString()
  console.log(`[Date] ${fieldName} converted successfully:`, isoString)
  return isoString
}

// Helper to create fallback end date (30 days from now)
function getDefaultPeriodEnd(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
}

// Lazy initialization to avoid build-time errors
const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log('[Supabase] Checking configuration...')
  console.log('[Supabase] - URL:', url ? `${url.substring(0, 30)}...` : '(NOT SET)')
  console.log('[Supabase] - Service key:', key ? `${key.substring(0, 20)}...` : '(NOT SET)')

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  // Check if key looks like a placeholder
  if (key === 'your_service_role_key_here' || key.length < 50) {
    console.error('[Supabase] WARNING: Service key appears to be a placeholder or invalid!')
    throw new Error('SUPABASE_SERVICE_ROLE_KEY appears to be invalid - please set the real key')
  }

  console.log('[Supabase] Configuration OK, creating client...')
  return createClient(url, key)
}

// Generate a unique session code (checks database for duplicates)
async function generateUniqueSessionCode(): Promise<string> {
  const maxAttempts = 10

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateSessionCode()
    console.log(`[Code] Attempt ${attempt + 1}: Generated code ${code}`)

    // Check if code already exists
    const { data: existing } = await getSupabaseAdmin()
      .from('sessions')
      .select('id')
      .eq('code', code)
      .single()

    if (!existing) {
      console.log(`[Code] Code ${code} is unique!`)
      return code
    }

    console.log(`[Code] Code ${code} already exists, regenerating...`)
  }

  // Fallback: add timestamp suffix to make it unique
  const fallbackCode = generateSessionCode() + Date.now().toString(36).slice(-2).toUpperCase()
  console.log(`[Code] Max attempts reached, using fallback: ${fallbackCode}`)
  return fallbackCode
}

export async function POST(request: NextRequest) {
  console.log('[Webhook] POST received')

  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    console.error('[Webhook] No signature in headers')
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  console.log('[Webhook] Signature present, verifying...')

  let event: Stripe.Event

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    console.log('[Webhook] Webhook secret configured:', !!webhookSecret)

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured')
    }

    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    console.log('[Webhook] Signature verified successfully')
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log('[Webhook] Event received:', event.type)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('[Webhook] Processing checkout.session.completed')
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        console.log('[Webhook] checkout.session.completed handled successfully')
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
    console.error('[Webhook] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json({
      error: 'Webhook handler failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('[Webhook] ========================================')
  console.log('[Webhook] === handleCheckoutCompleted START ===')
  console.log('[Webhook] ========================================')

  try {
    // Step 0: Log ALL session data for debugging
    console.log('[Webhook] Step 0: Dumping session data...')
    console.log('[Webhook] - session.id:', session.id)
    console.log('[Webhook] - session.customer:', session.customer)
    console.log('[Webhook] - session.subscription:', session.subscription)
    console.log('[Webhook] - session.customer_email:', session.customer_email)
    console.log('[Webhook] - session.customer_details:', JSON.stringify(session.customer_details, null, 2))
    console.log('[Webhook] - session.metadata:', JSON.stringify(session.metadata, null, 2))
    console.log('[Webhook] - session.mode:', session.mode)
    console.log('[Webhook] - session.payment_status:', session.payment_status)

    // Try to get email from multiple sources
    const emailFromCustomerEmail = session.customer_email
    const emailFromCustomerDetails = session.customer_details?.email
    const emailFromMetadata = session.metadata?.email

    console.log('[Webhook] Email sources found:')
    console.log('[Webhook] - customer_email:', emailFromCustomerEmail || '(null)')
    console.log('[Webhook] - customer_details.email:', emailFromCustomerDetails || '(null)')
    console.log('[Webhook] - metadata.email:', emailFromMetadata || '(null)')

    // Use the first available email (prioritize customer_details as it's filled by customer)
    const email = emailFromCustomerDetails || emailFromCustomerEmail || emailFromMetadata
    const promoCode = session.metadata?.promoCode

    if (!email) {
      console.error('[Webhook] CRITICAL ERROR: No email found in any source!')
      throw new Error('No email found in checkout session - check Stripe checkout configuration')
    }

    console.log('[Webhook] ✓ Using email:', email)

    // Step 1: Get subscription details from Stripe
    console.log('[Webhook] Step 1: Getting subscription details...')
    console.log('[Webhook] - Subscription ID:', session.subscription)

    if (!session.subscription) {
      console.error('[Webhook] Step 1: FAILED - No subscription ID in session!')
      throw new Error('No subscription ID in checkout session')
    }

    let stripeSubscription: Stripe.Subscription & { current_period_start: number; current_period_end: number }

    try {
      console.log('[Webhook] Step 1: Calling stripe.subscriptions.retrieve()...')
      const stripeSubscriptionResponse = await stripe.subscriptions.retrieve(
        session.subscription as string
      )
      stripeSubscription = stripeSubscriptionResponse as unknown as Stripe.Subscription & {
        current_period_start: number
        current_period_end: number
      }
      console.log('[Webhook] Step 1: SUCCESS')
      console.log('[Webhook] - Retrieved subscription:', stripeSubscription.id)
      console.log('[Webhook] - Status:', stripeSubscription.status)
      console.log('[Webhook] - Period start:', stripeSubscription.current_period_start)
      console.log('[Webhook] - Period end:', stripeSubscription.current_period_end)
    } catch (err) {
      console.error('[Webhook] Step 1: FAILED')
      console.error('[Webhook] - Error type:', err instanceof Error ? err.constructor.name : typeof err)
      console.error('[Webhook] - Error message:', err instanceof Error ? err.message : String(err))
      throw err
    }

    // Step 2: Generate password and unique session code
    console.log('[Webhook] Step 2: Generating credentials...')
    const password = generatePassword()
    const sessionCode = await generateUniqueSessionCode()
    console.log('[Webhook] Step 2: SUCCESS - Password length:', password.length, 'Session code:', sessionCode)

    // Step 3: Create user in Supabase Auth
    console.log('[Webhook] Step 3: Creating user in Supabase Auth...')
    console.log('[Webhook] - Email to create:', email)
    let userId: string

    try {
      console.log('[Webhook] Step 3a: Getting Supabase admin client...')
      const supabase = getSupabaseAdmin()
      console.log('[Webhook] Step 3a: SUCCESS - Supabase client created')

      console.log('[Webhook] Step 3b: Calling auth.admin.createUser()...')
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (authError) {
        console.log('[Webhook] Step 3b: User creation returned error')
        console.log('[Webhook] - Error code:', authError.code)
        console.log('[Webhook] - Error message:', authError.message)
        console.log('[Webhook] - Error status:', authError.status)

        // Try to get existing user
        console.log('[Webhook] Step 3c: Checking if user already exists...')
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()

        if (listError) {
          console.error('[Webhook] Step 3c: listUsers failed:', listError.message)
          throw listError
        }

        console.log('[Webhook] Step 3c: Found', existingUsers?.users?.length || 0, 'total users')
        const existingUser = existingUsers?.users?.find(u => u.email === email)

        if (existingUser) {
          console.log('[Webhook] Step 3c: SUCCESS - Found existing user:', existingUser.id)
          console.log('[Webhook] Delegating to updateExistingUser()...')
          await updateExistingUser(existingUser.id, stripeSubscription, session, sessionCode, promoCode)
          console.log('[Webhook] === handleCheckoutCompleted END (existing user path) ===')
          return
        }

        console.error('[Webhook] Step 3: FAILED - User does not exist and creation failed')
        throw authError
      }

      userId = authData.user.id
      console.log('[Webhook] Step 3: SUCCESS - New user created')
      console.log('[Webhook] - User ID:', userId)
    } catch (err) {
      console.error('[Webhook] Step 3: EXCEPTION')
      console.error('[Webhook] - Error type:', err instanceof Error ? err.constructor.name : typeof err)
      console.error('[Webhook] - Error message:', err instanceof Error ? err.message : String(err))
      if (err instanceof Error && err.stack) {
        console.error('[Webhook] - Stack:', err.stack.split('\n').slice(0, 3).join('\n'))
      }
      throw err
    }

    // Step 4: Create user profile
    console.log('[Webhook] Step 4: Creating user profile...')
    console.log('[Webhook] - User ID:', userId)
    console.log('[Webhook] - Email:', email)
    try {
      const { data: profileData, error: profileError } = await getSupabaseAdmin().from('user_profiles').insert({
        id: userId,
        email,
        role: 'user',
      }).select()
      if (profileError) {
        console.error('[Webhook] Step 4: Profile insert error')
        console.error('[Webhook] - Code:', profileError.code)
        console.error('[Webhook] - Message:', profileError.message)
        console.error('[Webhook] - Details:', profileError.details)
        // Continue anyway, profile might already exist
      } else {
        console.log('[Webhook] Step 4: SUCCESS - Profile created')
        console.log('[Webhook] - Profile data:', JSON.stringify(profileData))
      }
    } catch (err) {
      console.error('[Webhook] Step 4: EXCEPTION (non-fatal)')
      console.error('[Webhook] - Error:', err instanceof Error ? err.message : String(err))
      // Don't throw, continue
    }

    // Step 5: Handle promo code (optional)
    let promoCodeId: string | null = null
    if (promoCode) {
      console.log('[Webhook] Step 5: Processing promo code:', promoCode)
      try {
        const { data: promo, error: promoError } = await getSupabaseAdmin()
          .from('promo_codes')
          .select('id')
          .eq('code', promoCode.toUpperCase())
          .single()

        if (promoError) {
          console.log('[Webhook] Step 5: Promo code lookup failed:', promoError.message)
        } else if (promo) {
          promoCodeId = promo.id
          console.log('[Webhook] Step 5: Found promo code ID:', promoCodeId)
          await getSupabaseAdmin().from('promo_code_uses').insert({
            promo_code_id: promo.id,
            user_id: userId,
          })
          console.log('[Webhook] Step 5: SUCCESS - Promo code applied')
        }
      } catch (err) {
        console.error('[Webhook] Step 5: EXCEPTION (non-fatal):', err instanceof Error ? err.message : String(err))
      }
    } else {
      console.log('[Webhook] Step 5: SKIPPED - No promo code provided')
    }

    // Step 6: Create subscription record
    console.log('[Webhook] Step 6: Creating subscription record...')
    console.log('[Webhook] Step 6: Raw Stripe subscription object:')
    console.log('[Webhook] - subscription.id:', stripeSubscription.id)
    console.log('[Webhook] - subscription.status:', stripeSubscription.status)
    console.log('[Webhook] - current_period_start:', stripeSubscription.current_period_start, `(type: ${typeof stripeSubscription.current_period_start})`)
    console.log('[Webhook] - current_period_end:', stripeSubscription.current_period_end, `(type: ${typeof stripeSubscription.current_period_end})`)
    console.log('[Webhook] - trial_start:', stripeSubscription.trial_start)
    console.log('[Webhook] - trial_end:', stripeSubscription.trial_end)

    // Convert dates with fallbacks (now = start, now+30days = end)
    const now = new Date()
    const defaultEnd = getDefaultPeriodEnd()

    const periodStart = safeTimestampToISO(stripeSubscription.current_period_start, 'current_period_start', now)
    const periodEnd = safeTimestampToISO(stripeSubscription.current_period_end, 'current_period_end', defaultEnd)

    // Trial dates are optional - use null if not present
    const hasTrialStart = stripeSubscription.trial_start !== null && stripeSubscription.trial_start !== undefined
    const hasTrialEnd = stripeSubscription.trial_end !== null && stripeSubscription.trial_end !== undefined
    const trialStart = hasTrialStart ? safeTimestampToISO(stripeSubscription.trial_start, 'trial_start') : null
    const trialEnd = hasTrialEnd ? safeTimestampToISO(stripeSubscription.trial_end, 'trial_end') : null

    console.log('[Webhook] Step 6: Converted dates:')
    console.log('[Webhook] - periodStart:', periodStart)
    console.log('[Webhook] - periodEnd:', periodEnd)
    console.log('[Webhook] - trialStart:', trialStart)
    console.log('[Webhook] - trialEnd:', trialEnd)

    const subscriptionPayload = {
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
    }
    console.log('[Webhook] Step 6: Payload:', JSON.stringify(subscriptionPayload, null, 2))

    let subscriptionData: { id: string } | null = null
    try {
      const { data, error } = await getSupabaseAdmin()
        .from('subscriptions')
        .insert(subscriptionPayload)
        .select()
        .single()

      if (error) {
        console.error('[Webhook] Step 6: Subscription insert FAILED')
        console.error('[Webhook] - Code:', error.code)
        console.error('[Webhook] - Message:', error.message)
        console.error('[Webhook] - Details:', error.details)
        console.error('[Webhook] - Hint:', error.hint)
        throw error
      }
      subscriptionData = data
      console.log('[Webhook] Step 6: SUCCESS - Subscription ID:', data?.id)
    } catch (err) {
      console.error('[Webhook] Step 6: EXCEPTION')
      console.error('[Webhook] - Error:', err instanceof Error ? err.message : String(err))
      throw err
    }

    // Step 7: Create AnimaJet session
    console.log('[Webhook] Step 7: Creating AnimaJet session...')
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    const sessionPayload = {
      code: sessionCode,
      name: 'Mon evenement',
      expires_at: expiresAt.toISOString(),
      user_id: userId,
      subscription_id: subscriptionData?.id,
      moderation_enabled: true,
      is_active: true,
    }
    console.log('[Webhook] Step 7: Payload:', JSON.stringify(sessionPayload, null, 2))

    try {
      const { data: sessionData, error: sessionError } = await getSupabaseAdmin()
        .from('sessions')
        .insert(sessionPayload)
        .select()

      if (sessionError) {
        console.error('[Webhook] Step 7: Session insert FAILED')
        console.error('[Webhook] - Code:', sessionError.code)
        console.error('[Webhook] - Message:', sessionError.message)
        console.error('[Webhook] - Details:', sessionError.details)
        console.error('[Webhook] - Hint:', sessionError.hint)
        throw sessionError
      }
      console.log('[Webhook] Step 7: SUCCESS')
      console.log('[Webhook] - Session code:', sessionCode)
      console.log('[Webhook] - Session data:', JSON.stringify(sessionData))
    } catch (err) {
      console.error('[Webhook] Step 7: EXCEPTION')
      console.error('[Webhook] - Error:', err instanceof Error ? err.message : String(err))
      throw err
    }

    // Step 8: Send welcome email
    console.log('[Webhook] Step 8: Sending welcome email...')
    console.log('[Webhook] - To:', email)
    console.log('[Webhook] - Session code:', sessionCode)
    console.log('[Webhook] - Password length:', password.length)
    try {
      const emailResult = await sendWelcomeEmail({
        to: email,
        password,
        sessionCode,
      })
      console.log('[Webhook] Step 8: Result:', JSON.stringify(emailResult))
      if (emailResult.success) {
        console.log('[Webhook] Step 8: SUCCESS - Email sent!')
      } else {
        console.log('[Webhook] Step 8: Email NOT sent (but not fatal)')
        console.log('[Webhook] - Reason:', emailResult.error)
      }
    } catch (err) {
      console.error('[Webhook] Step 8: EXCEPTION (non-fatal)')
      console.error('[Webhook] - Error:', err instanceof Error ? err.message : String(err))
      // Don't throw, email failure shouldn't fail the webhook
    }

    console.log('[Webhook] ========================================')
    console.log('[Webhook] === handleCheckoutCompleted SUCCESS ===')
    console.log('[Webhook] ========================================')
    console.log('[Webhook] Summary:')
    console.log('[Webhook] - User email:', email)
    console.log('[Webhook] - User ID:', userId)
    console.log('[Webhook] - Session code:', sessionCode)
    console.log('[Webhook] - Subscription ID:', subscriptionData?.id)

  } catch (error) {
    console.error('[Webhook] ========================================')
    console.error('[Webhook] === handleCheckoutCompleted FAILED ===')
    console.error('[Webhook] ========================================')
    console.error('[Webhook] Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('[Webhook] Error message:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error('[Webhook] Stack trace:', error.stack)
    }
    throw error
  }
}

async function updateExistingUser(
  userId: string,
  stripeSubscription: Stripe.Subscription & { current_period_start: number; current_period_end: number },
  checkoutSession: Stripe.Checkout.Session,
  sessionCode: string,
  promoCode?: string
) {
  console.log('[Webhook] === updateExistingUser START ===')
  console.log('[Webhook] User ID:', userId)

  try {
    // Get user email
    const { data: profile } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single()

    const email = profile?.email || checkoutSession.customer_email
    console.log('[Webhook] User email:', email)

    // Generate new password
    const newPassword = generatePassword()
    console.log('[Webhook] New password generated')

    // Update user password
    const { error: updateError } = await getSupabaseAdmin().auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error('[Webhook] Error updating password:', updateError)
    } else {
      console.log('[Webhook] Password updated')
    }

    // Update or create subscription
    const { data: existingSub } = await getSupabaseAdmin()
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .single()

    console.log('[Webhook] updateExistingUser: Converting dates...')
    console.log('[Webhook] - Raw current_period_start:', stripeSubscription.current_period_start, `(type: ${typeof stripeSubscription.current_period_start})`)
    console.log('[Webhook] - Raw current_period_end:', stripeSubscription.current_period_end, `(type: ${typeof stripeSubscription.current_period_end})`)

    const now = new Date()
    const defaultEnd = getDefaultPeriodEnd()
    const periodStart = safeTimestampToISO(stripeSubscription.current_period_start, 'current_period_start', now)
    const periodEnd = safeTimestampToISO(stripeSubscription.current_period_end, 'current_period_end', defaultEnd)

    console.log('[Webhook] - Converted periodStart:', periodStart)
    console.log('[Webhook] - Converted periodEnd:', periodEnd)

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
      await getSupabaseAdmin()
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', existingSub.id)
      console.log('[Webhook] Subscription updated')
    } else {
      await getSupabaseAdmin().from('subscriptions').insert(subscriptionData)
      console.log('[Webhook] Subscription created')
    }

    // Get existing session code
    const { data: existingSession } = await getSupabaseAdmin()
      .from('sessions')
      .select('code')
      .eq('user_id', userId)
      .single()

    let userSessionCode = sessionCode
    if (existingSession) {
      await getSupabaseAdmin()
        .from('sessions')
        .update({ is_active: true })
        .eq('user_id', userId)
      userSessionCode = existingSession.code
      console.log('[Webhook] Existing session reactivated:', userSessionCode)
    }

    // Send welcome email
    if (email) {
      console.log('[Webhook] Sending reactivation email to:', email)
      const emailResult = await sendWelcomeEmail({
        to: email,
        password: newPassword,
        sessionCode: userSessionCode,
      })
      console.log('[Webhook] Email result:', JSON.stringify(emailResult))
    }

    console.log('[Webhook] === updateExistingUser END ===')
  } catch (error) {
    console.error('[Webhook] === updateExistingUser FAILED ===')
    console.error('[Webhook] Error:', error)
    throw error
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription & { current_period_start: number; current_period_end: number }) {
  console.log('[Webhook] handleSubscriptionUpdated:', subscription.id)
  console.log('[Webhook] - Raw current_period_start:', subscription.current_period_start, `(type: ${typeof subscription.current_period_start})`)
  console.log('[Webhook] - Raw current_period_end:', subscription.current_period_end, `(type: ${typeof subscription.current_period_end})`)
  console.log('[Webhook] - Raw canceled_at:', subscription.canceled_at)

  const { data } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('id, user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (!data) {
    console.log('[Webhook] Subscription not found in DB, skipping')
    return
  }

  console.log('[Webhook] Converting subscription dates...')
  const now = new Date()
  const defaultEnd = getDefaultPeriodEnd()

  const periodStart = safeTimestampToISO(subscription.current_period_start, 'current_period_start', now)
  const periodEnd = safeTimestampToISO(subscription.current_period_end, 'current_period_end', defaultEnd)

  // canceled_at is optional - only convert if present
  const hasCanceledAt = subscription.canceled_at !== null && subscription.canceled_at !== undefined
  const canceledAt = hasCanceledAt ? safeTimestampToISO(subscription.canceled_at, 'canceled_at') : null

  console.log('[Webhook] - Converted periodStart:', periodStart)
  console.log('[Webhook] - Converted periodEnd:', periodEnd)
  console.log('[Webhook] - Converted canceledAt:', canceledAt)

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

  console.log('[Webhook] Subscription updated:', subscription.id)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { data } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('id, user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (!data) return

  await getSupabaseAdmin()
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('id', data.id)

  await getSupabaseAdmin()
    .from('sessions')
    .update({ is_active: false })
    .eq('user_id', data.user_id)

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
