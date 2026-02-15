// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Routes that require an active subscription
const PROTECTED_ROUTES = ['/admin']

// Routes that should always be accessible (public)
const PUBLIC_ROUTES = [
  '/login',
  '/api/stripe/webhooks',
  '/api/trial',
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
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip public routes and static assets
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  if (isPublicRoute || pathname === '/' || pathname.startsWith('/_next') || pathname.startsWith('/api/') && !pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Only check protected routes
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route))
  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Create Supabase client for middleware
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
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
            request: {
              headers: request.headers,
            },
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
    // Trial user - check if expired
    const now = new Date()
    const expiresAt = new Date(trialExpires)
    if (now > expiresAt) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('access', 'expired')
      return NextResponse.redirect(url)
    }
    // Trial is still valid
    return response
  }

  if (!user) {
    // No auth at all - redirect to login
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

  // Check subscription status
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, trial_end, current_period_end')
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

  const status = subscription.status

  // Active subscription = full access
  if (status === 'active') {
    return response
  }

  // Trialing = check expiration
  if (status === 'trialing') {
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null
    if (trialEnd && new Date() > trialEnd) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('access', 'expired')
      return NextResponse.redirect(url)
    }
    return response
  }

  // past_due, canceled, expired = block access
  const url = request.nextUrl.clone()
  url.pathname = '/'
  url.searchParams.set('access', 'expired')
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|logo|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
