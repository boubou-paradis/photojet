// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it } from 'vitest'
import {
  INVALID_FILE_MESSAGE,
  LIMITS,
  MO,
  NEWER_VERSION_MESSAGE,
  exportFileName,
  parseManifest,
  sniffMediaType,
} from '../format'
import { AUDIO, PHOTO, mediaRef, mp3WithMetadata, pngWithMetadata, textBytes, validManifest, wavWithMetadata, webpWithMetadata } from './fixtures'

const clone = () => JSON.parse(JSON.stringify(validManifest()))
const refused = (value: unknown) => expect(() => parseManifest(value)).toThrow(INVALID_FILE_MESSAGE)

describe('parseManifest', () => {
  it('accepte un manifeste complet', () => {
    expect(parseManifest(clone())).toEqual(validManifest())
  })

  it('accepte une partie sans audio', () => {
    const manifest = validManifest({
      revealAudio: null,
      photos: [{ image: mediaRef('photos/01.jpg', 'image/jpeg', PHOTO), audio: null }],
    })
    expect(parseManifest(manifest).revealAudio).toBeNull()
  })

  it("annonce une version plus récente plutôt qu'un fichier invalide", () => {
    expect(() => parseManifest({ ...clone(), formatVersion: 2 })).toThrow(NEWER_VERSION_MESSAGE)
  })

  it.each([
    ['version nulle', { formatVersion: 0 }],
    ['version décimale', { formatVersion: 1.5 }],
    ['autre format', { format: 'autre' }],
    ['grille inconnue', { settings: { grid: '3x3', speed: 'medium' } }],
    ['vitesse inconnue', { settings: { grid: '12x8', speed: 'turbo' } }],
    ['nom vide', { name: '   ' }],
    ['nom trop long', { name: 'x'.repeat(LIMITS.nameLength + 1) }],
    ['nom avec retour ligne', { name: 'a\nb' }],
    ['nom non texte', { name: 12 }],
    ['date invalide', { exportedOn: 'hier' }],
    ['aucune photo', { photos: [] }],
    ['clé en trop', { email: 'a@b.fr' }],
  ])('refuse : %s', (_, change) => {
    refused({ ...clone(), ...change })
  })

  it('refuse une clé __proto__', () => {
    refused(JSON.parse(JSON.stringify(clone()).replace('"format"', '"__proto__":{"x":1},"format"')))
  })

  it('refuse plus de 20 photos', () => {
    const photo = clone().photos[0]
    refused({ ...clone(), photos: Array(LIMITS.photos + 1).fill(photo) })
  })

  it.each([
    ['chemin remontant', '../../evil.jpg'],
    ['chemin absolu', '/etc/passwd'],
    ['mauvais numéro', 'photos/02.jpg'],
    ['extension menteuse', 'photos/01.html'],
  ])('refuse un fichier : %s', (_, file) => {
    const manifest = clone()
    manifest.photos[0].image.file = file
    refused(manifest)
  })

  it('refuse un type interdit', () => {
    const manifest = clone()
    manifest.photos[0].image.type = 'image/svg+xml'
    refused(manifest)
  })

  it('refuse une image déclarée comme audio', () => {
    const manifest = clone()
    manifest.photos[0].audio.type = 'image/jpeg'
    refused(manifest)
  })

  it('refuse une empreinte mal formée', () => {
    const manifest = clone()
    manifest.photos[0].image.sha256 = 'abc'
    refused(manifest)
  })

  it('refuse une photo de plus de 8 Mo', () => {
    const manifest = clone()
    manifest.photos[0].image.size = 8 * MO + 1
    expect(() => parseManifest(manifest)).toThrow('8 Mo')
  })

  it('refuse un audio de plus de 25 Mo', () => {
    const manifest = clone()
    manifest.revealAudio.size = 25 * MO + 1
    expect(() => parseManifest(manifest)).toThrow('25 Mo')
  })

  it('refuse un total de plus de 250 Mo', () => {
    const base = clone()
    const photos = Array.from({ length: 20 }, (_, index) => {
      const stem = String(index + 1).padStart(2, '0')
      return {
        image: { ...base.photos[0].image, file: `photos/${stem}.jpg` },
        audio: { ...base.photos[0].audio, file: `audio/${stem}.mp3`, size: 13 * MO },
      }
    })
    expect(() => parseManifest({ ...base, photos })).toThrow('250 Mo')
  })
})

describe('exportFileName', () => {
  it('produit un nom lisible et sûr', () => {
    expect(exportFileName('Stars des années 80 !', '2026-11-02')).toBe('PhotoMystere-Stars-des-annees-80-2026-11-02.zip')
  })

  it('neutralise un nom piégé', () => {
    expect(exportFileName('../../..', '2026-11-02')).toBe('PhotoMystere-partie-2026-11-02.zip')
  })
})

describe('sniffMediaType', () => {
  it('reconnaît les types autorisés à leur contenu', () => {
    expect(sniffMediaType(PHOTO)).toBe('image/jpeg')
    expect(sniffMediaType(pngWithMetadata())).toBe('image/png')
    expect(sniffMediaType(webpWithMetadata())).toBe('image/webp')
    expect(sniffMediaType(AUDIO)).toBe('audio/mpeg')
    expect(sniffMediaType(mp3WithMetadata())).toBe('audio/mpeg')
    expect(sniffMediaType(wavWithMetadata())).toBe('audio/wav')
    expect(sniffMediaType(textBytes('OggS\0\0\0\0\0\0\0\0'))).toBe('audio/ogg')
  })

  it.each([
    ['HTML', '<html><script>alert(1)</script></html>'],
    ['SVG', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
    ['GIF', 'GIF89a..........'],
    ['exécutable', 'MZ..............'],
    ['trop court', 'abc'],
  ])('refuse : %s', (_, content) => {
    expect(sniffMediaType(textBytes(content))).toBeNull()
  })
})
