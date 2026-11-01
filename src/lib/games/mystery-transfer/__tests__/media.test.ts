// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it } from 'vitest'
import { TransferError } from '../format'
import {
  stripJpegMetadata,
  stripMetadata,
  stripMp3Metadata,
  stripPngMetadata,
  stripWavMetadata,
  stripWebpMetadata,
} from '../media'
import {
  JPEG_SCAN,
  MP3_FRAMES,
  jpegWithMetadata,
  mp3WithMetadata,
  pngWithMetadata,
  textBytes,
  wavWithMetadata,
  webpWithMetadata,
} from './fixtures'

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1')
const contains = (bytes: Uint8Array, part: Uint8Array) => Buffer.from(bytes).includes(Buffer.from(part))

describe('JPEG', () => {
  it('retire EXIF, GPS, XMP et commentaire', () => {
    const output = text(stripJpegMetadata(jpegWithMetadata()))
    for (const secret of ['Exif', 'GPS', 'Canon', 'xmp', 'Auteur']) expect(output).not.toContain(secret)
  })

  it('conserve JFIF, le profil couleur et les données d\'image à l\'octet près', () => {
    const output = stripJpegMetadata(jpegWithMetadata())
    expect(text(output)).toContain('JFIF')
    expect(text(output)).toContain('ICC_PROFILE')
    expect(contains(output, JPEG_SCAN)).toBe(true)
    expect([...output.subarray(-2)]).toEqual([0xff, 0xd9])
  })

  it('retire ce qui suit la fin d\'image', () => {
    expect(text(stripJpegMetadata(jpegWithMetadata({ trailer: true })))).not.toContain('thumbnail')
  })

  it('conserve seulement l\'orientation, sinon la photo pivoterait', () => {
    const output = stripJpegMetadata(jpegWithMetadata({ orientation: 6 }))
    expect(text(output)).toContain('Exif')
    expect(text(output)).not.toContain('GPS')
    const position = Buffer.from(output).indexOf('Exif')
    expect(Buffer.from(output).readUInt16LE(position + 6 + 18)).toBe(6)
  })

  it('n\'ajoute pas d\'EXIF pour une orientation normale', () => {
    expect(text(stripJpegMetadata(jpegWithMetadata({ orientation: 1 })))).not.toContain('Exif')
  })

  it('est idempotent', () => {
    const once = stripJpegMetadata(jpegWithMetadata({ orientation: 3 }))
    expect(stripJpegMetadata(once)).toEqual(once)
  })
})

describe('PNG', () => {
  it('retire texte, date et EXIF, garde l\'image', () => {
    const output = text(stripPngMetadata(pngWithMetadata()))
    for (const secret of ['tEXt', 'Jean', 'tIME', 'eXIf', 'GPS']) expect(output).not.toContain(secret)
    for (const kept of ['IHDR', 'IDAT', 'IEND']) expect(output).toContain(kept)
  })
})

describe('WebP', () => {
  it('retire EXIF et XMP, corrige taille et indicateurs', () => {
    const output = stripWebpMetadata(webpWithMetadata())
    const content = text(output)
    expect(content).not.toContain('GPS')
    expect(content).not.toContain('auteur')
    expect(content).toContain('VP8 ')
    expect(Buffer.from(output).readUInt32LE(4)).toBe(output.length - 8)
    expect(output[20] & 0x0c).toBe(0)
    expect(output[20] & 0x10).toBe(0x10)
  })
})

describe('MP3', () => {
  it('retire ID3v2 et ID3v1, garde les trames', () => {
    expect(stripMp3Metadata(mp3WithMetadata())).toEqual(MP3_FRAMES)
  })

  it('retire un tag APE', () => {
    const ape = Buffer.alloc(32)
    ape.write('APETAGEX', 0, 'latin1')
    ape.writeUInt32LE(32, 12)
    const input = new Uint8Array(Buffer.concat([MP3_FRAMES, ape]))
    expect(stripMp3Metadata(input)).toEqual(MP3_FRAMES)
  })
})

describe('WAV', () => {
  it('retire LIST, garde le son et corrige la taille', () => {
    const output = stripWavMetadata(wavWithMetadata())
    expect(text(output)).not.toContain('Jean')
    expect(text(output)).toContain('data')
    expect(Buffer.from(output).readUInt32LE(4)).toBe(output.length - 8)
  })
})

describe('stripMetadata', () => {
  it('nomme le média si le fichier est illisible', () => {
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff, 1, 2])
    expect(() => stripMetadata(broken, 'image/jpeg', 'Photo 3')).toThrow(TransferError)
    expect(() => stripMetadata(broken, 'image/jpeg', 'Photo 3')).toThrow('Photo 3')
  })

  it('refuse un JPEG tronqué plutôt que d\'exporter des métadonnées', () => {
    const cut = jpegWithMetadata().subarray(0, 30)
    expect(() => stripMetadata(cut, 'image/jpeg', 'Photo 1')).toThrow('Photo 1')
  })

  it('refuse un MP3 sans trame après le tag', () => {
    const input = new Uint8Array(Buffer.concat([textBytes('ID3'), Buffer.from([3, 0, 0, 0, 0, 0, 2, 1, 2]), Buffer.alloc(30, 0x41)]))
    expect(() => stripMetadata(input, 'audio/mpeg', 'Audio')).toThrow('Audio')
  })
})
