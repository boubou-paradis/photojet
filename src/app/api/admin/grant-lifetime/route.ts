// Grant lifetime access to a user (role=owner + active subscription until 2099)
// Usage: GET /api/admin/grant-lifetime?email=user@example.com&secret=ADMIN_SECRET_PIN

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.ADMIN_SECRET_PIN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const normalizedEmail = email.toLowerCase().trim()

  // ── 1. Find or create auth user ──────────────────────────────
  let userId: string | null = null
  let userCreated = false

  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existing = authUsers?.users?.find(u => u.email?.toLowerCase() === normalizedEmail)

  if (existing) {
    userId = existing.id
    // Ensure not banned
    await supabase.auth.admin.updateUserById(existing.id, {
      ban_duration: 'none',
      email_confirm: true,
    })
  } else {
    const tempPassword = `Lifetime_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
    })
    if (created?.user) {
      userId = created.user.id
      userCreated = true
    } else {
      return NextResponse.json(
        { error: `Could not create user: ${createErr?.message}` },
        { status: 500 }
      )
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Could not resolve user ID' }, { status: 500 })
  }

  // ── 2. Upsert user_profiles with role=owner ──────────────────
  await supabase.from('user_profiles').upsert({
    id: userId,
    email: normalizedEmail,
    role: 'owner',
    updated_at: new Date().toISOString(),
  })

  // ── 3. Upsert subscription active until 2099 ─────────────────
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const lifetimeEnd = '2099-12-31T23:59:59.000Z'

  if (existingSub) {
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: lifetimeEnd,
        cancel_at_period_end: false,
        canceled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSub.id)
  } else {
    await supabase.from('subscriptions').insert({
      user_id: userId,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: lifetimeEnd,
      cancel_at_period_end: false,
      trial_used: false,
    })
  }

  // ── 4. Generate magic link so user can set their password ─────
  let magicLink: string | null = null
  try {
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
    })
    magicLink = linkData?.properties?.action_link ?? null
  } catch { /* best effort */ }

  return NextResponse.json({
    success: true,
    email: normalizedEmail,
    userId,
    userCreated,
    role: 'owner',
    subscriptionEnd: lifetimeEnd,
    magicLink,
    note: userCreated
      ? 'Nouveau compte créé. Partager le magicLink pour que l\'utilisateur définisse son mot de passe.'
      : 'Compte existant mis à jour avec accès à vie.',
  })
}
