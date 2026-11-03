// Constants
export const COMMISSION_RATE = 0.20 // 20%
export const SUBSCRIPTION_PRICE_EUR = 29.90

/**
 * Vérifie l'accès à la gestion des affiliés via le PIN secret.
 * Sécurité : URL secrète + PIN = double protection.
 */
export function verifyAffiliateAdminAccess(pin?: string | null): { authorized: boolean; reason?: string } {
  const expectedPin = process.env.ADMIN_SECRET_PIN
  if (!expectedPin || pin !== expectedPin) {
    return { authorized: false, reason: 'PIN invalide' }
  }

  return { authorized: true }
}

/**
 * Calcule la commission due pour un nombre de filleuls actifs.
 */
export function calculateCommission(activeReferrals: number): number {
  return Math.round(activeReferrals * SUBSCRIPTION_PRICE_EUR * COMMISSION_RATE * 100) / 100
}

/**
 * Commission due sur des filleuls actifs, à partir de l'équivalent mensuel
 * réel de chacun, en centimes (mensuel : 2990 ; annuel 299 € : 2492).
 * Même taux pour toutes les formules.
 */
export function calculateCommissionFromMonthlyCents(monthlyCents: number[]): number {
  const total = monthlyCents.reduce((sum, c) => sum + c, 0)
  return Math.round(total * COMMISSION_RATE) / 100
}
