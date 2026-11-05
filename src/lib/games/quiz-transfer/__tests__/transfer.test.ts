// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it, vi } from 'vitest'
import type { createClient } from '@/lib/supabase'
import {
  QUIZ_IMPORT_FAILED_MESSAGE,
  QUIZ_RUNNING_MESSAGE,
  applyQuizImport,
  exportFileName,
  exportItems,
  readQuizSnapshot,
  storagePath,
  type PreparedQuizImport,
} from '../transfer'
import { AUDIO, PHOTO, validManifest, validQuestions } from './fixtures'

vi.mock('@/lib/image-utils', () => ({ compressImage: vi.fn(async (file: File) => file) }))
vi.mock('@/lib/audio-utils', () => ({
  compressAudio: vi.fn(async (file: File) => file),
  needsAudioCompression: (file: File) => file.size > 1024 * 1024,
}))

const PUBLIC = 'https://proj.supabase.co/storage/v1/object/public/photos/'
const OLD_QUESTIONS = JSON.stringify([
  { id: 'old', question: 'Ancienne ?', answers: ['A', 'B', 'C', 'D'], correctAnswer: 0, timeLimit: 20, points: 10, photoUrl: `${PUBLIC}quiz-photos/old.jpg` },
])

interface FakeOptions {
  active?: boolean
  lobby?: boolean
  failUploadOf?: string
  updateError?: boolean
  updateMatchesNoRow?: boolean
  writtenDespiteError?: boolean
}

function fakeSupabase(options: FakeOptions = {}) {
  const uploaded: string[] = []
  const removed: string[][] = []
  const updates: Record<string, unknown>[] = []
  const filters: string[] = []
  const row = {
    quiz_questions: OLD_QUESTIONS,
    quiz_active: options.active ?? false,
    quiz_lobby_visible: options.lobby ?? null,
  }
  const client = {
    storage: {
      from: () => ({
        upload: async (path: string) => {
          if (options.failUploadOf && path.includes(options.failUploadOf)) return { error: new Error('réseau') }
          uploaded.push(path)
          return { error: null }
        },
        remove: async (paths: string[]) => {
          removed.push(paths)
          return { error: null }
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `${PUBLIC}${path}` } }),
      }),
    },
    from: () => {
      let isUpdate = false
      const query = {
        select: () => query,
        eq: () => query,
        not: (column: string, op: string, value: unknown) => {
          filters.push(`${column} ${op} ${value}`)
          return query
        },
        update: (values: Record<string, unknown>) => {
          isUpdate = true
          updates.push(values)
          return query
        },
        single: async () => ({ data: row, error: null }),
        then: (resolve: (value: unknown) => void) => {
          if (isUpdate) {
            if (options.updateError) {
              if (options.writtenDespiteError) row.quiz_questions = updates[0].quiz_questions as string
              return resolve({ data: null, error: new Error('coupure') })
            }
            return resolve({ data: options.updateMatchesNoRow ? [] : [{ id: 's1' }], error: null })
          }
          return resolve({ data: row, error: null })
        },
      }
      return query
    },
  }
  return { client: client as unknown as ReturnType<typeof createClient>, uploaded, removed, updates, filters }
}

function prepared(): PreparedQuizImport {
  const manifest = validManifest()
  const bytesOf = (file: string) => (file.startsWith('photos/') ? PHOTO : AUDIO)
  return {
    manifest,
    questions: validQuestions(),
    media: new Map(
      manifest.media.map((m) => [
        m.file,
        { media: m, bytes: new Uint8Array(bytesOf(m.file)), size: m.file.startsWith('photos/') ? { width: 10, height: 10 } : null },
      ])
    ),
    totalBytes: 1000,
    audioCount: 2,
    photoCount: 1,
  }
}

describe('readQuizSnapshot', () => {
  it('lobby ouvert ou quiz lancé = partie en cours', async () => {
    expect((await readQuizSnapshot(fakeSupabase().client, 's1')).running).toBe(false)
    expect((await readQuizSnapshot(fakeSupabase({ lobby: true }).client, 's1')).running).toBe(true)
    expect((await readQuizSnapshot(fakeSupabase({ active: true }).client, 's1')).running).toBe(true)
  })
})

