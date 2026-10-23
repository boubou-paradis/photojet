import { describe, expect, it } from 'vitest'
import { analyzeTemplate } from '../analyze'
import { NO_TRANSPARENCY_MESSAGE } from '../constants'
import { detectPhotoZone } from '../detect-zone'
import { decodePngAlpha, readPngInfo } from '../png'
import { encodePng, frameRgba } from './png-fixtures'

const MAX = 40_000_000

function alphaWithHoles(w: number, h: number, holes: { x: number; y: number; w: number; h: number }[]) {
  const a = new Uint8Array(w * h).fill(255)
  for (const r of holes) for (let y = r.y; y < r.y + r.h; y++) a.fill(0, y * w + r.x, y * w + r.x + r.w)
  return a
}

describe('detectPhotoZone', () => {
  it('trouve la fenêtre rectangulaire, légèrement élargie mais jamais plus petite', () => {
    const r = detectPhotoZone(alphaWithHoles(1200, 1800, [{ x: 100, y: 100, w: 1000, h: 1300 }]), 1200, 1800)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const z = r.zone
    expect(z.x).toBeLessThanOrEqual(100)
    expect(z.y).toBeLessThanOrEqual(100)
    expect(z.x + z.w).toBeGreaterThanOrEqual(1100)
    expect(z.y + z.h).toBeGreaterThanOrEqual(1400)
    expect(100 - z.x).toBeLessThanOrEqual(8)
    expect(z.x + z.w - 1100).toBeLessThanOrEqual(8)
    expect(r.otherZones).toBe(0)
    expect(r.coverage).toBeGreaterThan(0.55)
  })

  it('refuse une image sans transparence', () => {
    expect(detectPhotoZone(new Uint8Array(600 * 900).fill(255), 600, 900)).toEqual({ ok: false, reason: 'no_transparency' })
  })

  it('refuse une zone de moins de 5 %', () => {
    const r = detectPhotoZone(alphaWithHoles(1200, 1800, [{ x: 500, y: 500, w: 200, h: 200 }]), 1200, 1800)
    expect(r).toEqual({ ok: false, reason: 'zone_too_small' })
  })

  it('garde la plus grande zone et signale les autres zones notables', () => {
    const r = detectPhotoZone(
      alphaWithHoles(1200, 1800, [
        { x: 600, y: 900, w: 500, h: 800 }, // petite (≈ 18 %)
        { x: 100, y: 100, w: 1000, h: 700 }, // grande (≈ 32 %)
        { x: 10, y: 1790, w: 4, h: 4 }, // poussière ignorée
      ]),
      1200,
      1800
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.zone.y).toBeLessThanOrEqual(100)
    expect(r.zone.y + r.zone.h).toBeLessThan(900)
    expect(r.otherZones).toBe(1)
  })

  it('accepte une photo collée au bord (zone bornée à l’image)', () => {
    const r = detectPhotoZone(alphaWithHoles(1800, 1200, [{ x: 0, y: 0, w: 1800, h: 900 }]), 1800, 1200)
    expect(r.ok && r.zone).toEqual({ x: 0, y: 0, w: 1800, h: expect.any(Number) })
    if (r.ok) expect(r.zone.h).toBeGreaterThanOrEqual(900)
  })
})

