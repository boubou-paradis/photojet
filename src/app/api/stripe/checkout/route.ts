import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, STRIPE_PRICE_ID, STRIPE_PRICE_ID_ANNUAL, STRIPE_PRICE_ID_WEEKEND_PASS } from '@/lib/stripe'
import { buildSubscriptionCheckout, CheckoutError } from '@/lib/billing/checkout'
import type { Plan } from '@/lib/billing/plans'
import { isWeekendPassAvailable } from '@/lib/weekend-pass'
import { createClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build-time errors
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  // Migration Stripe terminée - Paiements actifs
  const PAYMENTS_ENABLED = true
  if (!PAYMENTS_ENABLED) {
    return NextResponse.json(
      { error: 'Les inscriptions ouvrent bientôt ! Revenez dans quelques heures.' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { email, promoCode, productType } = body

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    // ---- PASS WEEK-END (one-time payment) ----
    if (productType === 'weekend_pass') {
      if (!isWeekendPassAvailable()) {
        return NextResponse.json(
          { error: 'Le pass week-end est disponible uniquement du vendredi 12h au lundi 12h.' },
          { status: 400 }
        )
      }
      if (!STRIPE_PRICE_ID_WEEKEND_PASS) {
        return NextResponse.json({ error: 'Pass week-end non configuré' }, { status: 500 })
      }
      const passSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [{ price: STRIPE_PRICE_ID_WEEKEND_PASS, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?canceled=true`,
        metadata: { email, productType: 'weekend_pass' },
      })
      return NextResponse.json({ url: passSession.url })
    }

    // ---- ABONNEMENT MENSUEL OU ANNUEL (subscription) ----
    const plan: Plan = productType === 'annual' ? 'annual' : 'monthly'
    const priceId = plan === 'annual' ? STRIPE_PRICE_ID_ANNUAL : STRIPE_PRICE_ID
    if (!priceId) {
      return NextResponse.json(
        { error: plan === 'annual' ? 'Abonnement annuel non configuré' : 'Stripe non configure' },
        { status: 500 }
      )
    }

    let sessionParams: Stripe.Checkout.SessionCreateParams
    try {
      sessionParams = await buildSubscriptionCheckout(
        {
          plan,
          email,
          promoCode,
          priceId,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
          annualValidationCode: process.env.STRIPE_ANNUAL_VALIDATION_CODE || null,
        },
        {
          findSitePromo: async (code) => {
            const { data } = await getSupabaseAdmin()
              .from('promo_codes')
              .select('*')
              .eq('code', code)
              .eq('is_active', true)
              .single()
            return data ? { type: data.type, value: data.value } : null
          },
          isAffiliateCode: async (code) => {
            const { data } = await getSupabaseAdmin()
              .from('affiliates')
              .select('id')
              // Sans tenir compte de la casse, jokers % et _ neutralisés
              .ilike('promo_code', code.replace(/[\\%_]/g, (c) => `\\${c}`))
              .eq('is_active', true)
              .limit(1)
            return !!(data && data.length > 0)
          },
          createCoupon: async (params) => (await stripe.coupons.create(params)).id,
          findPromotionCodeId: async (code) => {
            const list = await stripe.promotionCodes.list({ code, active: true, limit: 1 })
            return list.data[0]?.id ?? null
          },
        }
      )
    } catch (err) {
      if (err instanceof CheckoutError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      throw err
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[Stripe Checkout] Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la creation de la session de paiement' },
      { status: 500 }
    )
  }
}
