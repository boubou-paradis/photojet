// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const db = vi.hoisted(() => ({
  sessions: [] as Row[],
  photos: [] as Row[],
  errors: {} as Record<string, string>,
}))

// Faux client : applique réellement les filtres eq sur les lignes.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: 'sessions' | 'photos') => {
      const filters: Array<[string, unknown]> = []
      const rows = () => db[table].filter((row) => filters.every(([key, value]) => row[key] === value))
      const error = db.errors[table] ? { message: db.errors[table] } : null
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return builder },
        maybeSingle: async () => ({ data: error ? null : rows()[0] ?? null, error }),
        then: (resolve: (value: unknown) => void) => resolve({ count: error ? null : rows().length, error }),
      }
      return builder
    },
  }),
}))

import { GET } from '../route'

const SESSION = { id: 's1', code: '1234', name: 'Mariage de Lea', user_id: 'u1', is_active: false, album_enabled: true, album_password: 'secret' }

async function stateOf(code = '1234') {
  const response = await GET(new NextRequest(`http://test/api/invite/state/${code}`), { params: Promise.resolve({ code }) })
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') }
}

beforeEach(() => {
  db.sessions = [{ ...SESSION }]
  db.photos = []
  db.errors = {}
})

describe('état public d\'une session pour /invite', () => {
  it('session inactive, photo approuvée, album ouvert : terminé avec album', async () => {
    db.photos = [{ session_id: 's1', status: 'approved' }]
    expect((await stateOf()).body).toEqual({ state: 'ended_album' })
  })

  it('session inactive, photo approuvée, album fermé : terminé sans album', async () => {
    db.sessions[0].album_enabled = false
    db.photos = [{ session_id: 's1', status: 'approved' }]
    expect((await stateOf()).body).toEqual({ state: 'ended_no_album' })
  })

  it('session inactive sans photo : inactif', async () => {
    expect((await stateOf()).body).toEqual({ state: 'inactive' })
  })

  it('photos en attente ou refusées seulement : inactif, l\'album ne les montre pas', async () => {
    db.photos = [{ session_id: 's1', status: 'pending' }, { session_id: 's1', status: 'rejected' }]
    expect((await stateOf()).body).toEqual({ state: 'inactive' })
  })

  it('les photos d\'une autre session ne comptent pas', async () => {
    db.photos = [{ session_id: 'autre', status: 'approved' }]
    expect((await stateOf()).body).toEqual({ state: 'inactive' })
  })

  it('code inexistant : introuvable', async () => {
    expect((await stateOf('9999')).body).toEqual({ state: 'not_found' })
  })

  it('session active : introuvable, /invite garde son message actuel', async () => {
    db.sessions[0].is_active = true
    db.photos = [{ session_id: 's1', status: 'approved' }]
    expect((await stateOf()).body).toEqual({ state: 'not_found' })
  })

  it('erreur de lecture de la session : introuvable, jamais un état inventé', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.errors.sessions = 'panne'
    const result = await stateOf()
    expect(result.status).toBe(500)
    expect(result.body).toEqual({ state: 'not_found' })
  })

  it('erreur de lecture des photos : introuvable, pas « inactif »', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.errors.photos = 'panne'
    const result = await stateOf()
    expect(result.status).toBe(500)
    expect(result.body).toEqual({ state: 'not_found' })
  })

  it('la réponse ne contient que l\'état et n\'est pas mise en cache', async () => {
    db.photos = [{ session_id: 's1', status: 'approved' }]
    const result = await stateOf()
    expect(Object.keys(result.body)).toEqual(['state'])
    expect(result.cache).toBe('no-store')
  })
})
