// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { isWeekendPassAvailable } from '@/lib/weekend-pass'

// Routes that require an active subscription
const PROTECTED_ROUTES = ['/admin']

// Routes that should always be accessible (public)
const PUBLIC_ROUTES = [
  '/login',
  '/api/',
  '/invite',
  '/join',
  '/live',
  '/album',
  '/play',
  '/demo',
  '/cgv',
  '/confidentialite',
  '/mentions-legales',
  '/subscription',
  '/borne',
  '/trial',
  '/host',
  '/robots',
  '/sitemap',
  '/animation-',
  '/gestion-',
]

function isSubscriptionValid(
  status: string,
  currentPeriodEnd: string | null,
  trialEnd: string | null,
  passValidityUntil?: string | null
): boolean {
  const now = new Date()

  if (status === 'weekend_pass') {
    if (!passValidityUntil) return false
    return now < new Date(passValidityUntil)
  }

  if (status !== 'active' && status !== 'trialing') return false

  if (status === 'trialing') {
    if (!trialEnd) return false
    // Bloquer les essais le week-end (vendredi 12h → lundi 12h)
    if (isWeekendPassAvailable()) return false
    return now < new Date(trialEnd)
  }

  if (status === 'active') {
    if (!currentPeriodEnd) return true
    return now < new Date(currentPeriodEnd)
  }

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf)$/)) {
    return NextResponse.next()
  }

  // Skip public routes
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  if (isPublicRoute || pathname === '/') {
    return NextResponse.next()
  }

  // Only enforce on protected routes
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route))
  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Create Supabase client for middleware
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser()

  // Check trial cookies for trial users (no Supabase auth)
  const trialToken = request.cookies.get('trial_token')?.value
  const trialExpires = request.cookies.get('trial_expires_at')?.value

  if (!user && trialToken && trialExpires) {
    // Check expiration
    if (new Date() > new Date(trialExpires)) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('access', 'expired')
      return NextResponse.redirect(url)
    }

    // Validate trial token against DB to prevent cookie manipulation
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: dbToken } = await supabaseAdmin
      .from('trial_tokens')
      .select('id, expires_at')
      .eq('token', trialToken)
      .single()

    if (!dbToken || new Date() > new Date(dbToken.expires_at)) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('access', 'expired')
      return NextResponse.redirect(url)
    }

    return response
  }

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Check user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Owners always have access
  if (profile?.role === 'owner') {
    return response
  }

  // Check subscription - get status AND dates
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, trial_end, pass_validity_until')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!subscription) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('access', 'expired')
    return NextResponse.redirect(url)
  }

  const valid = isSubscriptionValid(
    subscription.status,
    subscription.current_period_end,
    subscription.trial_end,
    subscription.pass_validity_until
  )

  if (!valid) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('access', 'expired')
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/|logo|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
