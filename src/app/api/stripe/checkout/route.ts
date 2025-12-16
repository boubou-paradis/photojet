import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, promoCode } = body

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    if (!STRIPE_PRICE_ID) {
      return NextResponse.json({ error: 'Stripe non configure' }, { status: 500 })
    }

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?canceled=true`,
      metadata: {
        email,
        promoCode: promoCode || '',
      },
      subscription_data: {
        metadata: {
          email,
        },
      },
    }

    // Apply promo code if provided
    if (promoCode) {
      // Check if promo code is valid
      const { data: promo } = await supabaseAdmin
        .from('promo_codes')
        .select('*')
        .eq('code', promoCode.toUpperCase())
        .eq('is_active', true)
        .single()

      if (promo) {
        if (promo.type === 'trial') {
          // Add trial period
          sessionParams.subscription_data!.trial_period_days = promo.value
        } else if (promo.type === 'percent') {
          // Create a Stripe coupon for percentage discount
          const coupon = await stripe.coupons.create({
            percent_off: promo.value,
            duration: 'once',
            name: `Promo ${promoCode.toUpperCase()}`,
          })
          sessionParams.discounts = [{ coupon: coupon.id }]
        } else if (promo.type === 'fixed') {
          // Create a Stripe coupon for fixed amount discount
          const coupon = await stripe.coupons.create({
            amount_off: promo.value,
            currency: 'eur',
            duration: 'once',
            name: `Promo ${promoCode.toUpperCase()}`,
          })
          sessionParams.discounts = [{ coupon: coupon.id }]
        }
      }
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
