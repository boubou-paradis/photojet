// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Formules d'abonnement (module pur, client + serveur). Les prix réellement
// facturés viennent de Stripe ; ces valeurs servent à l'affichage et aux
// valeurs de secours.

export type Plan = 'monthly' | 'annual'

export const MONTHLY_PRICE_EUR = 29.9
export const ANNUAL_PRICE_EUR = 299
/** Équivalent mensuel affiché : 299 / 12 = 24,92 € */
export const ANNUAL_MONTHLY_EQUIVALENT_EUR = Math.round((ANNUAL_PRICE_EUR / 12) * 100) / 100
/** Économie annuelle par rapport à 12 mensualités (358,80 − 299 = 59,80 €) */
export const ANNUAL_SAVING_EUR = Math.round((MONTHLY_PRICE_EUR * 12 - ANNUAL_PRICE_EUR) * 100) / 100

export function formatEuros(amount: number): string {
  return Number.isInteger(amount) ? `${amount} €` : `${amount.toFixed(2).replace('.', ',')} €`
}

export function isPlan(value: unknown): value is Plan {
  return value === 'monthly' || value === 'annual'
}

/** Intervalle Stripe d'un abonnement (« year » = annuel), quel que soit le chemin. */
export function planFromInterval(interval: string | null | undefined): Plan {
  return interval === 'year' ? 'annual' : 'monthly'
}

/** Libellé de la ligne de facture. Le mensuel garde exactement son libellé historique. */
export function invoiceDescription(plan: Plan): string {
  return plan === 'annual' ? 'Abonnement AnimaJet - 1 an' : 'Abonnement AnimaJet - 1 mois'
}

/**
 * Équivalent mensuel en centimes d'un prix Stripe, pour les commissions.
 * Mensuel : le prix tel quel. Annuel : prix / 12, arrondi au centime.
 */
export function monthlyEquivalentCents(unitAmountCents: number, interval: string | null | undefined, intervalCount = 1): number {
  const count = intervalCount > 0 ? intervalCount : 1
  if (interval === 'year') return Math.round(unitAmountCents / (12 * count))
  if (interval === 'month') return Math.round(unitAmountCents / count)
  return unitAmountCents
}

/**
 * Ligne de facture d'un premier paiement d'abonnement : montant réellement
 * payé (centimes Stripe, après réduction) et libellé selon la formule.
 * Sans montant connu, valeur de secours (historique : 29,90 €).
 */
export function invoiceLineFor(
  amountTotalCents: number | null | undefined,
  interval: string | null | undefined,
  fallbackEur: number,
): { amount: number; description: string } {
  const amount = typeof amountTotalCents === 'number' ? amountTotalCents / 100 : fallbackEur
  return { amount, description: invoiceDescription(planFromInterval(interval)) }
}
