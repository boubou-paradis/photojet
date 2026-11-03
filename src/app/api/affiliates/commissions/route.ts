import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'
import { verifyAffiliateAdminAccess, calculateCommissionFromMonthlyCents, SUBSCRIPTION_PRICE_EUR } from '@/lib/affiliates'
import { monthlyEquivalentCents } from '@/lib/billing/plans'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/affiliates/commissions — Calcul des commissions pour tous les affiliés
export async function GET(request: NextRequest) {
  const pin = request.headers.get('x-admin-pin')
  const access = verifyAffiliateAdminAccess(pin)
  if (!access.authorized) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  // 1. Récupérer tous les affiliés actifs
  const supabase = getSupabaseAdmin()
  const { data: affiliates, error } = await supabase
    .from('affiliates')
    .select('*')
    .eq('is_active', true)

  if (error) {
    console.error('[Commissions] Error fetching affiliates:', error)
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
  }

  if (!affiliates || affiliates.length === 0) {
    return NextResponse.json({ commissions: [] })
  }

  // 2. Construire un map code promo -> affiliate
  const promoCodeMap = new Map<string, { id: string; name: string; email: string; promo_code: string }>()
  for (const a of affiliates) {
    promoCodeMap.set(a.promo_code.toUpperCase(), a)
  }

  // 3. Parcourir toutes les checkout sessions Stripe pour compter les filleuls actifs
  const stripe = getStripe()
  // code promo -> équivalent mensuel (centimes) de chaque filleul actif
  const activeCentsMap = new Map<string, number[]>()

  let hasMore = true
  let startingAfter: string | undefined

  while (hasMore) {
    const listParams: Record<string, unknown> = {
      limit: 100,
      expand: ['data.subscription'],
    }
    if (startingAfter) {
      listParams.starting_after = startingAfter
    }

    const sessions = await stripe.checkout.sessions.list(listParams as Parameters<typeof stripe.checkout.sessions.list>[0])

    for (const session of sessions.data) {
      const promoCode = session.metadata?.promoCode?.toUpperCase()
      if (promoCode && promoCodeMap.has(promoCode)) {
        const sub = session.subscription as import('stripe').Stripe.Subscription | null
        if (sub && typeof sub === 'object' && (sub.status === 'active' || sub.status === 'trialing')) {
          const price = sub.items?.data?.[0]?.price
          // Mensuel : base historique 29,90 € inchangée. Annuel : prix réel / 12.
          const cents = price?.recurring?.interval === 'year' && typeof price.unit_amount === 'number'
            ? monthlyEquivalentCents(price.unit_amount, 'year', price.recurring.interval_count)
            : Math.round(SUBSCRIPTION_PRICE_EUR * 100)
          const current = activeCentsMap.get(promoCode) || []
          activeCentsMap.set(promoCode, [...current, cents])
        }
      }
    }

    hasMore = sessions.has_more
    if (sessions.data.length > 0) {
      startingAfter = sessions.data[sessions.data.length - 1].id
    } else {
      hasMore = false
    }
  }

  // 4. Construire le résultat avec les commissions calculées
  const commissions = affiliates.map(a => {
    const cents = activeCentsMap.get(a.promo_code.toUpperCase()) || []
    const activeCount = cents.length
    return {
      affiliate_id: a.id,
      name: a.name,
      email: a.email,
      promo_code: a.promo_code,
      active_referrals: activeCount,
      commission_due: calculateCommissionFromMonthlyCents(cents),
    }
  })

  return NextResponse.json({ commissions })
}
