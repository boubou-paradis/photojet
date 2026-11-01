// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Médias de l'échange : retrait des métadonnées à l'export, sans toucher aux
// données d'image ni de son, et décodage réel dans le navigateur.

import { LIMITS, TransferError, isMp3FrameHeader, isImageType, type MediaType } from './format'

type Bytes = Uint8Array<ArrayBuffer>

class MalformedMediaError extends Error {}

function malformed(): never {
  throw new MalformedMediaError('Média illisible')
}

function concat(parts: Uint8Array[]): Bytes {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

// ---------- Orientation ----------
// Le navigateur applique l'orientation EXIF à l'affichage : la perdre ferait
// pivoter la photo. Seul ce champ est conservé, dans un EXIF minimal.

function readExifOrientation(tiff: Uint8Array): number {
  if (tiff.length < 8) return 1
  const order = ascii(tiff, 0, 2)
  if (order !== 'II' && order !== 'MM') return 1
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
  const little = order === 'II'
  const ifd = view.getUint32(4, little)
  if (ifd + 2 > tiff.length) return 1
  const count = view.getUint16(ifd, little)
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12
    if (entry + 12 > tiff.length) return 1
    if (view.getUint16(entry, little) === 0x0112) {
      const value = view.getUint16(entry + 8, little)
      return value >= 1 && value <= 8 ? value : 1
    }
  }
  return 1
}

function minimalTiff(orientation: number): Bytes {
  const tiff = new Uint8Array(26)
  const view = new DataView(tiff.buffer)
  tiff.set([0x49, 0x49], 0) // II
  view.setUint16(2, 42, true)
  view.setUint32(4, 8, true)
  view.setUint16(8, 1, true)
  view.setUint16(10, 0x0112, true)
  view.setUint16(12, 3, true) // SHORT
  view.setUint32(14, 1, true)
  view.setUint16(18, orientation, true)
  view.setUint32(22, 0, true)
  return tiff
}

// ---------- JPEG ----------

function isExifSegment(bytes: Uint8Array, start: number, end: number): boolean {
  return end - start >= 6 && ascii(bytes, start, 6) === 'Exif\0\0'
}

function keepsJpegSegment(marker: number, bytes: Uint8Array, start: number, end: number): boolean {
  if (marker === 0xfe) return false // commentaire
  if (marker < 0xe0 || marker > 0xef) return true
  // APP utiles au rendu uniquement : JFIF, profil couleur, marqueur Adobe (transformée couleur).
  if (marker === 0xe0) return end - start >= 5 && ascii(bytes, start, 5) === 'JFIF\0'
  if (marker === 0xe2) return end - start >= 12 && ascii(bytes, start, 12) === 'ICC_PROFILE\0'
  if (marker === 0xee) return end - start >= 5 && ascii(bytes, start, 5) === 'Adobe'
  return false
}

export function stripJpegMetadata(bytes: Uint8Array): Bytes {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) malformed()
  const parts: Uint8Array[] = [bytes.subarray(0, 2)]
  let orientation = 1
  let orientationSlot = -1
  let offset = 2

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) malformed()
    let markerOffset = offset + 1
    while (bytes[markerOffset] === 0xff) markerOffset++ // octets de remplissage
    if (markerOffset >= bytes.length) malformed()
    const marker = bytes[markerOffset]

    if (marker === 0xd9) {
      // Fin d'image : tout ce qui suit (vignettes, données ajoutées) est retiré.
      parts.push(bytes.subarray(offset, markerOffset + 1))
      if (orientation !== 1 && orientationSlot >= 0) {
        const tiff = minimalTiff(orientation)
        const segmentLength = 2 + 6 + tiff.length
        const header = new Uint8Array(10)
        header.set([0xff, 0xe1, segmentLength >> 8, segmentLength & 0xff], 0)
        header.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4) // Exif\0\0
        parts.splice(orientationSlot, 0, header, tiff)
      }
      return concat(parts)
    }

    const lengthOffset = markerOffset + 1
    if (lengthOffset + 2 > bytes.length) malformed()
    const length = (bytes[lengthOffset] << 8) | bytes[lengthOffset + 1]
    const end = lengthOffset + length
    if (length < 2 || end > bytes.length) malformed()
    const dataStart = lengthOffset + 2

    if (marker === 0xe1 && isExifSegment(bytes, dataStart, end)) {
      orientation = readExifOrientation(bytes.subarray(dataStart + 6, end))
      if (orientationSlot < 0) orientationSlot = parts.length
    }

    if (keepsJpegSegment(marker, bytes, dataStart, end)) {
      parts.push(bytes.subarray(offset, end))
    }

    offset = end
    if (marker === 0xda) {
      // Données d'image : recopiées telles quelles jusqu'au prochain vrai marqueur.
      let scan = end
      for (;;) {
        if (scan + 1 >= bytes.length) malformed()
        if (bytes[scan] === 0xff) {
          const next = bytes[scan + 1]
          if (next !== 0x00 && next !== 0xff && (next < 0xd0 || next > 0xd7)) break
        }
        scan++
      }
      parts.push(bytes.subarray(end, scan))
      offset = scan
    }
  }
  malformed()
}

