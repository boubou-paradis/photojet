// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildQuizArchive, openQuizArchive, precheckQuizArchive, tooBigMessage } from '../archive'
import { MO, QUIZ_DAMAGED_MESSAGE, QUIZ_INVALID_MESSAGE, QUIZ_LIMITS, parseQuizCsv } from '../format'
import { AUDIO, PHOTO, mediaRef, quizZipOf, textBytes, validCsv, validEntries, validManifest, validQuestions } from './fixtures'

async function bytesOf(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

async function readAll(file: Blob) {
  const archive = await openQuizArchive(file)
  for (const media of archive.manifest.media) await archive.readMedia(media)
  return archive
}

describe('aller-retour', () => {
  it('relit à l’identique ce que buildQuizArchive écrit', async () => {
    const manifest = validManifest()
    const entries = validEntries()
    const files = manifest.media.map((m) => ({ file: m.file, bytes: new Uint8Array(entries[m.file]) }))
    const zip = await buildQuizArchive(manifest, textBytes(validCsv()), files)
    const archive = await readAll(new Blob([zip]))
    expect(archive.manifest).toEqual(manifest)
    expect(parseQuizCsv(archive.csvText)).toEqual(validQuestions())
    expect(await archive.readMedia(manifest.media[2])).toEqual(PHOTO)
  })

  it('contient exactement le manifeste, quiz.csv et les médias, sans compression', async () => {
    const manifest = validManifest()
    const files = manifest.media.map((m) => ({ file: m.file, bytes: new Uint8Array(validEntries()[m.file]) }))
    const zip = await JSZip.loadAsync(await buildQuizArchive(manifest, textBytes(validCsv()), files))
    expect(Object.keys(zip.files).sort()).toEqual([
      'audio/001-question.mp3',
      'audio/001-revelation.mp3',
      'manifest.json',
      'photos/001.jpg',
      'quiz.csv',
    ])
  })

  it('tolère un zip refait en DEFLATE avec dossiers', async () => {
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(validManifest()))
    zip.file('quiz.csv', validCsv())
    for (const [name, bytes] of Object.entries(validEntries())) zip.file(name, bytes)
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
    await expect(readAll(new Blob([new Uint8Array(bytes)]))).resolves.toBeDefined()
  })

  it('accepte un quiz sans aucun média', async () => {
    const csv = validCsv(validQuestions().slice(1))
    const archive = await openQuizArchive(await quizZipOf(validManifest(csv, { media: [] }), {}, { csv }))
    expect(parseQuizCsv(archive.csvText)).toHaveLength(1)
  })
})

describe('contrôles avant ouverture', () => {
  it('refuse un fichier trop gros sans le lire', async () => {
    const huge = { size: QUIZ_LIMITS.zipBytes + 1 } as Blob
    await expect(precheckQuizArchive(huge)).rejects.toThrow('400 Mo')
  })

  it('le message de dépassement donne la taille réelle et conseille de diviser', () => {
    expect(tooBigMessage(512 * MO)).toMatch(/512 Mo.*400 Mo.*Divisez/)
  })

  it('refuse un fichier qui n’est pas un zip', async () => {
    await expect(openQuizArchive(new Blob(['question;reponse1\nQ;A']))).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse un fichier vide', async () => {
    await expect(openQuizArchive(new Blob([]))).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse un zip tronqué', async () => {
    const bytes = await bytesOf(await quizZipOf(validManifest()))
    await expect(openQuizArchive(new Blob([bytes.subarray(0, bytes.length - 40)]))).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse trop d’entrées avant d’ouvrir le zip', async () => {
    const entries: Record<string, Uint8Array> = {}
    for (let i = 0; i <= QUIZ_LIMITS.entries; i++) entries[`x${i}`] = textBytes('x')
    await expect(precheckQuizArchive(await quizZipOf(validManifest(), entries))).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse un zip illisible par un message clair', async () => {
    const bytes = await bytesOf(await quizZipOf(validManifest()))
    bytes.fill(0, 0, 30)
    await expect(openQuizArchive(new Blob([bytes]))).rejects.toThrow(/valide|abîmé/)
  })

  it('refuse un .zip Photo Mystère', async () => {
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({ format: 'animajet-photo-mystere', formatVersion: 1 }), { createFolders: false })
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    await expect(openQuizArchive(new Blob([new Uint8Array(bytes)]))).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })
})

