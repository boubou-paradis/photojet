// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Paramètres de la page de paiement Stripe pour un abonnement (mensuel ou
// annuel). Les accès externes (base, Stripe) sont injectés : la route les
// fournit, les tests passent des faux.
//
// Mensuel : comportement historique inchangé (code promo du site : essai,
// pourcentage ou montant fixe). Sans code du site, le champ « code promo »
// de Stripe est proposé (codes ambassadeurs).
// Annuel : aucune réduction. Un code d'affilié reste accepté pour
// l'attribution de la commission (sans réduction). Seule exception : le code
// de validation défini dans STRIPE_ANNUAL_VALIDATION_CODE (achat test à 0 €).

import type Stripe from 'stripe'
import type { Plan } from './plans'

export interface SitePromo {
  type: 'trial' | 'percent' | 'fixed' | string
  value: number
}

export interface CheckoutDeps {
  /** Code promo actif du site (table promo_codes), sinon null. */
  findSitePromo: (code: string) => Promise<SitePromo | null>
  /** Vrai si le code est celui d'un affilié actif. */
  isAffiliateCode: (code: string) => Promise<boolean>
  /** Crée un coupon Stripe et renvoie son id. */
  createCoupon: (params: Stripe.CouponCreateParams) => Promise<string>
  /** Id du code promotionnel Stripe actif portant ce code, sinon null. */
  findPromotionCodeId: (code: string) => Promise<string | null>
}

export interface CheckoutInput {
  plan: Plan
  email: string
  promoCode?: string | null
  priceId: string
  appUrl: string
  /** Code de validation de l'annuel (variable d'environnement), facultatif. */
  annualValidationCode?: string | null
}

export class CheckoutError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export const ANNUAL_PROMO_REFUSED = "Les codes promo ne s'appliquent pas à l'abonnement annuel (déjà 2 mois offerts)."

export async function buildSubscriptionCheckout(input: CheckoutInput, deps: CheckoutDeps): Promise<Stripe.Checkout.SessionCreateParams> {
  const code = (input.promoCode ?? '').trim().toUpperCase()

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: input.email,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: `${input.appUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.appUrl}/?canceled=true`,
    metadata: { email: input.email, promoCode: '' },
    subscription_data: { metadata: { email: input.email } },
  }

  if (input.plan === 'annual') {
    params.metadata!.plan = 'annual'
    params.subscription_data!.metadata!.plan = 'annual'
    if (!code) return params

    const validation = (input.annualValidationCode ?? '').trim().toUpperCase()
    if (validation && code === validation) {
      const promotionCodeId = await deps.findPromotionCodeId(validation)
      if (!promotionCodeId) throw new CheckoutError('Code de validation inactif ou déjà utilisé.')
      params.discounts = [{ promotion_code: promotionCodeId }]
      return params
    }
    if (await deps.isAffiliateCode(code)) {
      // Attribution seulement : aucune réduction sur l'annuel.
      params.metadata!.promoCode = code
      return params
    }
    throw new CheckoutError(ANNUAL_PROMO_REFUSED)
  }

  // ---- Mensuel : logique historique ----
  params.metadata!.promoCode = input.promoCode || ''
  let siteDiscountApplied = false
  if (code) {
    const promo = await deps.findSitePromo(code)
    if (promo) {
      if (promo.type === 'trial') {
        params.subscription_data!.trial_period_days = promo.value
      } else if (promo.type === 'percent') {
        const coupon = await deps.createCoupon({ percent_off: promo.value, duration: 'once', name: `Promo ${code}` })
        params.discounts = [{ coupon }]
        siteDiscountApplied = true
      } else if (promo.type === 'fixed') {
        const coupon = await deps.createCoupon({ amount_off: promo.value, currency: 'eur', duration: 'once', name: `Promo ${code}` })
        params.discounts = [{ coupon }]
        siteDiscountApplied = true
      }
    }
  }
  // Stripe refuse « discounts » et « allow_promotion_codes » ensemble.
  if (!siteDiscountApplied) params.allow_promotion_codes = true
  return params
}
