// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasActivationAccess, type ActivationAccessRow } from '../activation'
import { mayActivateSession } from '../server'
import { requestSessionState } from '../client'

const NOW = new Date('2026-11-04T10:00:00Z')
const FUTURE = '2026-12-01T00:00:00Z'
const PAST = '2026-10-01T00:00:00Z'

function row(values: Partial<ActivationAccessRow>): ActivationAccessRow {
  return { status: 'active', current_period_end: null, trial_end: null, pass_validity_until: null, ...values }
}

/** Faux client : une réponse par table. */
function fakeAdmin(answers: Record<string, { data: unknown; error: unknown }>) {
  const from = (table: string) => {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => answers[table],
      then: (resolve: (value: unknown) => void) => resolve(answers[table]),
    }
    return builder
  }
  return { from } as never
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('hasActivationAccess', () => {
  it('laisse passer un abonné actif, avec ou sans date', () => {
    expect(hasActivationAccess('user', [row({ current_period_end: FUTURE })], NOW, false)).toBe(true)
    expect(hasActivationAccess('user', [row({})], NOW, false)).toBe(true)
  })

  it('laisse passer le propriétaire, même sans abonnement', () => {
    expect(hasActivationAccess('owner', [], NOW, false)).toBe(true)
  })

  it('ignore la date de la session : seul le compte compte', () => {
    expect(hasActivationAccess('user', [row({ current_period_end: FUTURE })], NOW, true)).toBe(true)
  })

  it('une seule ligne valide suffit', () => {
    const rows = [row({ status: 'expired', current_period_end: PAST }), row({ current_period_end: FUTURE })]
    expect(hasActivationAccess('user', rows, NOW, false)).toBe(true)
  })

  it('accepte un pass en cours et un essai en cours en semaine', () => {
    expect(hasActivationAccess('user', [row({ status: 'weekend_pass', pass_validity_until: FUTURE })], NOW, true)).toBe(true)
    expect(hasActivationAccess('user', [row({ status: 'trialing', trial_end: FUTURE })], NOW, false)).toBe(true)
  })

  it('refuse essai expiré, essai le week-end, pass fini, période finie', () => {
    expect(hasActivationAccess('user', [row({ status: 'trialing', trial_end: PAST })], NOW, false)).toBe(false)
    expect(hasActivationAccess('user', [row({ status: 'trialing', trial_end: FUTURE })], NOW, true)).toBe(false)
    expect(hasActivationAccess('user', [row({ status: 'weekend_pass', pass_validity_until: PAST })], NOW, false)).toBe(false)
    expect(hasActivationAccess('user', [row({ current_period_end: PAST })], NOW, false)).toBe(false)
  })

  it('refuse impayé, résilié, expiré et compte sans abonnement', () => {
    for (const status of ['past_due', 'canceled', 'expired']) {
      expect(hasActivationAccess('user', [row({ status, current_period_end: FUTURE })], NOW, false)).toBe(false)
    }
    expect(hasActivationAccess('user', [], NOW, false)).toBe(false)
  })
})

describe('mayActivateSession', () => {
  it('refuse un essai expiré', async () => {
    const admin = fakeAdmin({
      user_profiles: { data: { role: 'user' }, error: null },
      subscriptions: { data: [row({ status: 'expired', trial_end: PAST })], error: null },
    })
    expect(await mayActivateSession(admin, 'u')).toBe(false)
  })

  it('autorise un abonné actif', async () => {
    const admin = fakeAdmin({
      user_profiles: { data: { role: 'user' }, error: null },
      subscriptions: { data: [row({ current_period_end: '2999-01-01T00:00:00Z' })], error: null },
    })
    expect(await mayActivateSession(admin, 'u')).toBe(true)
  })

  it('une panne de lecture ne bloque jamais', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = fakeAdmin({
      user_profiles: { data: null, error: { message: 'panne' } },
      subscriptions: { data: [], error: null },
    })
    expect(await mayActivateSession(admin, 'u')).toBe(true)
    expect(log).toHaveBeenCalled()
  })

  it('une exception ne bloque jamais', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = { from: () => { throw new Error('réseau') } } as never
    expect(await mayActivateSession(admin, 'u')).toBe(true)
  })
})

describe('requestSessionState', () => {
  const body = { sessionId: 's', active: true }

  it('un refus revient comme un statut, sans déclencher le secours', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'no_access' }), { status: 403 })))
    await expect(requestSessionState(body)).resolves.toEqual({ status: 'denied' })
  })

  it('un autre 403 reste une panne, le secours joue', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bloqué', { status: 403 })))
    await expect(requestSessionState(body)).rejects.toThrow('HTTP 403')
  })

  it('une erreur serveur reste une panne', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    await expect(requestSessionState(body)).rejects.toThrow('HTTP 500')
  })
})
