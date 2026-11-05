import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canDeleteQuizMedia, collectQuizMediaPaths, quizMediaPath } from '../media-in-use'

const BASE = 'https://x.supabase.co/storage/v1/object/public/photos/'
const P = (name: string) => `${BASE}quiz-photos/${name}`

type Rows = { saved?: unknown[]; sessions?: unknown[]; savedError?: boolean; sessionsError?: boolean; user?: string | null; throws?: boolean }

function fakeSupabase(rows: Rows) {
  const calls: { table: string; filters: [string, string, unknown][] }[] = []
  const builder = (table: string) => {
    const filters: [string, string, unknown][] = []
    calls.push({ table, filters })
    const result = table === 'saved_quizzes'
      ? { data: rows.savedError ? null : rows.saved ?? [], error: rows.savedError ? { message: 'x' } : null }
      : { data: rows.sessionsError ? null : rows.sessions ?? [], error: rows.sessionsError ? { message: 'x' } : null }
    const b = {
      select: () => b,
      eq: (c: string, v: unknown) => { filters.push(['eq', c, v]); return b },
      neq: (c: string, v: unknown) => { filters.push(['neq', c, v]); return b },
      then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
    }
    return b
  }
  const client = {
    auth: {
      getUser: async () => {
        if (rows.throws) throw new Error('réseau')
        return rows.user === null ? { data: { user: null }, error: null } : { data: { user: { id: rows.user ?? 'u1' } }, error: null }
      },
    },
    from: builder,
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('quizMediaPath', () => {
  it('extrait le chemin de l’adresse publique', () => {
    expect(quizMediaPath(P('s_1_2.jpg'))).toBe('quiz-photos/s_1_2.jpg')
    expect(quizMediaPath(`${P('s_1_2.jpg')}?t=3`)).toBe('quiz-photos/s_1_2.jpg')
    expect(quizMediaPath(`${BASE}quiz-audio/a%20b.mp3`)).toBe('quiz-audio/a b.mp3')
    expect(quizMediaPath('quiz-audio/x.mp3')).toBe('quiz-audio/x.mp3')
    expect(quizMediaPath(null)).toBeNull()
    expect(quizMediaPath('')).toBeNull()
  })
})

describe('collectQuizMediaPaths', () => {
  it('lit les 3 médias, en tableau ou en JSON texte', () => {
    const qs = [{ photoUrl: P('a.jpg'), audioUrl: `${BASE}quiz-audio/b.mp3`, questionAudioUrl: `${BASE}quiz-question-audio/c.mp3` }, null, { photoUrl: null }]
    const want = ['quiz-photos/a.jpg', 'quiz-audio/b.mp3', 'quiz-question-audio/c.mp3']
    expect([...collectQuizMediaPaths(qs)]).toEqual(want)
    expect([...collectQuizMediaPaths(JSON.stringify(qs))]).toEqual(want)
  })
  it('ignore le JSON invalide et les valeurs vides', () => {
    expect(collectQuizMediaPaths('{pas du json').size).toBe(0)
    expect(collectQuizMediaPaths(null).size).toBe(0)
    expect(collectQuizMediaPaths({}).size).toBe(0)
  })
})

describe('canDeleteQuizMedia', () => {
  const url = P('s1_q1_1.jpg')
  const opts = { url, sessionId: 's1', remainingQuestions: [] }

  it('utilisé nulle part : suppression autorisée, requêtes limitées au compte et aux AUTRES sessions', async () => {
    const { client, calls } = fakeSupabase({ saved: [{ questions: [{ photoUrl: P('autre.jpg') }] }], sessions: [{ id: 's2', quiz_questions: '[]' }] })
    expect(await canDeleteQuizMedia(client, opts)).toBe(true)
    expect(calls.find((c) => c.table === 'saved_quizzes')?.filters).toEqual([['eq', 'user_id', 'u1']])
    expect(calls.find((c) => c.table === 'sessions')?.filters).toEqual([['eq', 'user_id', 'u1'], ['neq', 'id', 's1']])
  })
  it('utilisé par un quiz sauvegardé : conservé', async () => {
    const { client } = fakeSupabase({ saved: [{ questions: [{ audioUrl: `${url}?v=2` }] }] })
    expect(await canDeleteQuizMedia(client, opts)).toBe(false)
  })
  it('utilisé par une autre session (JSON texte) : conservé', async () => {
    const { client } = fakeSupabase({ sessions: [{ id: 's2', quiz_questions: JSON.stringify([{ photoUrl: url }]) }] })
    expect(await canDeleteQuizMedia(client, opts)).toBe(false)
  })
  it('encore utilisé par une autre question du quiz en cours : conservé', async () => {
    const { client } = fakeSupabase({})
    expect(await canDeleteQuizMedia(client, { ...opts, remainingQuestions: [{ photoUrl: url }] })).toBe(false)
  })
  it('toute erreur ou doute : conservé', async () => {
    expect(await canDeleteQuizMedia(fakeSupabase({ savedError: true }).client, opts)).toBe(false)
    expect(await canDeleteQuizMedia(fakeSupabase({ sessionsError: true }).client, opts)).toBe(false)
    expect(await canDeleteQuizMedia(fakeSupabase({ user: null }).client, opts)).toBe(false)
    expect(await canDeleteQuizMedia(fakeSupabase({ throws: true }).client, opts)).toBe(false)
    expect(await canDeleteQuizMedia(fakeSupabase({}).client, { ...opts, url: '' })).toBe(false)
  })
})
