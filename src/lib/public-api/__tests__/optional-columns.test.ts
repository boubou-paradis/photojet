// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Mise en ligne sans risque d'ordre : si la base ne connaît pas (encore)
// sessions.demimot_active, /live et /invite continuent de marcher pour tous
// les autres jeux et considèrent À Demi-Mot comme inactif.

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const db = vi.hoisted(() => ({
  sessions: [] as Record<string, unknown>[],
  /** Simule une base où la migration À Demi-Mot n'est pas appliquée. */
  withoutDemiMotColumn: false,
  /** Panne quelconque (autre qu'une colonne manquante). */
  outage: null as string | null,
  selects: [] as string[],
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      let select = ''
      const filters: Array<[string, unknown]> = []
      const result = () => {
        if (table !== 'sessions') return { data: [], error: null, count: 0 }
        if (db.outage) return { data: null, error: { code: '57014', message: db.outage } }
        const columns = select.split(',').map((c) => c.trim()).filter(Boolean)
        if (db.withoutDemiMotColumn && columns.includes('demimot_active')) {
          return { data: null, error: { code: '42703', message: 'column sessions.demimot_active does not exist', details: null, hint: null } }
        }
        const rows = db.sessions
          .filter((row) => filters.every(([key, value]) => row[key] === value))
          // Comme PostgREST : seules les colonnes demandées et existantes.
          .map((row) => Object.fromEntries(columns.filter((c) => !(db.withoutDemiMotColumn && c === 'demimot_active')).map((c) => [c, row[c] ?? null])))
        return { data: rows, error: null }
      }
      const builder = {
        select: (columns: string) => { select = columns; if (table === 'sessions') db.selects.push(columns); return builder },
        eq: (key: string, value: unknown) => { filters.push([key, value]); return builder },
        gt: () => builder,
        in: () => builder,
        order: () => builder,
        insert: async () => ({ error: null }),
        maybeSingle: async () => {
          const r = result()
          return { data: r.error ? null : (r.data as Row[])[0] ?? null, error: r.error }
        },
        then: (resolve: (value: unknown) => void) => resolve(result()),
      }
      return builder
    },
  }),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))

import { GET as liveGet } from '@/app/api/public/live/[code]/route'
import { GET as inviteGet } from '@/app/api/public/invite/[code]/route'
import { isMissingOptionalColumn, selectWithOptionalColumns } from '@/lib/public-api/optional-columns'

const ID = '22222222-2222-4222-8222-222222222222'
const BASE: Row = {
  id: ID, code: 'ABCD', user_id: 'proprio', name: 'Mariage', is_active: true,
  quiz_active: false, quiz_lobby_visible: false, affinity_active: false,
  buzzer_active: false, vote_active: false, demimot_active: false,
}
const live = () => liveGet(new Request('http://x'), { params: Promise.resolve({ code: 'ABCD' }) })
const invite = () => inviteGet(new Request('http://x'), { params: Promise.resolve({ code: 'ABCD' }) })

beforeEach(() => {
  db.sessions = [{ ...BASE }]
  db.withoutDemiMotColumn = false
  db.outage = null
  db.selects = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('base SANS la colonne demimot_active (migration pas appliquée)', () => {
  it('/invite : 200, AnimaVote redirige toujours, À Demi-Mot inactif', async () => {
    db.withoutDemiMotColumn = true
    db.sessions[0] = { ...BASE, vote_active: true }
    const res = await invite()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.voteActive).toBe(true)
    expect(body.demimotActive).toBe(false)
    expect(body.session).not.toBeNull()
    // 1re lecture refusée (colonne inconnue), 2e sans elle.
    expect(db.selects).toHaveLength(2)
    expect(db.selects[1]).not.toContain('demimot_active')
  })

  it('/invite : chaque autre jeu garde sa redirection', async () => {
    db.withoutDemiMotColumn = true
    for (const flag of ['quiz_lobby_visible', 'affinity_active', 'buzzer_active', 'vote_active']) {
      db.sessions[0] = { ...BASE, [flag]: true }
      const body = await (await invite()).json()
      expect({ flag, quizLobby: body.quizLobby, affinityActive: body.affinityActive, buzzerActive: body.buzzerActive, voteActive: body.voteActive }).toEqual({
        flag,
        quizLobby: flag === 'quiz_lobby_visible',
        affinityActive: flag === 'affinity_active',
        buzzerActive: flag === 'buzzer_active',
        voteActive: flag === 'vote_active',
      })
      expect(body.demimotActive).toBe(false)
    }
  })

  it('/live : 200, la session et les autres jeux sont servis, À Demi-Mot inactif', async () => {
    db.withoutDemiMotColumn = true
    db.sessions[0] = { ...BASE, buzzer_active: true }
    const res = await live()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.session.buzzer_active).toBe(true)
    expect(body.session.demimot_active).toBe(false)
    expect(Array.isArray(body.photos)).toBe(true)
  })

  it('session inconnue : toujours 404 (pas masquée par la relecture)', async () => {
    db.withoutDemiMotColumn = true
    db.sessions = []
    expect((await invite()).status).toBe(404)
    expect((await live()).status).toBe(404)
  })
})

