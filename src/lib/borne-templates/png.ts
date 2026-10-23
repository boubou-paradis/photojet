// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Lecture d'un PNG côté serveur, sans dépendance (node:zlib) : structure,
// présence de transparence, puis extraction du canal alpha pour détecter la
// zone photo. On ne fait jamais confiance au type déclaré par le navigateur.
// Serveur uniquement (node:zlib) : ne pas importer depuis un composant client.

import { inflateSync } from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

export interface PngInfo {
  width: number
  height: number
  bitDepth: number
  colorType: number
  interlaced: boolean
  /** Canal alpha (types 4 et 6) ou chunk tRNS (palette, gris, RVB). */
  hasAlpha: boolean
}

export type PngError = 'not_png' | 'corrupt' | 'unsupported'

interface Parsed {
  info: PngInfo
  palAlpha: Uint8Array | null
  trns: Buffer | null
  idat: Buffer[]
}

let crcTable: Uint32Array | null = null
function crc32(buf: Buffer, start: number, end: number): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = start; i < end; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function parse(buf: Buffer): { ok: true; value: Parsed } | { ok: false; error: PngError } {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) return { ok: false, error: 'not_png' }
  let pos = 8
  let info: PngInfo | null = null
  let trns: Buffer | null = null
  const idat: Buffer[] = []
  let ended = false
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('latin1', pos + 4, pos + 8)
    const dataStart = pos + 8
    const dataEnd = dataStart + len
    if (len > 0x7fffffff || dataEnd + 4 > buf.length) return { ok: false, error: 'corrupt' }
    if (crc32(buf, pos + 4, dataEnd) !== buf.readUInt32BE(dataEnd)) return { ok: false, error: 'corrupt' }
    const data = buf.subarray(dataStart, dataEnd)
    if (!info && type !== 'IHDR') return { ok: false, error: 'corrupt' }
    if (type === 'IHDR') {
      if (len !== 13 || info) return { ok: false, error: 'corrupt' }
      info = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlaced: data[12] === 1,
        hasAlpha: data[9] === 4 || data[9] === 6,
      }
      if (!(data[9] in CHANNELS) || data[10] !== 0 || data[11] !== 0 || data[12] > 1) return { ok: false, error: 'corrupt' }
    } else if (type === 'tRNS') {
      trns = data
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      ended = true
      break
    }
    pos = dataEnd + 4
  }
  if (!info || !ended || idat.length === 0 || info.width === 0 || info.height === 0) return { ok: false, error: 'corrupt' }
  if (trns && trns.length > 0) info.hasAlpha = true
  const palAlpha = info.colorType === 3 && trns ? new Uint8Array(trns) : null
  return { ok: true, value: { info, palAlpha, trns, idat } }
}

/** En-tête seul (dimensions, transparence) : rapide, sans décompression. */
export function readPngInfo(buf: Buffer): { ok: true; info: PngInfo } | { ok: false; error: PngError } {
  const p = parse(buf)
  return p.ok ? { ok: true, info: p.value.info } : p
}

/**
 * Canal alpha complet (un octet par pixel). `maxPixels` borne la mémoire :
 * la décompression s'arrête net au-delà de la taille attendue.
 */
export function decodePngAlpha(
  buf: Buffer,
  maxPixels: number
): { ok: true; info: PngInfo; alpha: Uint8Array } | { ok: false; error: PngError } {
  const p = parse(buf)
  if (!p.ok) return p
  const { info, palAlpha, trns, idat } = p.value
  const { width, height, bitDepth, colorType } = info
  if (width * height > maxPixels) return { ok: false, error: 'unsupported' }
  // Entrelacement Adam7 : non géré (Canva et Photoshop exportent sans).
  if (info.interlaced) return { ok: false, error: 'unsupported' }

  const channels = CHANNELS[colorType]
  const bitsPerPixel = channels * bitDepth
  const stride = Math.ceil((width * bitsPerPixel) / 8)
  const bpp = Math.max(1, bitsPerPixel >> 3)
  const expected = (stride + 1) * height

  let raw: Buffer
  try {
    raw = inflateSync(Buffer.concat(idat), { maxOutputLength: expected })
  } catch {
    return { ok: false, error: 'corrupt' }
  }
  if (raw.length < expected) return { ok: false, error: 'corrupt' }

  const alpha = new Uint8Array(width * height)
  if (!info.hasAlpha) {
    alpha.fill(255)
    return { ok: true, info, alpha }
  }

  // Couleur transparente unique (tRNS des types gris/RVB, 8 bits seulement)
  const key = trns && (colorType === 0 || colorType === 2) && bitDepth === 8
    ? colorType === 0 ? [trns.readUInt16BE(0) & 0xff] : [trns.readUInt16BE(0) & 0xff, trns.readUInt16BE(2) & 0xff, trns.readUInt16BE(4) & 0xff]
    : null

  let prev = new Uint8Array(stride)
  let line = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const off = y * (stride + 1)
    const filter = raw[off]
    for (let i = 0; i < stride; i++) {
      const x = raw[off + 1 + i]
      const a = i >= bpp ? line[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v: number
      switch (filter) {
        case 0: v = x; break
        case 1: v = x + a; break
        case 2: v = x + b; break
        case 3: v = x + ((a + b) >> 1); break
        case 4: {
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
          break
        }
        default: return { ok: false, error: 'corrupt' }
      }
      line[i] = v & 0xff
    }

    const row = y * width
    if (colorType === 6 || colorType === 4) {
      // Alpha = dernier canal ; en 16 bits, l'octet de poids fort suffit.
      const bytesPerSample = bitDepth >> 3
      const alphaOffset = (channels - 1) * bytesPerSample
      for (let x = 0; x < width; x++) alpha[row + x] = line[x * bpp + alphaOffset]
    } else if (colorType === 3 && palAlpha) {
      const perByte = 8 / bitDepth
      const mask = (1 << bitDepth) - 1
      for (let x = 0; x < width; x++) {
        const idx = bitDepth === 8 ? line[x] : (line[(x / perByte) | 0] >> ((perByte - 1 - (x % perByte)) * bitDepth)) & mask
        alpha[row + x] = idx < palAlpha.length ? palAlpha[idx] : 255
      }
    } else if (key) {
      for (let x = 0; x < width; x++) {
        const p = x * channels
        const transparent = channels === 1 ? line[p] === key[0] : line[p] === key[0] && line[p + 1] === key[1] && line[p + 2] === key[2]
        alpha[row + x] = transparent ? 0 : 255
      }
    } else {
      alpha.fill(255, row, row + width)
    }

    const t = prev
    prev = line
    line = t
  }
  return { ok: true, info, alpha }
}
