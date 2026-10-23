// Encodeur PNG minimal pour les tests (filtres 0 à 4, palette, 16 bits).

import { deflateSync } from 'node:zlib'

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

function paeth(a: number, b: number, c: number): number {
  const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

export interface EncodeOptions {
  width: number
  height: number
  colorType: number
  bitDepth?: number
  /** Octets bruts d'une ligne (sans l'octet de filtre). */
  row: (y: number) => Uint8Array
  /** Filtre appliqué à la ligne y (0 à 4). */
  filter?: (y: number) => number
  palette?: Buffer
  trns?: Buffer
  interlace?: number
}

export function encodePng(o: EncodeOptions): Buffer {
  const bitDepth = o.bitDepth ?? 8
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[o.colorType] as number
  const bpp = Math.max(1, (channels * bitDepth) >> 3)
  const lines: Buffer[] = []
  let prev = new Uint8Array(o.row(0).length)
  for (let y = 0; y < o.height; y++) {
    const cur = o.row(y)
    const f = o.filter ? o.filter(y) : 0
    const out = Buffer.alloc(cur.length + 1)
    out[0] = f
    for (let i = 0; i < cur.length; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c)
      out[i + 1] = (cur[i] - pred) & 0xff
    }
    lines.push(out)
    prev = cur
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(o.width, 0)
  ihdr.writeUInt32BE(o.height, 4)
  ihdr[8] = bitDepth
  ihdr[9] = o.colorType
  ihdr[12] = o.interlace ?? 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...(o.palette ? [chunk('PLTE', o.palette)] : []),
    ...(o.trns ? [chunk('tRNS', o.trns)] : []),
    chunk('IDAT', deflateSync(Buffer.concat(lines))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Template RGBA : opaque partout sauf dans le(s) rectangle(s) transparent(s). */
export function frameRgba(width: number, height: number, holes: { x: number; y: number; w: number; h: number }[], filter?: (y: number) => number): Buffer {
  return encodePng({
    width,
    height,
    colorType: 6,
    filter,
    row: (y) => {
      const r = new Uint8Array(width * 4)
      for (let x = 0; x < width; x++) {
        const inHole = holes.some((h) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h)
        r.set([200, (x * 7) & 0xff, (y * 3) & 0xff, inHole ? 0 : 255], x * 4)
      }
      return r
    },
  })
}
