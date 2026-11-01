// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildArchive, openArchive, precheckArchive } from '../archive'
import { DAMAGED_FILE_MESSAGE, INVALID_FILE_MESSAGE, LIMITS, MO, manifestMedia } from '../format'
import { AUDIO, PHOTO, mediaRef, textBytes, validEntries, validManifest, zipOf } from './fixtures'

async function bytesOf(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

async function readAll(file: Blob) {
  const archive = await openArchive(file)
  for (const media of manifestMedia(archive.manifest)) await archive.readMedia(media)
  return archive
}

describe('aller-retour', () => {
  it('relit à l\'identique ce que buildArchive écrit', async () => {
    const manifest = validManifest()
    const entries = validEntries()
    const files = manifestMedia(manifest).map((media) => ({
      media,
      bytes: new Uint8Array(entries[media.file]),
    }))
    const archive = await openArchive(new Blob([await buildArchive(manifest, files)]))
    expect(archive.manifest).toEqual(manifest)
    expect(await archive.readMedia(manifest.photos[0].image)).toEqual(PHOTO)
  })

  it('ne contient aucune compression ni nom interne', async () => {
    const manifest = validManifest()
    const files = manifestMedia(manifest).map((media) => ({ media, bytes: new Uint8Array(validEntries()[media.file]) }))
    const zip = await JSZip.loadAsync(await buildArchive(manifest, files))
    expect(Object.keys(zip.files).sort()).toEqual(['audio/01.mp3', 'audio/reveal.mp3', 'manifest.json', 'photos/01.jpg'])
  })

  it('tolère un zip refait en DEFLATE avec dossiers', async () => {
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(validManifest()))
    for (const [name, bytes] of Object.entries(validEntries())) zip.file(name, bytes)
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
    await expect(readAll(new Blob([new Uint8Array(bytes)]))).resolves.toBeDefined()
  })
})