// ---------- PNG ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// Chunks utiles au rendu : tout le reste (texte, date, EXIF…) est retiré.
const PNG_KEPT_CHUNKS = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'pHYs',
  'cICP', 'mDCV', 'cLLI', 'acTL', 'fcTL', 'fdAT',
])

function pngChunk(type: string, data: Uint8Array): Bytes {
  const chunk = new Uint8Array(12 + data.length)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i)
  chunk.set(data, 8)
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)))
  return chunk
}

export function stripPngMetadata(bytes: Uint8Array): Bytes {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)]
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const type = ascii(bytes, offset + 4, 4)
    const end = offset + 12 + length
    if (end > bytes.length) malformed()
    if (PNG_KEPT_CHUNKS.has(type)) {
      parts.push(bytes.subarray(offset, end))
    } else if (type === 'eXIf') {
      const orientation = readExifOrientation(bytes.subarray(offset + 8, offset + 8 + length))
      if (orientation !== 1) parts.push(pngChunk('eXIf', minimalTiff(orientation)))
    }
    if (type === 'IEND') return concat(parts)
    offset = end
  }
  malformed()
}

// ---------- WebP et WAV (conteneur RIFF) ----------

function rebuildRiff(bytes: Uint8Array, keep: (id: string) => boolean, patch?: (chunk: Bytes) => void): Bytes {
  if (bytes.length < 12) malformed()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: Bytes[] = []
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4)
    const size = view.getUint32(offset + 4, true)
    const padded = size + (size % 2)
    if (offset + 8 + size > bytes.length) malformed()
    if (keep(id)) {
      const chunk = new Uint8Array(8 + padded)
      chunk.set(bytes.subarray(offset, Math.min(offset + 8 + padded, bytes.length)))
      patch?.(chunk)
      chunks.push(chunk)
    }
    offset += 8 + padded
  }
  const header = new Uint8Array(12)
  header.set(bytes.subarray(0, 12))
  const body = concat(chunks)
  new DataView(header.buffer).setUint32(4, 4 + body.length, true)
  return concat([header, body])
}

export function stripWebpMetadata(bytes: Uint8Array): Bytes {
  return rebuildRiff(
    bytes,
    (id) => id !== 'EXIF' && id !== 'XMP ',
    (chunk) => {
      if (ascii(chunk, 0, 4) === 'VP8X') chunk[8] &= ~0x0c // indicateurs EXIF et XMP
    }
  )
}

export function stripWavMetadata(bytes: Uint8Array): Bytes {
  return rebuildRiff(bytes, (id) => id === 'fmt ' || id === 'data' || id === 'fact')
}

// ---------- MP3 ----------

