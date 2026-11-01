// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { applyWatermark } from '@/lib/watermark/render'

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#335577' } }).jpeg().toBuffer()

// Calque de test : un carré blanc opaque dans le coin haut gauche
const calque = () =>
  sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }, left: 0, top: 0 }])
    .png()
    .toBuffer()

async function pixel(image: Buffer, x: number, y: number) {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true })
  const i = (y * info.width + x) * info.channels
  return [data[i], data[i + 1], data[i + 2]]
}

describe('applyWatermark', () => {
  it('incruste le calque dans les pixels et garde les dimensions', async () => {
    const out = await applyWatermark(await photo(600, 400), await calque())
    const meta = await sharp(out).metadata()
    expect(meta.format).toBe('jpeg')
    expect([meta.width, meta.height]).toEqual([600, 400])
    expect((await pixel(out, 20, 20))[0]).toBeGreaterThan(240)
    expect((await pixel(out, 500, 300))[0]).toBeLessThan(90)
  })

  it('fonctionne sur une photo en portrait', async () => {
    const out = await applyWatermark(await photo(400, 600), await calque())
    const meta = await sharp(out).metadata()
    expect([meta.width, meta.height]).toEqual([400, 600])
  })

  it('réduit à la largeur demandée sans agrandir', async () => {
    const reduite = await sharp(await applyWatermark(await photo(1200, 800), await calque(), 800)).metadata()
    expect(reduite.width).toBe(800)
    const petite = await sharp(await applyWatermark(await photo(300, 200), await calque(), 800)).metadata()
    expect(petite.width).toBe(300)
  })

  it('applique l orientation EXIF avant le calque', async () => {
    const tournee = await sharp(await photo(600, 400)).withMetadata({ orientation: 6 }).jpeg().toBuffer()
    const meta = await sharp(await applyWatermark(tournee, await calque())).metadata()
    expect([meta.width, meta.height]).toEqual([400, 600])
  })

  it('échoue sur un fichier illisible plutôt que de renvoyer la source', async () => {
    await expect(applyWatermark(Buffer.from('pas une image'), await calque())).rejects.toThrow()
  })
})
