// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { FORMAT_ID, FORMAT_VERSION, type Manifest, type MediaRef, type MediaType } from '../format'

export const textBytes = (text: string) => new TextEncoder().encode(text)

export function join(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.concat(parts))
}

function u16be(value: number) {
  return Uint8Array.of(value >> 8, value & 0xff)
}

function exifSegment(extraTags: string, orientation?: number): Uint8Array {
  const tiff = Buffer.alloc(26)
  tiff.write('II', 0, 'latin1')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4)
  tiff.writeUInt16LE(orientation ? 1 : 0, 8)
  if (orientation) {
    tiff.writeUInt16LE(0x0112, 10)
    tiff.writeUInt16LE(3, 12)
    tiff.writeUInt32LE(1, 14)
    tiff.writeUInt16LE(orientation, 18)
  }
  const data = join(textBytes('Exif\0\0'), tiff, textBytes(extraTags))
  return join(Uint8Array.of(0xff, 0xe1), u16be(data.length + 2), data)
}

export const JPEG_SCAN = Uint8Array.of(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56)

// Structure JPEG minimale : le test porte sur les segments, pas sur les pixels.
export function jpegWithMetadata(options: { orientation?: number; trailer?: boolean } = {}): Uint8Array<ArrayBuffer> {
  const jfif = join(Uint8Array.of(0xff, 0xe0), u16be(16), textBytes('JFIF\0'), new Uint8Array(9))
  const icc = join(Uint8Array.of(0xff, 0xe2), u16be(18), textBytes('ICC_PROFILE\0'), new Uint8Array(4))
  const xmp = join(Uint8Array.of(0xff, 0xe1), u16be(10), textBytes('xmpAUTHOR'.slice(0, 8)))
  const comment = join(Uint8Array.of(0xff, 0xfe), u16be(9), textBytes('Auteur!'))
  const dqt = join(Uint8Array.of(0xff, 0xdb), u16be(4), Uint8Array.of(1, 2))
  const sos = join(Uint8Array.of(0xff, 0xda), u16be(4), Uint8Array.of(3, 4))
  return join(
    Uint8Array.of(0xff, 0xd8),
    jfif,
    exifSegment('GPS48.8566,Canon', options.orientation),
    xmp,
    comment,
    icc,
    dqt,
    sos,
    JPEG_SCAN,
    Uint8Array.of(0xff, 0xd9),
    options.trailer ? textBytes('thumbnail GPS') : new Uint8Array(0)
  )
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  return join(head, data, new Uint8Array(4))
}

export function pngWithMetadata(): Uint8Array<ArrayBuffer> {
  return join(
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    pngChunk('IHDR', new Uint8Array(13)),
    pngChunk('tEXt', textBytes('Author\0Jean')),
    pngChunk('tIME', new Uint8Array(7)),
    pngChunk('eXIf', textBytes('MM\0*GPS')),
    pngChunk('IDAT', Uint8Array.of(1, 2, 3)),
    pngChunk('IEND', new Uint8Array(0))
  )
}

function riffChunk(id: string, data: Uint8Array): Uint8Array {
  const head = Buffer.alloc(8)
  head.write(id, 0, 'latin1')
  head.writeUInt32LE(data.length, 4)
  return join(head, data, data.length % 2 ? new Uint8Array(1) : new Uint8Array(0))
}

function riff(form: string, chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const body = join(textBytes(form), ...chunks)
  const head = Buffer.alloc(8)
  head.write('RIFF', 0, 'latin1')
  head.writeUInt32LE(body.length, 4)
  return join(head, body)
}

export function webpWithMetadata(): Uint8Array<ArrayBuffer> {
  return riff('WEBP', [
    riffChunk('VP8X', Uint8Array.of(0x0c | 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0)),
    riffChunk('VP8 ', Uint8Array.of(1, 2, 3)),
    riffChunk('EXIF', textBytes('GPS')),
    riffChunk('XMP ', textBytes('auteur')),
  ])
}

export function wavWithMetadata(): Uint8Array<ArrayBuffer> {
  return riff('WAVE', [
    riffChunk('fmt ', new Uint8Array(16)),
    riffChunk('LIST', textBytes('INFOIART Jean')),
    riffChunk('data', Uint8Array.of(1, 2, 3, 4)),
  ])
}

export const MP3_FRAMES = join(Uint8Array.of(0xff, 0xfb, 0x90, 0x64), new Uint8Array(40).fill(0x55))

export function mp3WithMetadata(): Uint8Array<ArrayBuffer> {
  const id3Body = textBytes('TPE1 Jean Dupont')
  const id3 = join(textBytes('ID3'), Uint8Array.of(3, 0, 0, 0, 0, 0, id3Body.length), id3Body)
  const id3v1 = join(textBytes('TAG'), new Uint8Array(125).fill(0x41))
  return join(id3, MP3_FRAMES, id3v1)
}

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function mediaRef(file: string, type: MediaType, bytes: Uint8Array): MediaRef {
  return { file, type, size: bytes.length, sha256: sha256(bytes) }
}

export const PHOTO = jpegWithMetadata()
export const AUDIO = MP3_FRAMES

export function validManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    format: FORMAT_ID,
    formatVersion: FORMAT_VERSION,
    exportedOn: '2026-11-02',
    name: 'Stars des années 80',
    settings: { grid: '12x8', speed: 'medium' },
    revealAudio: mediaRef('audio/reveal.mp3', 'audio/mpeg', AUDIO),
    photos: [
      {
        image: mediaRef('photos/01.jpg', 'image/jpeg', PHOTO),
        audio: mediaRef('audio/01.mp3', 'audio/mpeg', AUDIO),
      },
    ],
    ...overrides,
  }
}

export function validEntries(): Record<string, Uint8Array> {
  return { 'photos/01.jpg': PHOTO, 'audio/01.mp3': AUDIO, 'audio/reveal.mp3': AUDIO }
}

export async function zipOf(
  manifest: unknown,
  entries: Record<string, Uint8Array | string> = validEntries(),
  compression: 'STORE' | 'DEFLATE' = 'STORE'
): Promise<Blob> {
  const zip = new JSZip()
  zip.file('manifest.json', typeof manifest === 'string' ? manifest : JSON.stringify(manifest), { createFolders: false })
  for (const [name, bytes] of Object.entries(entries)) zip.file(name, bytes, { createFolders: false })
  const output = await zip.generateAsync({ type: 'uint8array', compression })
  return new Blob([new Uint8Array(output)])
}
