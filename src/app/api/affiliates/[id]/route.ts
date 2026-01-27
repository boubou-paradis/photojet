import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'
import { verifyAffiliateAdminAccess } from '@/lib/affiliates'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/affiliates/[id] — Détail d'un affilié avec ses filleuls
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pin = request.headers.get('x-admin-pin')
  const access = verifyAffiliateAdminAccess(pin)
  if (!access.authorized) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  const { id } = await params

  const supabase = getSupabaseAdmin()
  const { data: affiliate, error } = await supabase
    .from('affiliates')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !affiliate) {
    return NextResponse.json({ error: 'Affilié non trouvé' }, { status: 404 })
  }

  // Récupérer les filleuls via Stripe
  const stripe = getStripe()
  const referrals: Array<{
    customer_email: string
    customer_name: string
    status: string
    created: string
    subscription_id: string
  }> = []

  // Parcourir toutes les checkout sessions pour trouver celles avec ce code promo
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
      const sessionPromoCode = session.metadata?.promoCode?.toUpperCase()
      if (sessionPromoCode === affiliate.promo_code) {
        const sub = session.subscription as import('stripe').Stripe.Subscription | null
        const subStatus = sub && typeof sub === 'object' ? sub.status : 'unknown'

        referrals.push({
          customer_email: session.customer_email || session.customer_details?.email || 'N/A',
          customer_name: session.customer_details?.name || 'N/A',
          status: subStatus,
          created: sub && typeof sub === 'object' ? new Date(sub.created * 1000).toISOString() : session.created ? new Date(session.created * 1000).toISOString() : 'N/A',
          subscription_id: sub && typeof sub === 'object' ? sub.id : 'N/A',
        })
      }
    }

    hasMore = sessions.has_more
    if (sessions.data.length > 0) {
      startingAfter = sessions.data[sessions.data.length - 1].id
    } else {
      hasMore = false
    }
  }

  return NextResponse.json({
    affiliate,
    referrals,
    active_count: referrals.filter(r => r.status === 'active' || r.status === 'trialing').length,
  })
}