describe('decodePngAlpha', () => {
  it('lit l’alpha d’un RGBA 8 bits avec les 5 filtres', () => {
    const png = frameRgba(64, 40, [{ x: 10, y: 5, w: 30, h: 20 }], (y) => y % 5)
    const d = decodePngAlpha(png, MAX)
    expect(d.ok).toBe(true)
    if (!d.ok) return
    expect(d.info).toMatchObject({ width: 64, height: 40, colorType: 6, hasAlpha: true })
    expect(d.alpha[5 * 64 + 10]).toBe(0)
    expect(d.alpha[24 * 64 + 39]).toBe(0)
    expect(d.alpha[4 * 64 + 10]).toBe(255)
    expect(d.alpha[25 * 64 + 39]).toBe(255)
    expect(d.alpha[5 * 64 + 40]).toBe(255)
  })

  it('lit un RGBA 16 bits', () => {
    const png = encodePng({
      width: 4, height: 2, colorType: 6, bitDepth: 16, filter: () => 4,
      row: (y) => { const r = new Uint8Array(32); for (let x = 0; x < 4; x++) r.set([1, 2, 3, 4, 5, 6, x === y ? 0 : 255, 0], x * 8); return r },
    })
    const d = decodePngAlpha(png, MAX)
    expect(d.ok && Array.from(d.alpha)).toEqual([0, 255, 255, 255, 255, 0, 255, 255])
  })

  it('lit une palette 4 bits avec tRNS (PNG optimisés type TinyPNG)', () => {
    const png = encodePng({
      width: 5, height: 1, colorType: 3, bitDepth: 4,
      palette: Buffer.from([0, 0, 0, 255, 255, 255, 9, 9, 9]),
      trns: Buffer.from([255, 0]), // index 0 opaque, 1 transparent, 2 sans entrée = opaque
      row: () => Uint8Array.from([0x01, 0x21, 0x00]), // indices 0,1,2,1,0
    })
    const d = decodePngAlpha(png, MAX)
    expect(d.ok && Array.from(d.alpha)).toEqual([255, 0, 255, 0, 255])
  })

  it('signale un RVB sans transparence', () => {
    const png = encodePng({ width: 3, height: 3, colorType: 2, row: () => new Uint8Array(9) })
    const i = readPngInfo(png)
    expect(i.ok && i.info.hasAlpha).toBe(false)
  })

  it('refuse un JPEG, un PNG abîmé et un PNG entrelacé', () => {
    expect(decodePngAlpha(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0]), MAX)).toEqual({ ok: false, error: 'not_png' })
    const png = frameRgba(8, 8, [])
    const broken = Buffer.from(png)
    broken[40] ^= 0xff
    expect(decodePngAlpha(broken, MAX)).toEqual({ ok: false, error: 'corrupt' })
    expect(decodePngAlpha(png.subarray(0, png.length - 12), MAX)).toEqual({ ok: false, error: 'corrupt' })
    const interlaced = encodePng({ width: 4, height: 4, colorType: 6, interlace: 1, row: () => new Uint8Array(16) })
    expect(decodePngAlpha(interlaced, MAX)).toEqual({ ok: false, error: 'unsupported' })
  })

  it('refuse une image au-delà du nombre de pixels autorisé', () => {
    expect(decodePngAlpha(frameRgba(20, 20, []), 399)).toEqual({ ok: false, error: 'unsupported' })
  })
})

describe('analyzeTemplate', () => {
  it('accepte un template vertical 1200×1800 et détecte sa zone', () => {
    const r = analyzeTemplate(frameRgba(1200, 1800, [{ x: 100, y: 100, w: 1000, h: 1300 }], (y) => y % 5))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toMatchObject({ width: 1200, height: 1800, orientation: 'portrait', warnings: [] })
  })

  it('reconnaît un template horizontal', () => {
    const r = analyzeTemplate(frameRgba(1800, 1200, [{ x: 80, y: 80, w: 1100, h: 1040 }]))
    expect(r.ok && r.value.orientation).toBe('landscape')
  })

  it('refuse un PNG opaque avec le message exact du cahier des charges', () => {
    expect(analyzeTemplate(frameRgba(1200, 1800, []))).toEqual({ ok: false, error: NO_TRANSPARENCY_MESSAGE })
    const rgb = encodePng({ width: 1200, height: 1800, colorType: 2, row: () => new Uint8Array(3600) })
    expect(analyzeTemplate(rgb)).toEqual({ ok: false, error: NO_TRANSPARENCY_MESSAGE })
  })

  it('refuse un JPEG et une image trop petite', () => {
    const jpeg = analyzeTemplate(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]))
    expect(jpeg.ok).toBe(false)
    expect(!jpeg.ok && jpeg.error).toContain('Seuls les fichiers PNG')
    const small = analyzeTemplate(frameRgba(400, 600, [{ x: 50, y: 50, w: 300, h: 400 }]))
    expect(!small.ok && small.error).toContain('trop petite')
  })

  it('avertit pour une résolution faible et un format autre que 10×15', () => {
    const r = analyzeTemplate(frameRgba(800, 1200, [{ x: 60, y: 60, w: 680, h: 900 }]))
    expect(r.ok && r.value.warnings.some((w) => w.includes('floue'))).toBe(true)
    const square = analyzeTemplate(frameRgba(1200, 1200, [{ x: 100, y: 100, w: 1000, h: 800 }]))
    expect(square.ok && square.value.warnings.some((w) => w.includes('10×15'))).toBe(true)
  })
})
