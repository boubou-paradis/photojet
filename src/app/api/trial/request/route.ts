// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTrialEmail } from '@/lib/resend'
import crypto from 'crypto'

// Admin client for database operations
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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

    const supabaseAdmin = getSupabaseAdmin()

    // Check if this email has already used a trial
    const { data: existingTrial } = await supabaseAdmin
      .from('trial_tokens')
      .select('id, used_at')
      .eq('email', email.toLowerCase())
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

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex')

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // Get IP and user agent for tracking
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Save token to database
    const { error: insertError } = await supabaseAdmin
      .from('trial_tokens')
      .insert({
        email: email.toLowerCase(),
        token,
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
      })

    if (insertError) {
      console.error('[Trial Request] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Erreur lors de la création de l\'essai' },
        { status: 500 }
      )
    }

    // Send email via Resend
    const emailResult = await sendTrialEmail({
      to: email.toLowerCase(),
      token,
    })

    if (!emailResult.success) {
      console.error('[Trial Request] Email error:', emailResult.error)
      // Don't fail the request, but log the error
      // The user can still use the token
    }

    return NextResponse.json({
      success: true,
      message: 'Un email avec votre lien d\'accès a été envoyé !',
    })
  } catch (error) {
    console.error('[Trial Request] Error:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}
