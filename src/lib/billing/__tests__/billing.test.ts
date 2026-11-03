// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it, vi } from 'vitest'
import { ANNUAL_PROMO_REFUSED, buildSubscriptionCheckout, CheckoutError, type CheckoutDeps } from '../checkout'
import {
  ANNUAL_MONTHLY_EQUIVALENT_EUR,
  ANNUAL_SAVING_EUR,
  invoiceLineFor,
  monthlyEquivalentCents,
} from '../plans'
import { calculateCommission, calculateCommissionFromMonthlyCents } from '@/lib/affiliates'
import { runAnnualRenewalReminders, type ReminderDeps, type StripeSubscriptionSummary } from '../annual-reminder'

const MONTHLY = 'price_monthly'
const ANNUAL = 'price_annual'
const APP = 'https://animajet.fr'

function fakeDeps(over: Partial<CheckoutDeps> = {}) {
  const deps: CheckoutDeps = {
    findSitePromo: vi.fn(async (code: string) =>
      code === 'MOINS20' ? { type: 'percent', value: 20 }
        : code === 'ESSAI7' ? { type: 'trial', value: 7 }
          : code === 'MOINS5' ? { type: 'fixed', value: 500 }
            : null),
    isAffiliateCode: vi.fn(async (code: string) => code === 'PARRAIN1'),
    createCoupon: vi.fn(async () => 'coupon_123'),
    findPromotionCodeId: vi.fn(async (code: string) => (code === 'VALID100' ? 'promo_abc' : null)),
    ...over,
  }
  return deps
}

describe('page de paiement — mensuel (inchangé + champ Stripe)', () => {
  it('sans code : même page qu\'avant + codes ambassadeurs Stripe autorisés', async () => {
    const p = await buildSubscriptionCheckout({ plan: 'monthly', email: 'a@b.fr', priceId: MONTHLY, appUrl: APP }, fakeDeps())
    expect(p).toEqual({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: 'a@b.fr',
      line_items: [{ price: MONTHLY, quantity: 1 }],
      success_url: `${APP}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP}/?canceled=true`,
      metadata: { email: 'a@b.fr', promoCode: '' },
      subscription_data: { metadata: { email: 'a@b.fr' } },
      allow_promotion_codes: true,
    })
  })

  it('code du site en pourcentage : coupon une fois, pas de champ Stripe (incompatible)', async () => {
    const deps = fakeDeps()
    const p = await buildSubscriptionCheckout({ plan: 'monthly', email: 'a@b.fr', promoCode: 'moins20', priceId: MONTHLY, appUrl: APP }, deps)
    expect(deps.createCoupon).toHaveBeenCalledWith({ percent_off: 20, duration: 'once', name: 'Promo MOINS20' })
    expect(p.discounts).toEqual([{ coupon: 'coupon_123' }])
    expect(p.allow_promotion_codes).toBeUndefined()
    expect(p.metadata).toEqual({ email: 'a@b.fr', promoCode: 'moins20' })
  })

  it('code montant fixe : coupon en euros', async () => {
    const deps = fakeDeps()
    const p = await buildSubscriptionCheckout({ plan: 'monthly', email: 'a@b.fr', promoCode: 'MOINS5', priceId: MONTHLY, appUrl: APP }, deps)
    expect(deps.createCoupon).toHaveBeenCalledWith({ amount_off: 500, currency: 'eur', duration: 'once', name: 'Promo MOINS5' })
    expect(p.discounts).toEqual([{ coupon: 'coupon_123' }])
  })

  it('code essai : jours d\'essai, champ Stripe toujours proposé', async () => {
    const p = await buildSubscriptionCheckout({ plan: 'monthly', email: 'a@b.fr', promoCode: 'ESSAI7', priceId: MONTHLY, appUrl: APP }, fakeDeps())
    expect(p.subscription_data?.trial_period_days).toBe(7)
    expect(p.discounts).toBeUndefined()
    expect(p.allow_promotion_codes).toBe(true)
  })

  it('code inconnu : ignoré comme avant', async () => {
    const p = await buildSubscriptionCheckout({ plan: 'monthly', email: 'a@b.fr', promoCode: 'XYZ', priceId: MONTHLY, appUrl: APP }, fakeDeps())
    expect(p.discounts).toBeUndefined()
    expect(p.allow_promotion_codes).toBe(true)
  })
})

