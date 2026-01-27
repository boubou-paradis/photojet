import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAffiliateAdminAccess } from '@/lib/affiliates'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/affiliates/payments?affiliate_id=xxx — Historique des paiements
export async function GET(request: NextRequest) {
  const pin = request.headers.get('x-admin-pin')
  const access = await verifyAffiliateAdminAccess(pin)
  if (!access.authorized) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  const affiliateId = request.nextUrl.searchParams.get('affiliate_id')

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('affiliate_payments')
    .select('*, affiliates(name, email, promo_code)')
    .order('paid_at', { ascending: false })

  if (affiliateId) {
    query = query.eq('affiliate_id', affiliateId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Payments GET] Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération' }, { status: 500 })
  }

  return NextResponse.json({ payments: data })
}

// POST /api/affiliates/payments — Marquer comme payé
export async function POST(request: NextRequest) {
  const pin = request.headers.get('x-admin-pin')
  const access = await verifyAffiliateAdminAccess(pin)
  if (!access.authorized) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  try {
    const { affiliate_id, amount } = await request.json()

    if (!affiliate_id || amount === undefined || amount <= 0) {
      return NextResponse.json({ error: 'affiliate_id et montant positif requis' }, { status: 400 })
    }

    // Période = mois en cours (format YYYY-MM)
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('affiliate_payments')
      .insert({
        affiliate_id,
        amount,
        period,
      })
      .select()
      .single()

    if (error) {
      console.error('[Payments POST] Error:', error)
      return NextResponse.json({ error: 'Erreur lors de l\'enregistrement' }, { status: 500 })
    }

    return NextResponse.json({ payment: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }
}
