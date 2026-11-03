// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Route /api/stripe/checkout avec un FAUX Stripe et une fausse base :
// aucun appel réseau.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const created: unknown[] = []
const fakeStripe = {
  checkout: { sessions: { create: vi.fn(async (params: unknown) => { created.push(params); return { url: 'https://checkout.stripe.test/s' } }) } },
  coupons: { create: vi.fn(async () => ({ id: 'coupon_fake' })) },
  promotionCodes: { list: vi.fn(async ({ code }: { code: string }) => ({ data: code === 'VALID100' ? [{ id: 'promo_fake' }] : [] })) },
}

vi.mock('@/lib/stripe', () => ({
  stripe: fakeStripe,
  STRIPE_PRICE_ID: 'price_monthly',
  STRIPE_PRICE_ID_ANNUAL: 'price_annual',
  STRIPE_PRICE_ID_WEEKEND_PASS: 'price_weekend',
}))

vi.mock('@/lib/weekend-pass', () => ({ isWeekendPassAvailable: () => true }))

// Fausse base : promo_codes (MOINS20 à -20 %) et affiliates (PARRAIN1)
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const filters: Record<string, string> = {}
      const builder = {
        select: () => builder,
        eq: (col: string, val: string) => { filters[col] = String(val); return builder },
        ilike: (col: string, val: string) => { filters[col] = val.toUpperCase(); return builder },
        limit: async () => ({ data: table === 'affiliates' && filters.promo_code === 'PARRAIN1' ? [{ id: 'aff1' }] : [] }),
        single: async () => ({ data: table === 'promo_codes' && filters.code === 'MOINS20' ? { type: 'percent', value: 20 } : null }),
      }
      return builder
    },
  }),
}))

const post = async (body: object) => {
  const { POST } = await import('../route')
  return POST(new NextRequest('http://localhost/api/stripe/checkout', { method: 'POST', body: JSON.stringify(body) }))
}
const lastParams = () => created[created.length - 1] as Record<string, unknown>

beforeEach(() => {
  created.length = 0
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'https://animajet.fr'
  delete process.env.STRIPE_ANNUAL_VALIDATION_CODE
})

describe('route de paiement', () => {
  it('sans formule : mensuel au prix mensuel (appel historique)', async () => {
    const res = await post({ email: 'a@b.fr', promoCode: '' })
    expect(res.status).toBe(200)
    expect(lastParams().line_items).toEqual([{ price: 'price_monthly', quantity: 1 }])
    expect(lastParams().allow_promotion_codes).toBe(true)
  })

  it('mensuel avec code du site : réduction comme avant', async () => {
    await post({ email: 'a@b.fr', promoCode: 'MOINS20' })
    expect(fakeStripe.coupons.create).toHaveBeenCalledWith({ percent_off: 20, duration: 'once', name: 'Promo MOINS20' })
    expect(lastParams().discounts).toEqual([{ coupon: 'coupon_fake' }])
  })

  it('annuel : prix annuel, sans champ code promo Stripe', async () => {
    const res = await post({ email: 'a@b.fr', productType: 'annual' })
    expect(res.status).toBe(200)
    expect(lastParams().line_items).toEqual([{ price: 'price_annual', quantity: 1 }])
    expect(lastParams().allow_promotion_codes).toBeUndefined()
    expect(lastParams().mode).toBe('subscription')
  })

  it('annuel + code promo : 400 et aucune page de paiement créée', async () => {
    const res = await post({ email: 'a@b.fr', productType: 'annual', promoCode: 'MOINS20' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('annuel')
    expect(fakeStripe.checkout.sessions.create).not.toHaveBeenCalled()
    expect(fakeStripe.coupons.create).not.toHaveBeenCalled()
  })

  it('annuel + code parrain : accepté, sans réduction', async () => {
    await post({ email: 'a@b.fr', productType: 'annual', promoCode: 'parrain1' })
    expect(lastParams().discounts).toBeUndefined()
    expect((lastParams().metadata as Record<string, string>).promoCode).toBe('PARRAIN1')
  })

  it('annuel + code de validation configuré : réduction Stripe appliquée', async () => {
    process.env.STRIPE_ANNUAL_VALIDATION_CODE = 'VALID100'
    await post({ email: 'a@b.fr', productType: 'annual', promoCode: 'VALID100' })
    expect(lastParams().discounts).toEqual([{ promotion_code: 'promo_fake' }])
  })

  it('Pass Événement : inchangé', async () => {
    await post({ email: 'a@b.fr', productType: 'weekend_pass' })
    expect(lastParams()).toMatchObject({ mode: 'payment', line_items: [{ price: 'price_weekend', quantity: 1 }] })
  })
})
