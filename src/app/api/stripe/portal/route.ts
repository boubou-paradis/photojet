import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('[Stripe Portal] Auth error:', authError)
      return NextResponse.json({ error: `Erreur auth: ${authError.message}` }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non connecté' }, { status: 401 })
    }

    console.log('[Stripe Portal] User ID:', user.id)

    // Get user's subscription to find Stripe customer ID
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (subError) {
      console.error('[Stripe Portal] Subscription error:', subError)
      return NextResponse.json({ error: `Erreur abonnement: ${subError.message}` }, { status: 404 })
    }

    if (!subscription?.stripe_customer_id) {
      console.error('[Stripe Portal] No customer ID found')
      return NextResponse.json({ error: 'Aucun ID client Stripe trouvé' }, { status: 404 })
    }

    console.log('[Stripe Portal] Customer ID:', subscription.stripe_customer_id)

    // Create Stripe Customer Portal session
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/dashboard`
    console.log('[Stripe Portal] Return URL:', returnUrl)

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('[Stripe Portal] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: `Erreur Stripe: ${errorMessage}` },
      { status: 500 }
    )
  }
}