describe('base AVEC la colonne', () => {
  it('une seule lecture, À Demi-Mot transmis', async () => {
    db.sessions[0] = { ...BASE, demimot_active: true }
    expect((await (await invite()).json()).demimotActive).toBe(true)
    expect((await (await live()).json()).session.demimot_active).toBe(true)
    expect(db.selects).toHaveLength(2) // une par route
  })

  it('valeur illisible (null, texte) : À Demi-Mot inactif', async () => {
    for (const value of [null, 'true', 1, {}]) {
      db.sessions[0] = { ...BASE, demimot_active: value }
      expect((await (await invite()).json()).demimotActive).toBe(false)
      expect((await (await live()).json()).session.demimot_active).toBe(false)
    }
  })

  it('une vraie panne reste une panne : 503, sans seconde lecture', async () => {
    db.outage = 'statement timeout'
    expect((await invite()).status).toBe(503)
    expect((await live()).status).toBe(503)
    expect(db.selects).toHaveLength(2)
  })
})

describe('selectWithOptionalColumns (aussi utilisé par le basculement de session)', () => {
  it('reconnaît seulement une colonne facultative manquante', () => {
    expect(isMissingOptionalColumn({ code: '42703', message: 'column sessions.demimot_active does not exist' })).toBe(true)
    expect(isMissingOptionalColumn({ code: 'PGRST204', message: "Could not find the 'demimot_active' column of 'sessions' in the schema cache" })).toBe(true)
    expect(isMissingOptionalColumn({ code: '42703', message: 'column sessions.vote_active does not exist' })).toBe(false)
    expect(isMissingOptionalColumn({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(false)
    expect(isMissingOptionalColumn(null)).toBe(false)
  })

  it('relit sans la colonne une seule fois', async () => {
    const run = vi.fn(async (select: string) =>
      select.includes('demimot_active')
        ? { data: null, error: { code: '42703', message: 'column sessions.demimot_active does not exist' } }
        : { data: [{ id: 'x' }], error: null },
    )
    const result = await selectWithOptionalColumns(['id', 'name', 'vote_active', 'demimot_active'], run)
    expect(result.error).toBeNull()
    expect(run).toHaveBeenCalledTimes(2)
    expect(run.mock.calls[1][0]).toBe('id, name, vote_active')
  })

  it('AnimaBingo pas encore migré : seule bingo_active est retirée, À Demi-Mot reste lu', async () => {
    const run = vi.fn(async (select: string) =>
      select.includes('bingo_active')
        ? { data: null, error: { code: '42703', message: 'column sessions.bingo_active does not exist' } }
        : { data: [{ id: 'x' }], error: null },
    )
    const result = await selectWithOptionalColumns(['id', 'demimot_active', 'bingo_active'], run)
    expect(result.error).toBeNull()
    expect(run).toHaveBeenCalledTimes(2)
    expect(run.mock.calls[1][0]).toBe('id, demimot_active')
  })

  it('les deux colonnes absentes : deux relectures au plus, puis sans elles', async () => {
    const run = vi.fn(async (select: string) => {
      const missing = ['demimot_active', 'bingo_active'].find((c) => select.includes(c))
      return missing
        ? { data: null, error: { code: '42703', message: `column sessions.${missing} does not exist` } }
        : { data: [{ id: 'x' }], error: null }
    })
    const result = await selectWithOptionalColumns(['id', 'demimot_active', 'bingo_active'], run)
    expect(result.error).toBeNull()
    expect(run).toHaveBeenCalledTimes(3)
    expect(run.mock.calls[2][0]).toBe('id')
  })
})
