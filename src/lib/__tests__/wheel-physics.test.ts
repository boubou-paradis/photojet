import { describe, expect, it } from 'vitest'
import {
  FREE_SPEED_DEG_S,
  decelPosition,
  decelVelocity,
  indexUnderPointer,
  mod360,
  planDeceleration,
  targetAngleFor,
} from '../wheel-physics'

describe('angle d’arrêt', () => {
  it('place chaque case sous le pointeur', () => {
    for (const count of [2, 3, 6, 7, 12, 20]) {
      for (let i = 0; i < count; i++) {
        for (const jitter of [-1, -0.5, 0, 0.5, 1]) {
          expect(indexUnderPointer(targetAngleFor(i, count, jitter), count)).toBe(i)
        }
      }
    }
  })
})

describe('décélération', () => {
  const cases: [number, number, number, number][] = []
  for (const start of [0, 37, 359.5, 1234.5, -90]) {
    for (const target of [0, 15, 180, 300, 359]) {
      for (const maxD of [3, 2.85, 2.2]) cases.push([start, target, maxD, FREE_SPEED_DEG_S])
    }
  }

  it.each(cases)('depuis %s° vers %s° (max %s s) : arrive pile sur la cible', (start, target, maxD, v) => {
    const plan = planDeceleration(start, v, target, maxD)
    expect(mod360(start + decelPosition(plan, plan.duration))).toBeCloseTo(mod360(target), 6)
    expect(plan.duration).toBeLessThanOrEqual(maxD + 1e-9)
  })

  it.each(cases)('depuis %s° vers %s° (max %s s) : aucun à-coup, part à la vitesse en cours', (start, target, maxD, v) => {
    const plan = planDeceleration(start, v, target, maxD)
    expect(Math.abs(decelVelocity(plan, 0) - v) / v).toBeLessThan(0.001)
  })

  it('vitesse toujours décroissante, arrêt à vitesse nulle', () => {
    const plan = planDeceleration(12, FREE_SPEED_DEG_S, 250, 3)
    let prev = Infinity
    for (let t = 0; t <= plan.duration; t += 0.02) {
      const v = decelVelocity(plan, t)
      expect(v).toBeLessThanOrEqual(prev + 1e-9)
      prev = v
    }
    expect(decelVelocity(plan, plan.duration)).toBe(0)
  })

  it('long ralentissement final : la dernière seconde reste lente (suspense)', () => {
    const plan = planDeceleration(0, FREE_SPEED_DEG_S, 200, 3)
    // Pendant la dernière seconde, la roue parcourt peu (elle « hésite »).
    const lastSecond = decelPosition(plan, plan.duration) - decelPosition(plan, plan.duration - 1)
    expect(lastSecond).toBeLessThan(plan.distance * 0.15)
    expect(plan.power).toBeGreaterThanOrEqual(2.4)
  })

  it('utilise la durée disponible (≥ 2,2 s quand elle est offerte)', () => {
    for (const target of [0, 90, 180, 270]) {
      expect(planDeceleration(0, FREE_SPEED_DEG_S, target, 3).duration).toBeGreaterThanOrEqual(2.2)
    }
  })
})
