// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isTrialAccount } from '@/lib/watermark/access'

type Reponse = { data: unknown; error: unknown }

// Client minimal : seules les lectures faites par le contrôle sont simulées
function fauxClient(profil: () => Promise<Reponse>, abonnements: () => Promise<Reponse>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === 'user_profiles' ? { maybeSingle: profil } : abonnements(),
      }),
    }),
  } as unknown as SupabaseClient
}

const profilOk = async () => ({ data: { role: 'user' }, error: null })
const essai = async () => ({
  data: [{ status: 'trialing', stripe_subscription_id: null, pass_validity_until: null }],
  error: null,
})

describe('isTrialAccount : en cas de doute, ni filigrane ni blocage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reconnaît un essai quand la lecture réussit', async () => {
    await expect(isTrialAccount(fauxClient(profilOk, essai), 'u1')).resolves.toBe(true)
  })

  it('répond non sans compte identifié', async () => {
    await expect(isTrialAccount(fauxClient(profilOk, essai), null)).resolves.toBe(false)
  })

  it('répond non si la base renvoie une erreur', async () => {
    const enErreur = async () => ({ data: null, error: new Error('base indisponible') })
    await expect(isTrialAccount(fauxClient(profilOk, enErreur), 'u1')).resolves.toBe(false)
    await expect(isTrialAccount(fauxClient(enErreur, essai), 'u1')).resolves.toBe(false)
  })

  it('répond non si le réseau échoue', async () => {
    const panne = async () => {
      throw new Error('fetch failed')
    }
    await expect(isTrialAccount(fauxClient(profilOk, panne), 'u1')).resolves.toBe(false)
  })

  it('répond non si la base met trop de temps', async () => {
    vi.useFakeTimers()
    const jamais = () => new Promise<Reponse>(() => {})
    const resultat = isTrialAccount(fauxClient(profilOk, jamais), 'u1')
    await vi.advanceTimersByTimeAsync(3000)
    await expect(resultat).resolves.toBe(false)
  })
})
