import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripePeriod } from '../stripe-repair'

describe('stripePeriod', () => {
  it('lit les dates à la racine (anciennes versions de l’API)', () => {
    expect(stripePeriod({ current_period_start: 1_700_000_000, current_period_end: 1_702_592_000 })).toEqual({
      periodStart: new Date(1_700_000_000_000).toISOString(), periodEnd: new Date(1_702_592_000_000).toISOString(),
    })
  })
  it('lit les dates sur le premier article (nouvelles versions)', () => {
    const p = stripePeriod({ items: { data: [{ current_period_start: 1_700_000_000, current_period_end: 1_702_592_000 }] } })
    expect(p.periodEnd).toBe(new Date(1_702_592_000_000).toISOString())
  })
  it('date absente → null (aucune réparation)', () => {
    expect(stripePeriod({})).toEqual({ periodStart: null, periodEnd: null })
  })
})

describe('garde-fous du code', () => {
  const src = readFileSync(join(__dirname, '..', 'stripe-repair.ts'), 'utf8')
  it('la réparation ne supprime jamais rien', () => {
    expect(src).not.toMatch(/\.delete\(|\.remove\(|deleteUser/)
  })
  it('le cron répare avant la purge, sans dépendre de PURGE_MODE', () => {
    const cron = readFileSync(join(__dirname, '..', '..', '..', 'app', 'api', 'cron', 'cleanup-expired', 'route.ts'), 'utf8')
    expect(cron.indexOf('repairSubscriptionsFromStripe({')).toBeGreaterThan(0)
    expect(cron.indexOf('repairSubscriptionsFromStripe({')).toBeLessThan(cron.indexOf('runAccountPurge({'))
    expect(cron.indexOf('repairSubscriptionsFromStripe({')).toBeLessThan(cron.indexOf('parsePurgeMode('))
  })
})