describe('page de paiement — annuel', () => {
  it('sans code : prix annuel, aucune réduction possible, pas d\'essai', async () => {
    const p = await buildSubscriptionCheckout({ plan: 'annual', email: 'a@b.fr', priceId: ANNUAL, appUrl: APP }, fakeDeps())
    expect(p.line_items).toEqual([{ price: ANNUAL, quantity: 1 }])
    expect(p.allow_promotion_codes).toBeUndefined()
    expect(p.discounts).toBeUndefined()
    expect(p.subscription_data?.trial_period_days).toBeUndefined()
    expect(p.metadata?.plan).toBe('annual')
  })

  it.each(['MOINS20', 'ESSAI7', 'MOINS5', 'INCONNU'])('code promo %s refusé, aucun coupon créé', async (code) => {
    const deps = fakeDeps()
    await expect(buildSubscriptionCheckout({ plan: 'annual', email: 'a@b.fr', promoCode: code, priceId: ANNUAL, appUrl: APP }, deps))
      .rejects.toThrow(ANNUAL_PROMO_REFUSED)
    expect(deps.createCoupon).not.toHaveBeenCalled()
  })

  it('code d\'affilié : attribution seulement, sans réduction', async () => {
    const p = await buildSubscriptionCheckout({ plan: 'annual', email: 'a@b.fr', promoCode: 'parrain1', priceId: ANNUAL, appUrl: APP }, fakeDeps())
    expect(p.metadata?.promoCode).toBe('PARRAIN1')
    expect(p.discounts).toBeUndefined()
    expect(p.allow_promotion_codes).toBeUndefined()
  })

  it('code de validation (variable d\'environnement) : réduction appliquée', async () => {
    const p = await buildSubscriptionCheckout(
      { plan: 'annual', email: 'a@b.fr', promoCode: 'valid100', priceId: ANNUAL, appUrl: APP, annualValidationCode: 'VALID100' },
      fakeDeps(),
    )
    expect(p.discounts).toEqual([{ promotion_code: 'promo_abc' }])
  })

  it('code de validation déjà utilisé : refus clair', async () => {
    const deps = fakeDeps({ findPromotionCodeId: vi.fn(async () => null) })
    await expect(buildSubscriptionCheckout(
      { plan: 'annual', email: 'a@b.fr', promoCode: 'VALID100', priceId: ANNUAL, appUrl: APP, annualValidationCode: 'VALID100' },
      deps,
    )).rejects.toBeInstanceOf(CheckoutError)
  })

  it('sans variable de validation, le même code est refusé', async () => {
    await expect(buildSubscriptionCheckout({ plan: 'annual', email: 'a@b.fr', promoCode: 'VALID100', priceId: ANNUAL, appUrl: APP }, fakeDeps()))
      .rejects.toThrow(ANNUAL_PROMO_REFUSED)
  })
})

describe('prix et factures', () => {
  it('équivalent mensuel et économie affichés', () => {
    expect(ANNUAL_MONTHLY_EQUIVALENT_EUR).toBe(24.92)
    expect(ANNUAL_SAVING_EUR).toBe(59.8)
  })

  it('facture mensuelle sans réduction : identique à avant', () => {
    expect(invoiceLineFor(2990, 'month', 29.9)).toEqual({ amount: 29.9, description: 'Abonnement AnimaJet - 1 mois' })
  })

  it('facture annuelle : 299 € et « 1 an »', () => {
    expect(invoiceLineFor(29900, 'year', 29.9)).toEqual({ amount: 299, description: 'Abonnement AnimaJet - 1 an' })
  })

  it('achat de validation à 0 € : facture à 0,00 €', () => {
    expect(invoiceLineFor(0, 'year', 29.9).amount).toBe(0)
  })

  it('montant inconnu : valeur de secours historique', () => {
    expect(invoiceLineFor(null, undefined, 29.9)).toEqual({ amount: 29.9, description: 'Abonnement AnimaJet - 1 mois' })
  })
})

