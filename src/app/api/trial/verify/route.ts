// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isWeekend, isTokenExpired } from '@/lib/trial'

// Admin client for database operations
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://animajet.fr'

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

    // Mark token as used if not already
    if (!trialToken.used_at) {
      await supabaseAdmin
        .from('trial_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', trialToken.id)
    }

    // Create a session cookie for trial access
    const cookieStore = await cookies()

    // Set trial cookie (expires when trial expires)
    const expiresDate = new Date(trialToken.expires_at)

    cookieStore.set('trial_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresDate,
      path: '/',
    })

    cookieStore.set('trial_email', trialToken.email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresDate,
      path: '/',
    })

    cookieStore.set('trial_expires_at', trialToken.expires_at, {
      httpOnly: false, // Allow client-side access for countdown
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresDate,
      path: '/',
    })

    // Redirect to dashboard
    return NextResponse.redirect(`${APP_URL}/admin/dashboard?trial=active`)
  } catch (error) {
    console.error('[Trial Verify] Error:', error)
    return NextResponse.redirect(`${APP_URL}/trial/error`)
  }
}
