import { describe, expect, it } from 'vitest'
import { coverCrop, fitStage, zoneOnScreen } from '../compose'

describe('fitStage', () => {
  it('vertical : le template 2:3 tient au-dessus des boutons, centré', () => {
    const r = fitStage(810, 1080, false, 1200, 1800)
    expect(r.h).toBeCloseTo(1080 - 300 - 16)
    expect(r.w / r.h).toBeCloseTo(1200 / 1800)
    expect(r.x + r.w / 2).toBeCloseTo(405)
    expect(r.y).toBe(16)
  })

  it('horizontal : le template laisse libre la colonne des boutons à droite', () => {
    const r = fitStage(1080, 810, true, 1800, 1200)
    expect(r.x + r.w).toBeLessThanOrEqual(1080 - 244)
    expect(r.w / r.h).toBeCloseTo(1.5)
    expect(r.y).toBeGreaterThanOrEqual(16)
    expect(r.y + r.h).toBeLessThanOrEqual(810 - 16)
  })

  it('horizontal avec un template vertical seul : il reste entier à l’écran', () => {
    const r = fitStage(1080, 810, true, 1200, 1800)
    expect(r.h).toBeCloseTo(810 - 32)
    expect(r.x).toBeGreaterThanOrEqual(16)
  })
})

describe('zoneOnScreen', () => {
  it('met la zone à l’échelle du template affiché', () => {
    const z = zoneOnScreen({ x: 10, y: 20, w: 600, h: 900 }, 1200, { x: 100, y: 100, w: 1000, h: 1300 })
    expect(z).toEqual({ x: 60, y: 70, w: 500, h: 650 })
  })
})

describe('coverCrop', () => {
  it('flux 16:9 dans une zone verticale : coupe les côtés, garde toute la hauteur', () => {
    const c = coverCrop(1920, 1080, 1000, 1300)
    expect(c.h).toBe(1080)
    expect(c.w / c.h).toBeCloseTo(1000 / 1300)
    expect(c.x).toBeCloseTo((1920 - c.w) / 2)
    expect(c.y).toBe(0)
  })

  it('flux vertical dans une zone horizontale : coupe haut et bas', () => {
    const c = coverCrop(1080, 1920, 1100, 1040)
    expect(c.w).toBe(1080)
    expect(c.w / c.h).toBeCloseTo(1100 / 1040)
    expect(c.y).toBeCloseTo((1920 - c.h) / 2)
  })
})