describe('commissions des affiliés', () => {
  it('mensuel : exactement le calcul d\'avant', () => {
    for (const n of [0, 1, 3, 7, 25, 101]) {
      expect(calculateCommissionFromMonthlyCents(Array(n).fill(2990))).toBe(calculateCommission(n))
    }
  })

  it('annuel : même taux sur 24,92 €', () => {
    expect(monthlyEquivalentCents(29900, 'year', 1)).toBe(2492)
    expect(calculateCommissionFromMonthlyCents([2492])).toBe(4.98)
    expect(calculateCommissionFromMonthlyCents([2990, 2492])).toBe(10.96)
  })
})

describe('rappel 30 jours avant le renouvellement annuel', () => {
  const NOW = new Date('2026-11-04T03:00:00Z')
  const inDays = (d: number) => Math.floor((NOW.getTime() + d * 864e5) / 1000)

  function reminderDeps(subs: Record<string, StripeSubscriptionSummary>, over: Partial<ReminderDeps> = {}) {
    const sent = new Set<string>()
    const deps: ReminderDeps = {
      listCandidates: vi.fn(async () => Object.keys(subs).map((id) => ({ user_id: `u_${id}`, stripe_subscription_id: id }))),
      isOwner: vi.fn(async (uid: string) => uid === 'u_owner'),
      retrieveSubscription: vi.fn(async (id: string) => subs[id]),
      alreadySent: vi.fn(async (uid: string, key: string) => sent.has(`${uid}|${key}`)),
      getEmail: vi.fn(async (uid: string) => `${uid}@test.fr`),
      sendEmail: vi.fn(async () => ({ success: true })),
      logSent: vi.fn(async ({ userId, key }) => { sent.add(`${userId}|${key}`) }),
      ...over,
    }
    return deps
  }

  const annual = (days: number, over: Partial<StripeSubscriptionSummary> = {}): StripeSubscriptionSummary => ({
    status: 'active', cancelAtPeriodEnd: false, interval: 'year', unitAmountCents: 29900, periodEnd: inDays(days), ...over,
  })

  it('envoie aux annuels uniquement, une seule fois par échéance', async () => {
    const deps = reminderDeps({
      sub_annuel: annual(29.5),
      sub_mensuel: annual(20, { interval: 'month', unitAmountCents: 2990 }),
      sub_resilie: annual(29.5, { cancelAtPeriodEnd: true }),
      sub_impaye: annual(29.5, { status: 'past_due' }),
      owner: annual(29.5),
    })
    const first = await runAnnualRenewalReminders(NOW, deps)
    expect(first.sent).toEqual(['u_sub_annuel@test.fr'])
    expect(deps.sendEmail).toHaveBeenCalledWith({ to: 'u_sub_annuel@test.fr', renewalDate: new Date(inDays(29.5) * 1000), amountEur: 299 })
    const second = await runAnnualRenewalReminders(new Date(NOW.getTime() + 864e5), deps)
    expect(second.sent).toEqual([])
    expect(deps.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('cherche les échéances entre J+3 et J+30', async () => {
    const deps = reminderDeps({})
    await runAnnualRenewalReminders(NOW, deps)
    expect(deps.listCandidates).toHaveBeenCalledWith(
      new Date(NOW.getTime() + 3 * 864e5).toISOString(),
      new Date(NOW.getTime() + 30 * 864e5).toISOString(),
    )
  })

  it('date Stripe hors fenêtre (base en retard) : pas d\'envoi', async () => {
    const deps = reminderDeps({ sub_loin: annual(200) })
    expect((await runAnnualRenewalReminders(NOW, deps)).sent).toEqual([])
  })

  it('envoi refusé : non noté, donc réessayé le lendemain', async () => {
    const deps = reminderDeps({ sub_annuel: annual(29) }, { sendEmail: vi.fn(async () => ({ success: false })) })
    const r = await runAnnualRenewalReminders(NOW, deps)
    expect(r.errors).toHaveLength(1)
    expect(deps.logSent).not.toHaveBeenCalled()
  })

  it('une erreur Stripe sur un abonné n\'empêche pas les autres', async () => {
    const subs = { sub_casse: annual(29), sub_ok: annual(28) }
    const deps = reminderDeps(subs, {
      retrieveSubscription: vi.fn(async (id: string) => { if (id === 'sub_casse') throw new Error('Stripe indisponible'); return subs[id as 'sub_ok'] }),
    })
    const r = await runAnnualRenewalReminders(NOW, deps)
    expect(r.sent).toEqual(['u_sub_ok@test.fr'])
    expect(r.errors[0]).toContain('Stripe indisponible')
  })
})
