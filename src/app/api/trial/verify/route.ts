// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isWeekend, isTokenExpired } from '@/lib/trial'
import { generatePassword, generateSessionCode } from '@/lib/stripe'
import { sendTrialWelcomeEmail } from '@/lib/resend'

// Admin client for database operations
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://animajet.fr'

// Generate unique session code
async function generateUniqueSessionCode(): Promise<string> {
  const maxAttempts = 50
  const supabase = getSupabaseAdmin()

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateSessionCode()
    const { data: existing, error } = await supabase
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(`${APP_URL}/trial/invalid`)
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Find the token in database
    const { data: trialToken, error: fetchError } = await supabaseAdmin
      .from('trial_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (fetchError || !trialToken) {
      console.error('[Trial Verify] Token not found:', token)
      return NextResponse.redirect(`${APP_URL}/trial/invalid`)
    }

    // Check if token is expired
    if (isTokenExpired(trialToken.expires_at)) {
      return NextResponse.redirect(`${APP_URL}/trial/expired`)
    }

    // Check if it's the weekend
    if (isWeekend()) {
      return NextResponse.redirect(`${APP_URL}/trial/blocked-weekend`)
    }

    // Check if already used - redirect to login if account exists
    if (trialToken.used_at) {
      return NextResponse.redirect(`${APP_URL}/login?message=trial_already_activated`)
    }

    const email = trialToken.email
    const password = generatePassword()
    const sessionCode = await generateUniqueSessionCode()

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === email)

      if (existingUser) {
        // User already exists - mark token as used and redirect to login
        await supabaseAdmin
          .from('trial_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('id', trialToken.id)

        return NextResponse.redirect(`${APP_URL}/login?message=account_exists`)
      }

      console.error('[Trial Verify] Auth error:', authError)
      return NextResponse.redirect(`${APP_URL}/trial/error`)
    }

    const userId = authData.user.id

    // Create user profile
    await supabaseAdmin.from('user_profiles').insert({
      id: userId,
      email,
      role: 'user',
    })

    // Create trial subscription (expires in 24h)
    const trialExpiresAt = new Date(trialToken.expires_at)

    const { data: subscriptionData, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        status: 'trialing',
        current_period_start: new Date().toISOString(),
        current_period_end: trialExpiresAt.toISOString(),
        trial_start: new Date().toISOString(),
        trial_end: trialExpiresAt.toISOString(),
      })
      .select()
      .single()

    if (subError) {
      console.error('[Trial Verify] Subscription error:', subError)
    }

    // Create session
    const { error: sessionError } = await supabaseAdmin
      .from('sessions')
      .insert({
        code: sessionCode,
        name: 'Mon evenement (Essai)',
        expires_at: trialExpiresAt.toISOString(),
        user_id: userId,
        subscription_id: subscriptionData?.id || null,
        moderation_enabled: true,
        is_active: true,
      })

    if (sessionError) {
      console.error('[Trial Verify] Session error:', sessionError)
    }

    // Mark token as used
    await supabaseAdmin
      .from('trial_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', trialToken.id)

    // Send welcome email with credentials
    const emailResult = await sendTrialWelcomeEmail({
      to: email,
      password,
      sessionCode,
      expiresAt: trialExpiresAt,
    })

    if (!emailResult.success) {
      console.error('[Trial Verify] Email error:', emailResult.error)
    }

    // Redirect to login with success message
    return NextResponse.redirect(`${APP_URL}/login?message=trial_activated&email=${encodeURIComponent(email)}`)
  } catch (error) {
    console.error('[Trial Verify] Error:', error)
    return NextResponse.redirect(`${APP_URL}/trial/error`)
  }
}
