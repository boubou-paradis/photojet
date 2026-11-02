// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { createBrowserClient } from '@supabase/ssr'
import { createClient as createAnonymousClient, type SupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

let publicClient: SupabaseClient | null = null

/**
 * Client des écrans invités : toujours anonyme, même si le visiteur est connecté à
 * son compte sur ce navigateur. Un abonné invité chez un autre reçoit ainsi le même
 * temps réel qu'un invité sans compte.
 */
export function createPublicClient(): SupabaseClient {
  publicClient ??= createAnonymousClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'animajet-public',
      },
    }
  )
  return publicClient
}
