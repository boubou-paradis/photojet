import { describe, expect, it } from 'vitest'
import { ACCEPTED_MEDIA, sniffMedia } from '../media'

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)))

describe('sniffMedia (type réel d’après les premiers octets)', () => {
  it('reconnaît les images acceptées', () => {
    expect(sniffMedia(bytes([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ kind: 'image', ext: 'jpg' })
    expect(sniffMedia(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]))).toEqual({ kind: 'image', ext: 'png' })
    expect(sniffMedia(bytes('RIFF', [0, 0, 0, 0], 'WEBP'))).toEqual({ kind: 'image', ext: 'webp' })
  })
  it('reconnaît les audios acceptés', () => {
    expect(sniffMedia(bytes('ID3', [4, 0, 0]))).toEqual({ kind: 'audio', ext: 'mp3' })
    expect(sniffMedia(bytes([0xff, 0xfb, 0x90, 0x64]))).toEqual({ kind: 'audio', ext: 'mp3' })
    expect(sniffMedia(bytes([0xff, 0xf1, 0x50, 0x80]))).toEqual({ kind: 'audio', ext: 'aac' })
    expect(sniffMedia(bytes('RIFF', [0, 0, 0, 0], 'WAVE'))).toEqual({ kind: 'audio', ext: 'wav' })
    expect(sniffMedia(bytes('OggS', [0, 2]))).toEqual({ kind: 'audio', ext: 'ogg' })
    expect(sniffMedia(bytes('fLaC', [0, 0, 0, 34]))).toEqual({ kind: 'audio', ext: 'flac' })
    expect(sniffMedia(bytes([0, 0, 0, 0x20], 'ftyp', 'M4A '))).toEqual({ kind: 'audio', ext: 'm4a' })
  })
  it('refuse le reste (exécutable, PDF, HTML, vidéo, fichier vide)', () => {
    expect(sniffMedia(bytes('MZ', [0x90, 0]))).toBeNull()
    expect(sniffMedia(bytes('%PDF-1.7'))).toBeNull()
    expect(sniffMedia(bytes('<!doctype html>'))).toBeNull()
    expect(sniffMedia(bytes([0, 0, 0, 0x20], 'ftyp', 'qt  '))).toBeNull()
    expect(sniffMedia(new Uint8Array())).toBeNull()
  })
})

describe('ACCEPTED_MEDIA', () => {
  it('impose l’extension d’après le type annoncé', () => {
    expect(ACCEPTED_MEDIA['audio/mpeg']).toMatchObject({ kind: 'audio', ext: 'mp3' })
    expect(ACCEPTED_MEDIA['image/jpeg']).toMatchObject({ kind: 'image', ext: 'jpg' })
    expect(ACCEPTED_MEDIA['text/html']).toBeUndefined()
    expect(ACCEPTED_MEDIA['image/svg+xml']).toBeUndefined()
  })
})