export function stripMp3Metadata(bytes: Uint8Array): Bytes {
  let start = 0
  // ID3v2, éventuellement répété, en tête de fichier.
  while (start + 10 <= bytes.length && ascii(bytes, start, 3) === 'ID3') {
    const size =
      ((bytes[start + 6] & 0x7f) << 21) |
      ((bytes[start + 7] & 0x7f) << 14) |
      ((bytes[start + 8] & 0x7f) << 7) |
      (bytes[start + 9] & 0x7f)
    const hasFooter = (bytes[start + 5] & 0x10) !== 0
    start += 10 + size + (hasFooter ? 10 : 0)
  }
  // Certains encodeurs complètent le tag par des zéros.
  while (start < bytes.length && bytes[start] === 0) start++
  if (!isMp3FrameHeader(bytes, start)) malformed()

  let end = bytes.length
  for (let found = true; found; ) {
    found = false
    if (end - 128 > start && ascii(bytes, end - 128, 3) === 'TAG') {
      end -= 128
      found = true
    }
    if (end - 227 > start && ascii(bytes, end - 227, 4) === 'TAG+') {
      end -= 227
      found = true
    }
    if (end - 32 > start && ascii(bytes, end - 32, 8) === 'APETAGEX') {
      const footer = new DataView(bytes.buffer, bytes.byteOffset + end - 32, 32)
      const size = footer.getUint32(12, true)
      const hasHeader = (footer.getUint32(20, true) & 0x80000000) !== 0
      const total = size + (hasHeader ? 32 : 0)
      if (end - total > start) {
        end -= total
        found = true
      }
    }
  }
  return concat([bytes.subarray(start, end)])
}

/**
 * Retire les métadonnées sans réencoder. OGG n'est pas nettoyé : ses tags sont
 * mêlés au flux, il faudrait réécrire les pages audio. Aucun OGG en production.
 */
export function stripMetadata(bytes: Uint8Array, type: MediaType, label: string): Bytes {
  try {
    switch (type) {
      case 'image/jpeg':
        return stripJpegMetadata(bytes)
      case 'image/png':
        return stripPngMetadata(bytes)
      case 'image/webp':
        return stripWebpMetadata(bytes)
      case 'audio/mpeg':
        return stripMp3Metadata(bytes)
      case 'audio/wav':
        return stripWavMetadata(bytes)
      case 'audio/ogg':
        return concat([bytes])
    }
  } catch (error) {
    if (error instanceof MalformedMediaError || error instanceof RangeError) {
      throw new TransferError(`${label} : fichier illisible, remplacez-le avant d'exporter.`)
    }
    throw error
  }
}

// ---------- Décodage réel (navigateur) ----------

const DECODE_TIMEOUT_MS = 15000

export interface ImageSize {
  width: number
  height: number
}

async function decodeImage(url: string): Promise<ImageSize> {
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('image illisible'))
    image.src = url
  })
  const size = { width: image.naturalWidth, height: image.naturalHeight }
  // Dimensions contrôlées avant de décoder les pixels : parade à l'image géante.
  if (size.width === 0 || size.height === 0) throw new Error('image illisible')
  if (size.width > LIMITS.photoSide || size.height > LIMITS.photoSide) {
    throw new TransferError(`Une photo dépasse ${LIMITS.photoSide} pixels de côté.`)
  }
  await image.decode()
  return size
}

function decodeAudioHeader(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () =>
      Number.isNaN(audio.duration) || audio.duration === 0 ? reject(new Error('audio illisible')) : resolve()
    audio.onerror = () => reject(new Error('audio illisible'))
    audio.src = url
  })
}

function withTimeout<T>(task: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('décodage trop long')), DECODE_TIMEOUT_MS)
  })
  return Promise.race([task, timeout]).finally(() => clearTimeout(timer))
}

/** Prouve que le fichier est bien lisible par le navigateur. Renvoie la taille d'une image. */
export async function verifyDecodable(blob: Blob, type: MediaType, invalidMessage: string): Promise<ImageSize | null> {
  const url = URL.createObjectURL(blob)
  try {
    if (isImageType(type)) return await withTimeout(decodeImage(url))
    await withTimeout(decodeAudioHeader(url))
    return null
  } catch (error) {
    if (error instanceof TransferError) throw error
    throw new TransferError(invalidMessage)
  } finally {
    URL.revokeObjectURL(url)
  }
}
