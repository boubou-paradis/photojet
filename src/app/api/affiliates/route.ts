import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAffiliateAdminAccess } from '@/lib/affiliates'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/affiliates — Liste tous les affiliés
export async function GET(request: NextRequest) {
  const pin = request.headers.get('x-admin-pin')
  const access = verifyAffiliateAdminAccess(pin)
  if (!access.authorized) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('affiliates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Affiliates GET] Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération' }, { status: 500 })
  }

  return NextResponse.json({ affiliates: data })
}

// POST /api/affiliates — Créer un nouvel affilié
export async function POST(request: NextRequest) {
  const pin = request.headers.get('x-admin-pin')
  const access = verifyAffiliateAdminAccess(pin)
  if (!access.authorized) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  try {
    const { name, email, promo_code } = await request.json()

    if (!name || !email || !promo_code) {
      return NextResponse.json({ error: 'Nom, email et code promo requis' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('affiliates')
      .insert({
        name,
        email,
        promo_code: promo_code.toUpperCase(),
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Email ou code promo déjà existant' }, { status: 409 })
      }
      console.error('[Affiliates POST] Error:', error)
      return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
    }

    return NextResponse.json({ affiliate: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }
}
