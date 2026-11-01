// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IMPORT_FAILED_MESSAGE, applyImport, type PreparedImport } from '../transfer'
import type { createClient } from '@/lib/supabase'
import { AUDIO, PHOTO, validManifest } from './fixtures'
import { manifestMedia } from '../format'

vi.mock('@/lib/image-utils', () => ({ compressImage: vi.fn(async (file: File) => file) }))
vi.mock('@/lib/audio-utils', () => ({ compressAudio: vi.fn(async (file: File) => file) }))

const OLD_PHOTOS = JSON.stringify([{ url: 'mystery-photos/old.jpg', audioUrl: 'mystery-audio/old.mp3' }])

interface FakeOptions {
  active?: boolean
  failUploadOf?: string
  updateError?: boolean
  updateMatchesNoRow?: boolean
  writtenDespiteError?: boolean
  otherSessionUses?: string
}

function fakeSupabase(options: FakeOptions = {}) {
  const uploaded: string[] = []
  const removed: string[][] = []
  const updates: Record<string, unknown>[] = []
  const row = {
    mystery_photos: OLD_PHOTOS,
    mystery_reveal_audio: 'mystery-audio/old-reveal.mp3',
    mystery_photo_grid: '6x4',
    mystery_photo_speed: 'slow',
    mystery_photo_active: options.active ?? false,
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
      }),
    },
    from: () => {
      let isUpdate = false
      let otherSessions = false
      const query = {
        select: () => query,
        eq: () => query,
        not: () => query,
        neq: () => {
          otherSessions = true
          return query
        },
        update: (values: Record<string, unknown>) => {
          isUpdate = true
          updates.push(values)
          return query
        },
        single: async () => ({ data: row, error: null }),
        then: (resolve: (value: unknown) => void) => {
          if (otherSessions) {
            const photos = options.otherSessionUses
              ? JSON.stringify([{ url: options.otherSessionUses, audioUrl: null }])
              : '[]'
            return resolve({ data: [{ mystery_photos: photos, mystery_reveal_audio: null }], error: null })
          }
          if (isUpdate) {
            if (options.updateError) {
              if (options.writtenDespiteError) row.mystery_photos = updates[0].mystery_photos as string
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
  return { client: client as unknown as ReturnType<typeof createClient>, uploaded, removed, updates }
}

function prepared(): PreparedImport {
  const manifest = validManifest()
  const media = new Map(
    manifestMedia(manifest).map((ref) => [
      ref.file,
      {
        media: ref,
        bytes: new Uint8Array(ref.type.startsWith('image') ? PHOTO : AUDIO),
        size: ref.type.startsWith('image') ? { width: 800, height: 600 } : null,
      },
    ])
  )
  return { manifest, media, totalBytes: 1000, audioCount: 1 }
}

const keepAll = async (paths: string[]) => paths

function run(fake: ReturnType<typeof fakeSupabase>, filter = keepAll) {
  return applyImport({
    supabase: fake.client,
    sessionId: 'session-1',
    userId: 'user-1',
    prepared: prepared(),
    filterPathsSafeToDelete: filter,
    now: () => 111,
  })
}

describe('applyImport', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('range les fichiers dans les dossiers habituels et écrit une seule fois', async () => {
    const fake = fakeSupabase()
    const result = await run(fake)
    expect(result.photos).toEqual([
      {
        url: 'mystery-photos/mystery_session-1_0_111.jpg',
        audioUrl: 'mystery-audio/mystery_audio_session-1_0_111.mp3',
      },
    ])
    expect(result.revealAudio).toBe('mystery-audio/mystery_reveal_session-1_111.mp3')
    expect(fake.updates).toHaveLength(1)
    expect(fake.updates[0]).toMatchObject({
      mystery_photos: JSON.stringify(result.photos),
      mystery_total_rounds: 1,
      mystery_photo_grid: '12x8',
      mystery_photo_speed: 'medium',
      mystery_reveal_audio: result.revealAudio,
      mystery_current_round: 1,
      mystery_revealed_tiles: [],
      mystery_is_playing: false,
    })
  })

  it('supprime les anciens fichiers seulement après l\'écriture', async () => {
    const fake = fakeSupabase()
    await run(fake)
    expect(fake.removed).toEqual([['mystery-photos/old.jpg', 'mystery-audio/old.mp3', 'mystery-audio/old-reveal.mp3']])
  })

  it('garde un fichier encore utilisé par une autre session', async () => {
    const fake = fakeSupabase({ otherSessionUses: 'mystery-photos/old.jpg' })
    await run(fake)
    expect(fake.removed[0]).not.toContain('mystery-photos/old.jpg')
  })

  it('garde un fichier protégé par la bibliothèque', async () => {
    const fake = fakeSupabase()
    await run(fake, async (paths) => paths.filter((path) => path !== 'mystery-audio/old.mp3'))
    expect(fake.removed[0]).not.toContain('mystery-audio/old.mp3')
  })

  it('refuse pendant une partie en cours, sans rien envoyer', async () => {
    const fake = fakeSupabase({ active: true })
    await expect(run(fake)).rejects.toThrow('partie est en cours')
    expect(fake.uploaded).toEqual([])
    expect(fake.updates).toEqual([])
  })

  it('retire les fichiers envoyés si un envoi échoue, sans toucher à la partie', async () => {
    const fake = fakeSupabase({ failUploadOf: 'mystery_reveal' })
    await expect(run(fake)).rejects.toThrow(IMPORT_FAILED_MESSAGE)
    expect(fake.updates).toEqual([])
    expect(fake.uploaded.length).toBeGreaterThan(0)
    expect(fake.removed.flat().sort()).toEqual([...fake.uploaded].sort())
  })

  it('retire les fichiers envoyés si l\'écriture finale échoue', async () => {
    const fake = fakeSupabase({ updateError: true })
    await expect(run(fake)).rejects.toThrow(IMPORT_FAILED_MESSAGE)
    expect(fake.removed.flat().sort()).toEqual([...fake.uploaded].sort())
  })

  it('n\'écrase pas une partie lancée entre-temps', async () => {
    const fake = fakeSupabase({ updateMatchesNoRow: true })
    await expect(run(fake)).rejects.toThrow('partie est en cours')
    expect(fake.removed.flat().sort()).toEqual([...fake.uploaded].sort())
  })

  it('garde les fichiers si l\'écriture a réussi malgré une réponse perdue', async () => {
    const fake = fakeSupabase({ updateError: true, writtenDespiteError: true })
    const result = await run(fake)
    expect(fake.removed.flat()).not.toContain(result.photos[0].url)
  })
})