describe('zips piégés', () => {
  it.each([
    ['remontée de dossier', '../../evil.mp3'],
    ['chemin absolu', '/abs.jpg'],
    ['chemin windows', 'C:\\win.jpg'],
    ['fichier caché', '.hidden'],
    ['dossier __MACOSX', '__MACOSX/._quiz.csv'],
    ['fichier caché dans un dossier', 'photos/.DS_Store'],
    ['exécutable', 'photos/virus.exe'],
    ['html', 'audio/index.html'],
    ['second csv', 'autre.csv'],
    ['numéro sur 2 chiffres', 'photos/01.jpg'],
  ])('refuse une entrée : %s', async (_, name) => {
    const file = await quizZipOf(validManifest(), { ...validEntries(), [name]: textBytes('x') })
    await expect(openQuizArchive(file)).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse un chemin sans danger apparent après nettoyage par JSZip', async () => {
    const entries = validEntries()
    delete entries['photos/001.jpg']
    const file = await quizZipOf(validManifest(), { ...entries, '../photos/001.jpg': PHOTO })
    await expect(openQuizArchive(file)).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse deux entrées de même nom', async () => {
    const entries = { ...validEntries(), 'photos/002.jpg': PHOTO }
    const bytes = Buffer.from(await bytesOf(await quizZipOf(validManifest(), entries)))
    let index = -1
    while ((index = bytes.indexOf('photos/002.jpg', index + 1)) !== -1) bytes.write('photos/001.jpg', index)
    await expect(openQuizArchive(new Blob([new Uint8Array(bytes)]))).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse un média absent du manifeste', async () => {
    const file = await quizZipOf(validManifest(), { ...validEntries(), 'photos/002.jpg': PHOTO })
    await expect(openQuizArchive(file)).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse un média annoncé mais absent', async () => {
    const entries = validEntries()
    delete entries['audio/001-question.mp3']
    await expect(openQuizArchive(await quizZipOf(validManifest(), entries))).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse un quiz.csv absent', async () => {
    await expect(openQuizArchive(await quizZipOf(validManifest(), validEntries(), { csv: null }))).rejects.toThrow(
      QUIZ_INVALID_MESSAGE
    )
  })

  it('refuse un quiz.csv modifié (empreinte)', async () => {
    const tampered = validCsv().replace('Canberra', 'Canberrb')
    await expect(openQuizArchive(await quizZipOf(validManifest(), validEntries(), { csv: tampered }))).rejects.toThrow(
      QUIZ_DAMAGED_MESSAGE
    )
  })

  it('refuse un quiz.csv qui n’est pas de l’UTF-8', async () => {
    const latin1 = Uint8Array.of(0x71, 0xe9, 0x3b) // « qé; » en Windows-1252
    const manifest = validManifest(undefined, {
      csv: { file: 'quiz.csv', size: latin1.length, sha256: mediaRef('x', 'audio/mpeg', latin1).sha256 },
    })
    await expect(openQuizArchive(await quizZipOf(manifest, validEntries(), { csv: latin1 }))).rejects.toThrow(
      QUIZ_INVALID_MESSAGE
    )
  })

  it('refuse un manifeste absent', async () => {
    const zip = new JSZip()
    zip.file('quiz.csv', validCsv(), { createFolders: false })
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    await expect(openQuizArchive(new Blob([new Uint8Array(bytes)]))).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse un manifeste qui n’est pas du JSON', async () => {
    await expect(openQuizArchive(await quizZipOf('{ pas du json'))).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse un manifeste trop gros, même compressé', async () => {
    const file = await quizZipOf(' '.repeat(QUIZ_LIMITS.manifestBytes + 1), validEntries(), { compression: 'DEFLATE' })
    await expect(openQuizArchive(file)).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('coupe une bombe zip à la taille annoncée', async () => {
    const bomb = new Uint8Array(30 * MO)
    const csv = validCsv(validQuestions().slice(1).map((q) => ({ ...q, photo: 'photos/001.jpg' })))
    const manifest = validManifest(csv, { media: [mediaRef('photos/001.jpg', 'image/jpeg', PHOTO)] })
    const file = await quizZipOf(manifest, { 'photos/001.jpg': bomb }, { csv, compression: 'DEFLATE' })
    expect(file.size).toBeLessThan(MO)
    const archive = await openQuizArchive(file)
    await expect(archive.readMedia(manifest.media[0])).rejects.toThrow(QUIZ_DAMAGED_MESSAGE)
  })

  it('détecte un octet abîmé dans un média', async () => {
    const bytes = await bytesOf(await quizZipOf(validManifest()))
    const start = Buffer.from(bytes).indexOf(Buffer.from(PHOTO.subarray(0, 12)))
    bytes[start + 20] ^= 0xff
    const archive = await openQuizArchive(new Blob([bytes]))
    await expect(archive.readMedia(archive.manifest.media[2])).rejects.toThrow(QUIZ_DAMAGED_MESSAGE)
  })

  it('refuse un faux type avec une empreinte correcte', async () => {
    const fake = textBytes('<html><script>alert(1)</script></html>')
    const manifest = validManifest(undefined, {
      media: [
        mediaRef('audio/001-question.mp3', 'audio/mpeg', AUDIO),
        mediaRef('audio/001-revelation.mp3', 'audio/mpeg', AUDIO),
        mediaRef('photos/001.jpg', 'image/jpeg', fake),
      ],
    })
    const archive = await openQuizArchive(await quizZipOf(manifest, { ...validEntries(), 'photos/001.jpg': fake }))
    await expect(archive.readMedia(manifest.media[2])).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse un audio caché dans le dossier photos', async () => {
    const manifest = validManifest(undefined, {
      media: [
        mediaRef('audio/001-question.mp3', 'audio/mpeg', AUDIO),
        mediaRef('audio/001-revelation.mp3', 'audio/mpeg', AUDIO),
        mediaRef('photos/001.jpg', 'image/jpeg', AUDIO),
      ],
    })
    const archive = await openQuizArchive(await quizZipOf(manifest, { ...validEntries(), 'photos/001.jpg': AUDIO }))
    await expect(archive.readMedia(manifest.media[2])).rejects.toThrow(QUIZ_INVALID_MESSAGE)
  })
})
