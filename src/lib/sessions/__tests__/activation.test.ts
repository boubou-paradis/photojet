// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasOpenGame, isExemptUser, joinSessionNames } from '../activation'
import { activateUserSession, reactivateLatestSessionIfNone } from '../server'

const OWNER = 'aaaaaaaa-0000-0000-0000-000000000000'

/** Faux client : enregistre les modifications et rejoue des réponses par table. */
function fakeAdmin(options: {
  rpc?: { data?: unknown; error?: { message: string } | null }
  select?: (table: string, calls: string[]) => { data: unknown; error: unknown }
  updateError?: string
  /** Nombre de premières écritures en échec, les suivantes réussissent. */
  failFirstUpdates?: number
}) {
  const updates: Array<{ table: string; values: unknown; filters: unknown[][] }> = []
  let failuresLeft = options.failFirstUpdates ?? 0
  const rpc = vi.fn(async () => ({ data: options.rpc?.data ?? null, error: options.rpc?.error ?? null }))
  const from = (table: string) => {
    const calls: string[] = []
    const filters: unknown[][] = []
    let values: unknown = null
    const builder: Record<string, unknown> = {
      select: () => { calls.push('select'); return builder },
      update: (v: unknown) => { values = v; return builder },
      eq: (...args: unknown[]) => { calls.push(`eq:${args[0]}`); filters.push(args); return builder },
      in: () => builder,
      gte: () => builder,
      order: () => { calls.push('order'); return builder },
      limit: () => builder,
      then: (resolve: (value: unknown) => void) => {
        if (values) {
          updates.push({ table, values, filters })
          if (failuresLeft > 0) { failuresLeft--; return resolve({ error: { message: 'panne' } }) }
          return resolve({ error: options.updateError ? { message: options.updateError } : null })
        }
        return resolve(options.select?.(table, calls) ?? { data: [], error: null })
      },
    }
    return builder
  }
  return { client: { rpc, from } as never, rpc, updates }
}

afterEach(() => {
  delete process.env.SESSION_RULE_EXEMPT_USER_IDS
  vi.restoreAllMocks()
})

describe('règles pures', () => {
  it('reconnaît un jeu ouvert, pas une valeur absente ou fausse', () => {
    expect(hasOpenGame({ quiz_lobby_visible: true })).toBe(true)
    expect(hasOpenGame({ quiz_active: false, vote_active: null })).toBe(false)
  })

  it('lit la liste des comptes exemptés', () => {
    expect(isExemptUser(OWNER, ` x , ${OWNER} `)).toBe(true)
    expect(isExemptUser(OWNER, 'x')).toBe(false)
    expect(isExemptUser(OWNER, undefined)).toBe(false)
  })

  it('assemble les noms de sessions', () => {
    const s = (name: string) => ({ id: name, name, busy: false })
    expect(joinSessionNames([s('A')])).toBe('A')
    expect(joinSessionNames([s('A'), s('B'), s('C')])).toBe('A, B et C')
  })
})

