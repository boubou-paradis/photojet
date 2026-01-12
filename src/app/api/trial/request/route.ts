// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTrialWelcomeEmail } from '@/lib/resend'
import { generatePassword, generateSessionCode } from '@/lib/stripe'
import { isWeekend } from '@/lib/trial'
import crypto from 'crypto'

// Admin client for database operations
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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

  // Fallback
  const fallbackChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let fallbackCode = ''
  for (let i = 0; i < 4; i++) {
    fallbackCode += fallbackChars.charAt(Math.floor(Math.random() * fallbackChars.length))
  }
  return fallbackCode
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format d\'email invalide' },
        { status: 400 }
      )
    }

    // Check if it's the weekend
    if (isWeekend()) {
      return NextResponse.json(
        { error: 'L\'essai gratuit n\'est disponible que du lundi au jeudi. Revenez en semaine ou abonnez-vous pour accéder le week-end !' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const normalizedEmail = email.toLowerCase()

    // Check if this email has already used a trial
    const { data: existingTrial } = await supabaseAdmin
      .from('trial_tokens')
      .select('id, used_at')
      .eq('email', normalizedEmail)
      .limit(1)
      .single()

    if (existingTrial) {
      return NextResponse.json(
        {
          error: 'Vous avez déjà bénéficié de votre essai gratuit 24h.',
          alreadyUsed: true
        },
        { status: 400 }
      )
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === normalizedEmail)

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'Un compte existe déjà avec cet email. Connectez-vous sur la page de connexion.',
          alreadyUsed: true
        },
        { status: 400 }
      )
    }

    // Generate credentials
    const password = generatePassword()
    const sessionCode = await generateUniqueSessionCode()
    const token = crypto.randomBytes(32).toString('hex')

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // Get IP and user agent for tracking
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('[Trial Request] Auth error:', authError)
      return NextResponse.json(
        { error: 'Erreur lors de la création du compte' },
        { status: 500 }
      )
    }

    const userId = authData.user.id

    // Create user profile
    await supabaseAdmin.from('user_profiles').insert({
      id: userId,
      email: normalizedEmail,
      role: 'user',
    })

    // Create trial subscription
    const { data: subscriptionData } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        status: 'trialing',
        current_period_start: new Date().toISOString(),
        current_period_end: expiresAt.toISOString(),
        trial_start: new Date().toISOString(),
        trial_end: expiresAt.toISOString(),
      })
      .select()
      .single()

    // Create session
    await supabaseAdmin
      .from('sessions')
      .insert({
        code: sessionCode,
        name: 'Mon evenement (Essai)',
        expires_at: expiresAt.toISOString(),
        user_id: userId,
        subscription_id: subscriptionData?.id || null,
        moderation_enabled: true,
        is_active: true,
      })

    // Save trial token (for tracking)
    await supabaseAdmin
      .from('trial_tokens')
      .insert({
        email: normalizedEmail,
        token,
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
        used_at: new Date().toISOString(),
      })

    // Send email with credentials
    const emailResult = await sendTrialWelcomeEmail({
      to: normalizedEmail,
      password,
      sessionCode,
      expiresAt,
    })

    if (!emailResult.success) {
      console.error('[Trial Request] Email error:', emailResult.error)
    }

    return NextResponse.json({
      success: true,
      message: 'Votre compte a été créé ! Vos identifiants vous ont été envoyés par email.',
    })
  } catch (error) {
    console.error('[Trial Request] Error:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}
