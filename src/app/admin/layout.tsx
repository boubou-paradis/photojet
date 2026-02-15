// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// SERVER COMPONENT - Subscription check happens HERE on the server.
// Uses redirect() which is impossible to bypass from the client.

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AdminLayoutClient from './admin-layout-client'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()

  // ============================================================
  // 1. Check trial cookies (for trial users without Supabase auth)
  // ============================================================
  const trialToken = cookieStore.get('trial_token')?.value
  const trialExpires = cookieStore.get('trial_expires_at')?.value

  if (trialToken && trialExpires) {
    const now = new Date()
    const expiresAt = new Date(trialExpires)

    if (now > expiresAt) {
      // Trial expired - redirect
      redirect('/trial/expired')
    }

    // Trial is still valid - render the client layout
    return (
      <AdminLayoutClient
        isTrialUser={true}
        trialExpiresAt={trialExpires}
      >
        {children}
      </AdminLayoutClient>
    )
  }

  // ============================================================
  // 2. Check Supabase auth
  // ============================================================
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // ============================================================
  // 3. Check user role (owners always have access)
  // ============================================================
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'owner') {
    return (
      <AdminLayoutClient>
        {children}
      </AdminLayoutClient>
    )
  }

  // ============================================================
  // 4. Check subscription status AND date
  // ============================================================
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, trial_end')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!subscription) {
    redirect('/?access=expired')
  }

  const now = new Date()
  const { status, current_period_end, trial_end } = subscription

  // Active subscription: check date hasn't passed
  if (status === 'active') {
    if (current_period_end && now > new Date(current_period_end)) {
      // Date expired even though status is 'active' - block access
      redirect('/?access=expired')
    }
    // Valid active subscription
    return (
      <AdminLayoutClient>
        {children}
      </AdminLayoutClient>
    )
  }

  // Trialing subscription: check trial_end date
  if (status === 'trialing') {
    if (trial_end && now > new Date(trial_end)) {
      redirect('/?access=expired')
    }
    return (
      <AdminLayoutClient
        isTrialUser={true}
        trialExpiresAt={trial_end}
      >
        {children}
      </AdminLayoutClient>
    )
  }

  // All other statuses: past_due, canceled, expired = NO ACCESS
  redirect('/?access=expired')
}
