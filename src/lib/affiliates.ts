import { createServerSupabaseClient } from '@/lib/supabase-server'

// Constants
export const COMMISSION_RATE = 0.20 // 20%
export const SUBSCRIPTION_PRICE_EUR = 29.90

// Whitelist des emails autorisés
const ADMIN_WHITELIST = ['mg.events35@gmail.com']

/**
 * Vérifie que l'utilisateur connecté est autorisé à accéder à la gestion des affiliés.
 * Retourne l'utilisateur si autorisé, null sinon.
 */
export async function verifyAffiliateAdminAccess(pin?: string | null): Promise<{ authorized: boolean; reason?: string }> {
  // Vérifier le PIN
  const expectedPin = process.env.ADMIN_SECRET_PIN
  if (!expectedPin || pin !== expectedPin) {
    return { authorized: false, reason: 'PIN invalide' }
  }

  // Vérifier l'utilisateur connecté
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { authorized: false, reason: 'Non connecté' }
  }

  // Vérifier la whitelist
  if (!ADMIN_WHITELIST.includes(user.email)) {
    return { authorized: false, reason: 'Non autorisé' }
  }

  return { authorized: true }
}

/**
 * Calcule la commission due pour un nombre de filleuls actifs.
 */
export function calculateCommission(activeReferrals: number): number {
  return Math.round(activeReferrals * SUBSCRIPTION_PRICE_EUR * COMMISSION_RATE * 100) / 100
}