describe('activateUserSession', () => {
  it('compte exempté : active sans passer par le contrôle', async () => {
    process.env.SESSION_RULE_EXEMPT_USER_IDS = OWNER
    const admin = fakeAdmin({})
    const result = await activateUserSession(admin.client, OWNER, 's', null)
    expect(result).toEqual({ status: 'activated', deactivated: [] })
    expect(admin.rpc).not.toHaveBeenCalled()
    expect(admin.updates).toHaveLength(1)
  })

  it('erreur de la fonction SQL : on active quand même et on journalise', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = fakeAdmin({ rpc: { error: { message: 'panne' } } })
    const result = await activateUserSession(admin.client, 'u', 's', null)
    expect(result).toEqual({ status: 'activated', deactivated: [], degraded: true })
    expect(admin.updates[0].values).toEqual({ is_active: true })
    expect(log).toHaveBeenCalled()
  })

  it('conflit : ne modifie rien et signale un jeu ouvert', async () => {
    const admin = fakeAdmin({
      rpc: { data: { status: 'conflict', others: ['a'] } },
      select: () => ({ data: [{ id: 'a', name: 'A', quiz_active: true }], error: null }),
    })
    const result = await activateUserSession(admin.client, 'u', 's', null)
    expect(result).toEqual({ status: 'conflict', others: [{ id: 'a', name: 'A', busy: true }] })
    expect(admin.updates).toHaveLength(0)
  })

  it('conflit sans lecture possible : avertissement renforcé par prudence', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = fakeAdmin({
      rpc: { data: { status: 'conflict', others: ['a'] } },
      select: () => ({ data: null, error: { message: 'panne' } }),
    })
    const result = await activateUserSession(admin.client, 'u', 's', null)
    expect(result).toEqual({ status: 'conflict', others: [{ id: 'a', name: 'Événement', busy: true }] })
  })

  it('session d\'un autre compte : not_found', async () => {
    const admin = fakeAdmin({ rpc: { data: { status: 'not_found' } } })
    expect(await activateUserSession(admin.client, 'u', 's', null)).toEqual({ status: 'not_found' })
  })
})

describe('reactivateLatestSessionIfNone', () => {
  const noneActive = (_table: string, calls: string[]) =>
    calls.includes('eq:is_active') ? { data: [], error: null } : { data: [{ id: 'recente' }], error: null }

  it('une session déjà active : rien ne change', async () => {
    const admin = fakeAdmin({ select: () => ({ data: [{ id: 'x' }], error: null }) })
    await reactivateLatestSessionIfNone(admin.client, 'u')
    expect(admin.updates).toHaveLength(0)
  })

  it('aucune session active : réactive seulement la plus récente', async () => {
    const admin = fakeAdmin({ select: noneActive })
    await reactivateLatestSessionIfNone(admin.client, 'u')
    expect(admin.updates).toHaveLength(1)
    expect(admin.updates[0].filters).toEqual([['id', 'recente']])
  })

  it('aucune session du tout : ne fait rien', async () => {
    const admin = fakeAdmin({ select: () => ({ data: [], error: null }) })
    await reactivateLatestSessionIfNone(admin.client, 'u')
    expect(admin.updates).toHaveLength(0)
  })

  const OLD_BEHAVIOUR = { values: { is_active: true }, filters: [['user_id', 'u']] }

  it('erreur de lecture : ancien comportement, toutes les sessions, erreur journalisée', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = fakeAdmin({ select: () => ({ data: null, error: { message: 'panne' } }) })
    await reactivateLatestSessionIfNone(admin.client, 'u')
    expect(admin.updates).toHaveLength(1)
    expect(admin.updates[0]).toMatchObject(OLD_BEHAVIOUR)
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('erreur d\'écriture sur la plus récente : ancien comportement', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = fakeAdmin({ select: noneActive, failFirstUpdates: 1 })
    await reactivateLatestSessionIfNone(admin.client, 'u')
    expect(admin.updates).toHaveLength(2)
    expect(admin.updates[1]).toMatchObject(OLD_BEHAVIOUR)
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('exception levée : ancien comportement, sans remonter à l\'appelant', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = fakeAdmin({ select: () => { throw new Error('exception') } })
    await expect(reactivateLatestSessionIfNone(admin.client, 'u')).resolves.toBeUndefined()
    expect(admin.updates[0]).toMatchObject(OLD_BEHAVIOUR)
  })

  it('secours en échec lui aussi : ne lève jamais, deux erreurs journalisées', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = fakeAdmin({ select: noneActive, updateError: 'panne' })
    await expect(reactivateLatestSessionIfNone(admin.client, 'u')).resolves.toBeUndefined()
    expect(admin.updates).toHaveLength(2)
    expect(log).toHaveBeenCalledTimes(2)
  })
})