describe('contrôles avant ouverture', () => {
  it('refuse un fichier trop gros sans le lire', async () => {
    const huge = { size: LIMITS.zipBytes + 1 } as Blob
    await expect(precheckArchive(huge)).rejects.toThrow('250 Mo')
  })

  it('refuse un fichier qui n\'est pas un zip', async () => {
    await expect(openArchive(new Blob(['ceci n\'est pas un zip, seulement du texte']))).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse un fichier vide', async () => {
    await expect(openArchive(new Blob([]))).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse un zip tronqué', async () => {
    const bytes = await bytesOf(await zipOf(validManifest()))
    await expect(openArchive(new Blob([bytes.subarray(0, bytes.length - 40)]))).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse trop d\'entrées avant d\'ouvrir le zip', async () => {
    const entries: Record<string, Uint8Array> = {}
    for (let i = 0; i <= LIMITS.entries; i++) entries[`x${i}`] = textBytes('x')
    await expect(precheckArchive(await zipOf(validManifest(), entries))).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse un zip chiffré ou illisible par un message clair', async () => {
    const bytes = await bytesOf(await zipOf(validManifest()))
    bytes.fill(0, 0, 30) // en-tête local détruit, répertoire final intact
    await expect(openArchive(new Blob([bytes]))).rejects.toThrow(/valide|abîmé/)
  })
})

describe('zips piégés', () => {
  it.each([
    ['remontée de dossier', '../../evil.jpg'],
    ['chemin absolu', '/abs.jpg'],
    ['chemin windows', 'C:\\win.jpg'],
    ['fichier caché', '.hidden'],
    ['dossier __MACOSX', '__MACOSX/._photo'],
    ['fichier caché dans un dossier', 'photos/.DS_Store'],
    ['exécutable', 'photos/virus.exe'],
    ['html', 'audio/index.html'],
  ])('refuse une entrée : %s', async (_, name) => {
    const file = await zipOf(validManifest(), { ...validEntries(), [name]: textBytes('x') })
    await expect(openArchive(file)).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse un chemin sans danger apparent après nettoyage par JSZip', async () => {
    // JSZip réduit ce nom à `photos/01.jpg` : seul le nom d'origine trahit le piège.
    const entries = validEntries()
    delete entries['photos/01.jpg']
    const file = await zipOf(validManifest(), { ...entries, '../photos/01.jpg': PHOTO })
    await expect(openArchive(file)).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse deux entrées de même nom', async () => {
    const entries = { ...validEntries(), 'photos/02.jpg': PHOTO }
    const bytes = Buffer.from(await bytesOf(await zipOf(validManifest(), entries)))
    let index = -1
    while ((index = bytes.indexOf('photos/02.jpg', index + 1)) !== -1) bytes.write('photos/01.jpg', index)
    await expect(openArchive(new Blob([new Uint8Array(bytes)]))).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse un média absent du manifeste', async () => {
    const file = await zipOf(validManifest(), { ...validEntries(), 'photos/02.jpg': PHOTO })
    await expect(openArchive(file)).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse un média annoncé mais absent', async () => {
    const entries = validEntries()
    delete entries['audio/reveal.mp3']
    await expect(openArchive(await zipOf(validManifest(), entries))).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse un manifeste absent', async () => {
    const zip = new JSZip()
    zip.file('photos/01.jpg', PHOTO, { createFolders: false })
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    await expect(openArchive(new Blob([new Uint8Array(bytes)]))).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse un manifeste qui n\'est pas du JSON', async () => {
    await expect(openArchive(await zipOf('{ pas du json'))).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse un manifeste de plus de 64 Ko, même compressé', async () => {
    const file = await zipOf(' '.repeat(LIMITS.manifestBytes + 1), validEntries(), 'DEFLATE')
    await expect(openArchive(file)).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('coupe une bombe zip à la taille annoncée', async () => {
    // Le manifeste annonce 42 octets, l'entrée en contient 30 Mo très compressibles.
    const bomb = new Uint8Array(30 * MO)
    const manifest = validManifest({
      revealAudio: null,
      photos: [{ image: mediaRef('photos/01.jpg', 'image/jpeg', PHOTO), audio: null }],
    })
    const file = await zipOf(manifest, { 'photos/01.jpg': bomb }, 'DEFLATE')
    expect(file.size).toBeLessThan(MO)
    const archive = await openArchive(file)
    await expect(archive.readMedia(manifest.photos[0].image)).rejects.toThrow(DAMAGED_FILE_MESSAGE)
  })

  it('détecte un octet abîmé', async () => {
    const bytes = await bytesOf(await zipOf(validManifest()))
    const start = Buffer.from(bytes).indexOf(Buffer.from(PHOTO.subarray(0, 12)))
    bytes[start + 20] ^= 0xff
    const archive = await openArchive(new Blob([bytes]))
    await expect(archive.readMedia(archive.manifest.photos[0].image)).rejects.toThrow(DAMAGED_FILE_MESSAGE)
  })

  it('refuse un faux type avec une empreinte correcte', async () => {
    const fake = textBytes('<html><script>alert(1)</script></html>')
    const manifest = validManifest({
      revealAudio: null,
      photos: [{ image: mediaRef('photos/01.jpg', 'image/jpeg', fake), audio: null }],
    })
    const archive = await openArchive(await zipOf(manifest, { 'photos/01.jpg': fake }))
    await expect(archive.readMedia(manifest.photos[0].image)).rejects.toThrow(INVALID_FILE_MESSAGE)
  })

  it('refuse un audio caché dans le dossier photo', async () => {
    const manifest = validManifest({
      revealAudio: null,
      photos: [{ image: mediaRef('photos/01.jpg', 'image/jpeg', AUDIO), audio: null }],
    })
    const archive = await openArchive(await zipOf(manifest, { 'photos/01.jpg': AUDIO }))
    await expect(archive.readMedia(manifest.photos[0].image)).rejects.toThrow(INVALID_FILE_MESSAGE)
  })
})