describe('applyQuizImport', () => {
  it('envoie les médias dans les dossiers habituels puis écrit une seule fois quiz_questions', async () => {
    const fake = fakeSupabase()
    const result = await applyQuizImport({ supabase: fake.client, sessionId: 's1', prepared: prepared(), now: () => 777 })

    expect(fake.uploaded.sort()).toEqual([
      'quiz-audio/s1_777_0_777.mp3',
      'quiz-photos/s1_777_0_777.jpg',
      'quiz-question-audio/s1_777_0_777.mp3',
    ])
    expect(fake.updates).toHaveLength(1)
    expect(Object.keys(fake.updates[0])).toEqual(['quiz_questions'])
    expect(fake.filters).toEqual(['quiz_active is true', 'quiz_lobby_visible is true'])

    const [first, second] = result.questions
    expect(first).toMatchObject({
      id: '777_0',
      audioUrl: `${PUBLIC}quiz-audio/s1_777_0_777.mp3`,
      questionAudioUrl: `${PUBLIC}quiz-question-audio/s1_777_0_777.mp3`,
      photoUrl: `${PUBLIC}quiz-photos/s1_777_0_777.jpg`,
      audioStart: 0,
      audioEnd: 32.5,
      questionAudioStart: 12,
      questionAudioEnd: 27.125,
      revealDuration: -1,
    })
    expect(second).toEqual({
      id: '777_1',
      question: 'Capitale de l’Australie ?',
      answers: ['Sydney', 'Canberra', 'Melbourne', 'Perth'],
      correctAnswer: 1,
      timeLimit: 15,
      points: 5,
      revealDuration: 5,
    })
    expect(result.penaltyPoints).toBe(2)
    expect(JSON.parse(fake.updates[0].quiz_questions as string)).toEqual(result.questions)
  })

  it('ne supprime jamais les fichiers de l’ancien quiz', async () => {
    const fake = fakeSupabase()
    await applyQuizImport({ supabase: fake.client, sessionId: 's1', prepared: prepared() })
    expect(fake.removed).toEqual([])
  })

  it('refuse pendant une partie, sans rien envoyer', async () => {
    for (const options of [{ active: true }, { lobby: true }]) {
      const fake = fakeSupabase(options)
      await expect(applyQuizImport({ supabase: fake.client, sessionId: 's1', prepared: prepared() })).rejects.toThrow(
        QUIZ_RUNNING_MESSAGE
      )
      expect(fake.uploaded).toEqual([])
      expect(fake.updates).toEqual([])
    }
  })

  it('un envoi échoué retire les fichiers déjà envoyés et ne touche pas au quiz', async () => {
    const fake = fakeSupabase({ failUploadOf: 'quiz-photos' })
    await expect(applyQuizImport({ supabase: fake.client, sessionId: 's1', prepared: prepared() })).rejects.toThrow(
      QUIZ_IMPORT_FAILED_MESSAGE
    )
    expect(fake.updates).toEqual([])
    expect(fake.removed.flat().sort()).toEqual([...fake.uploaded].sort())
  })

  it('une partie lancée entre-temps : fichiers retirés, quiz intact', async () => {
    const fake = fakeSupabase({ updateMatchesNoRow: true })
    await expect(applyQuizImport({ supabase: fake.client, sessionId: 's1', prepared: prepared() })).rejects.toThrow(
      QUIZ_RUNNING_MESSAGE
    )
    expect(fake.removed.flat().sort()).toEqual([...fake.uploaded].sort())
  })

  it('écriture en échec confirmée : fichiers retirés', async () => {
    const fake = fakeSupabase({ updateError: true })
    await expect(applyQuizImport({ supabase: fake.client, sessionId: 's1', prepared: prepared() })).rejects.toThrow(
      QUIZ_IMPORT_FAILED_MESSAGE
    )
    expect(fake.removed.flat()).toHaveLength(3)
  })

  it('réponse perdue mais écriture passée : fichiers gardés, import réussi', async () => {
    const fake = fakeSupabase({ updateError: true, writtenDespiteError: true })
    const result = await applyQuizImport({ supabase: fake.client, sessionId: 's1', prepared: prepared() })
    expect(result.questions).toHaveLength(2)
    expect(fake.removed).toEqual([])
  })
})

describe('exportItems', () => {
  const base = { id: '1', question: 'Q', answers: ['A', 'B', 'C', 'D'], correctAnswer: 0, timeLimit: 20, points: 10 }

  it('nomme les médias par question', () => {
    const items = exportItems(
      [
        { ...base, photoUrl: `${PUBLIC}quiz-photos/a.jpg` },
        { ...base, audioUrl: `${PUBLIC}quiz-audio/b.mp3`, questionAudioUrl: `${PUBLIC}quiz-question-audio/c.mp3` },
      ],
      PUBLIC
    )
    expect(items.map((i) => i.stem)).toEqual(['photos/001', 'audio/002-question', 'audio/002-revelation'])
  })

  it('refuse un média jamais envoyé (adresse locale) en nommant la question', () => {
    expect(() => exportItems([base, { ...base, audioUrl: 'blob:http://localhost/x' }], PUBLIC)).toThrow(
      /Question 2 : l'audio de la réponse/
    )
  })

  it('ne télécharge jamais une adresse hors du stockage AnimaJet', () => {
    expect(() => exportItems([{ ...base, photoUrl: 'https://evil.example/x.jpg' }], PUBLIC)).toThrow('Question 1')
    expect(() => exportItems([{ ...base, photoUrl: PUBLIC }], PUBLIC)).toThrow('Question 1')
  })
})

describe('noms de fichiers', () => {
  it('Quiz-<nom>-<date>.zip en caractères sûrs', () => {
    expect(exportFileName('Blind test : mariage d’Élodie !', '2026-11-05')).toBe('Quiz-Blind-test-mariage-d-Elodie-2026-11-05.zip')
    expect(exportFileName('🎉', '2026-11-05')).toBe('Quiz-quiz-2026-11-05.zip')
  })

  it('chemins de stockage identiques à l’éditeur', () => {
    expect(storagePath('s', 'audio/004-question.ogg', 'q', 'audio/ogg', 9)).toBe('quiz-question-audio/s_q_9.ogg')
    expect(storagePath('s', 'audio/004-revelation.mp3', 'q', 'audio/mpeg', 9)).toBe('quiz-audio/s_q_9.mp3')
    expect(storagePath('s', 'photos/004.png', 'q', 'image/png', 9)).toBe('quiz-photos/s_q_9.png')
  })
})
