// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  rows: new Map<string, { ip_hash: string; failed_at: string }>(),
  fail: false,
  reads: 0,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const query = {
        ip: '',
        since: '',
        eq(_key: string, value: string) { query.ip = value; return query },
        gt(_key: string, value: string) { query.since = value; return query },
        then(resolve: (value: unknown) => void) {
          db.reads++
          if (db.fail) return resolve({ count: null, error: { message: 'panne' } })
          const count = [...db.rows.values()].filter((r) => r.ip_hash === query.ip && r.failed_at > query.since).length
          return resolve({ count, error: null })
        },
      }
      return {
        select: () => query,
        upsert: async (row: { ip_hash: string; code_hash: string; failed_at: string }) => {
          if (db.fail) return { error: { message: 'panne' } }
          db.rows.set(`${row.ip_hash}/${row.code_hash}`, row)
          return { error: null }
        },
        delete: () => ({ lt: async () => ({ error: null }) }),
      }
    },
  }),
}))

import {
  CODE_FAILURE_LIMIT,
  isCodeLookupBlocked,
  recordCodeFailure,
  resetCodeGuardCache,
  tooManyCodeAttempts,
} from '../code-guard'

const from = (ip?: string) => new Request('http://test/', { headers: ip ? { 'x-real-ip': ip } : {} })

beforeEach(() => {
  db.rows.clear()
  db.fail = false
  db.reads = 0
  resetCodeGuardCache()
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-test'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function tryCodes(ip: string, count: number) {
  for (let i = 0; i < count; i++) await recordCodeFailure(from(ip), 'session', String(1000 + i))
}

describe('frein sur les codes', () => {
  it('laisse passer juste sous le seuil et refuse au seuil', async () => {
    await tryCodes('1.1.1.1', CODE_FAILURE_LIMIT - 1)
    expect(await isCodeLookupBlocked(from('1.1.1.1'))).toBe(false)
    await recordCodeFailure(from('1.1.1.1'), 'session', '9999')
    expect(await isCodeLookupBlocked(from('1.1.1.1'))).toBe(true)
  })

  it('ne compte qu’une fois le même code relu en boucle', async () => {
    for (let i = 0; i < CODE_FAILURE_LIMIT * 3; i++) await recordCodeFailure(from('1.1.1.1'), 'session', '1234')
    expect(db.rows.size).toBe(1)
    expect(await isCodeLookupBlocked(from('1.1.1.1'))).toBe(false)
  })

  it('ne touche pas une autre adresse', async () => {
    await tryCodes('1.1.1.1', CODE_FAILURE_LIMIT)
    expect(await isCodeLookupBlocked(from('2.2.2.2'))).toBe(false)
  })

  it('ne garde ni l’adresse ni le code en clair', async () => {
    await recordCodeFailure(from('1.1.1.1'), 'pin', 'borne:1234')
    expect(JSON.stringify([...db.rows.entries()])).not.toMatch(/1\.1\.1\.1|1234/)
  })

  it('laisse passer si la base est en panne', async () => {
    db.fail = true
    await recordCodeFailure(from('1.1.1.1'), 'session', '1234')
    expect(await isCodeLookupBlocked(from('1.1.1.1'))).toBe(false)
  })

  it('laisse passer si l’adresse est inconnue', async () => {
    expect(await isCodeLookupBlocked(from())).toBe(false)
    expect(db.reads).toBe(0)
  })

  it('une salle qui relit sans cesse ne provoque qu’une lecture', async () => {
    for (let i = 0; i < 300; i++) await isCodeLookupBlocked(from('1.1.1.1'))
    expect(db.reads).toBe(1)
  })

  it('répond 429 avec le délai à attendre', async () => {
    const response = tooManyCodeAttempts()
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('600')
  })
})
