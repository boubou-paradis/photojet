// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it } from 'vitest'
import { isFreeTrialAccount, type TrialSubscriptionRow } from '@/lib/trial'

const ligne = (over: Partial<TrialSubscriptionRow> = {}): TrialSubscriptionRow => ({
  status: 'trialing',
  stripe_subscription_id: null,
  pass_validity_until: null,
  ...over,
})

describe('isFreeTrialAccount', () => {
  it('filigrane un essai gratuit en cours', () => {
    expect(isFreeTrialAccount('user', [ligne()])).toBe(true)
  })

  it('garde le filigrane après expiration de l essai', () => {
    expect(isFreeTrialAccount('user', [ligne({ status: 'expired' })])).toBe(true)
  })

  it('ne touche jamais le compte owner', () => {
    expect(isFreeTrialAccount('owner', [ligne()])).toBe(false)
  })

  it('ne touche pas un abonné actif', () => {
    expect(isFreeTrialAccount('user', [ligne({ status: 'active', stripe_subscription_id: 'sub_1' })])).toBe(false)
  })

  it('ne touche pas un essai Stripe avec carte', () => {
    expect(isFreeTrialAccount('user', [ligne({ stripe_subscription_id: 'sub_1' })])).toBe(false)
  })

  it('ne touche pas un pass payé, même expiré', () => {
    expect(isFreeTrialAccount('user', [ligne({ status: 'expired', pass_validity_until: '2026-01-01T00:00:00Z' })])).toBe(false)
    expect(isFreeTrialAccount('user', [ligne({ status: 'weekend_pass' })])).toBe(false)
  })

  it('retire le filigrane dès qu une ligne payée existe à côté de l essai', () => {
    expect(isFreeTrialAccount('user', [ligne(), ligne({ status: 'active' })])).toBe(false)
  })

  it('ne touche pas un compte sans aucune ligne d abonnement', () => {
    expect(isFreeTrialAccount('user', [])).toBe(false)
  })
})
