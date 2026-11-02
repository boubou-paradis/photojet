// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const db = vi.hoisted(() => ({
  sessions: [] as Record<string, unknown>[],
  photos: [] as Record<string, unknown>[],
  errors: {} as Record<string, string>,
  trial: false,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: 'sessions' | 'photos') => {
      const filters: Array<[string, unknown]> = []
      const rows = () => db[table].filter((row) => filters.every(([key, value]) => row[key] === value))
      const error = db.errors[table] ? { message: db.errors[table] } : null
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return builder },
        order: () => builder,
        maybeSingle: async () => ({ data: error ? null : rows()[0] ?? null, error }),
        then: (resolve: (value: unknown) => void) => resolve({ data: error ? null : rows(), error }),
      }
      return builder
    },
  }),
}))

vi.mock('@/lib/watermark/access', () => ({ isTrialAccount: async () => db.trial }))

import { GET as joinGet } from '@/app/api/public/join/[code]/route'
import { GET as matchingGet } from '@/app/api/public/matching/[sessionId]/route'
import { POST as albumPost } from '@/app/api/album/photos/[code]/route'

const ID = '11111111-1111-4111-8111-111111111111'
const SESSION: Row = {
  id: ID, code: '1234', user_id: 'proprio', is_active: true, quiz_active: false, quiz_lobby_visible: false,
  album_enabled: true, album_password: null, affinity_active: true, affinity_phase: 'question',
}
const join = (code: string) => joinGet(new Request('http://x'), { params: Promise.resolve({ code }) })
const matching = (sessionId: string) => matchingGet(new Request('http://x'), { params: Promise.resolve({ sessionId }) })
const album = (code: string, body?: unknown) =>
  albumPost(new NextRequest('http://x', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }), { params: Promise.resolve({ code }) })

beforeEach(() => {
  db.sessions = [{ ...SESSION }]
  db.photos = [
    { id: 'p1', session_id: ID, storage_path: `${ID}/a.jpg`, status: 'approved' },
    { id: 'p2', session_id: ID, storage_path: `${ID}/b.jpg`, status: 'pending' },
  ]
  db.errors = {}
  db.trial = false
})

describe('/api/public/join', () => {
  it('session active sans quiz : trouvée, fermée', async () => {
    const res = await join('1234')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sessionId: ID, open: false })
  })

  it('lobby ouvert : ouvert, même session désactivée', async () => {
    db.sessions[0] = { ...SESSION, is_active: false, quiz_lobby_visible: true }
    expect(await (await join('1234')).json()).toEqual({ sessionId: ID, open: true })
  })

  it('session invisible ou inconnue : 404', async () => {
    db.sessions[0] = { ...SESSION, is_active: false }
    expect((await join('1234')).status).toBe(404)
    expect((await join('9999')).status).toBe(404)
  })

  it('panne de base : 503, pas 404', async () => {
    db.errors.sessions = 'panne'
    expect((await join('1234')).status).toBe(503)
  })
})

describe('/api/public/matching', () => {
  it('ne renvoie que les colonnes publiques', async () => {
    const res = await matching(ID)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.affinity_phase).toBe('question')
    for (const key of ['is_active', 'quiz_active', 'quiz_lobby_visible']) expect(body).not.toHaveProperty(key)
  })

  it('identifiant invalide : 400', async () => {
    expect((await matching('abc')).status).toBe(400)
  })

  it('session invisible : 404', async () => {
    db.sessions[0] = { ...SESSION, is_active: false }
    expect((await matching(ID)).status).toBe(404)
  })
})

describe('/api/album/photos', () => {
  it('photos approuvées seulement, sans autre colonne que la liste', async () => {
    const res = await album('1234')
    expect(res.status).toBe(200)
    const { photos } = await res.json()
    expect(photos.map((p: Row) => p.id)).toEqual(['p1'])
  })

  it('reste lisible après désactivation de la session', async () => {
    db.sessions[0] = { ...SESSION, is_active: false }
    expect((await album('1234')).status).toBe(200)
  })

  it('album désactivé : 403', async () => {
    db.sessions[0] = { ...SESSION, album_enabled: false }
    expect((await album('1234')).status).toBe(403)
  })

  it('mot de passe : refus sans le bon, accès avec, jamais renvoyé', async () => {
    db.sessions[0] = { ...SESSION, album_password: 'secret' }
    expect((await album('1234')).status).toBe(403)
    expect((await album('1234', { password: 'faux' })).status).toBe(403)
    const res = await album('1234', { password: 'secret' })
    expect(res.status).toBe(200)
    expect(JSON.stringify(await res.json())).not.toContain('secret')
  })

  it('compte d\'essai : aucun chemin vers l\'original', async () => {
    db.trial = true
    const { photos } = await (await album('1234')).json()
    expect(photos).toEqual([{ id: 'p1', storage_path: null }])
  })

  it('panne sur les photos : 503', async () => {
    db.errors.photos = 'panne'
    expect((await album('1234')).status).toBe(503)
  })
})
