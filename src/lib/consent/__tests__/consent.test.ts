import { describe, expect, it } from 'vitest'
import { CONSENT_MAX_AGE_MS, adCookieNames, makeConsent, parseConsent } from '@/lib/consent/consent'

const NOW = new Date('2026-11-07T12:00:00Z')

describe('parseConsent', () => {
  it('relit un accord ou un refus valide', () => {
    expect(parseConsent(JSON.stringify(makeConsent(true, NOW)), NOW)?.ads).toBe(true)
    expect(parseConsent(JSON.stringify(makeConsent(false, NOW)), NOW)?.ads).toBe(false)
  })
  it('redemande le choix après 6 mois', () => {
    const old = new Date(NOW.getTime() - CONSENT_MAX_AGE_MS - 1000)
    expect(parseConsent(JSON.stringify(makeConsent(true, old)), NOW)).toBeNull()
  })
  it('rejette les valeurs absentes, corrompues ou d\'une autre version', () => {
    expect(parseConsent(null, NOW)).toBeNull()
    expect(parseConsent('pas du json', NOW)).toBeNull()
    expect(parseConsent(JSON.stringify({ v: 2, ads: true, at: NOW.toISOString() }), NOW)).toBeNull()
    expect(parseConsent(JSON.stringify({ v: 1, ads: 'oui', at: NOW.toISOString() }), NOW)).toBeNull()
    expect(parseConsent(JSON.stringify({ v: 1, ads: true, at: 'hier' }), NOW)).toBeNull()
  })
  it('rejette une date dans le futur', () => {
    const future = new Date(NOW.getTime() + 60_000)
    expect(parseConsent(JSON.stringify(makeConsent(true, future)), NOW)).toBeNull()
  })
})

describe('adCookieNames', () => {
  it('ne cible que les cookies Google Ads (_gcl_*)', () => {
    const cookies = 'sb-access-token=x; _gcl_au=1.1.1; trial_token=abc; _gcl_aw=GCL.1.x; aj=1'
    expect(adCookieNames(cookies)).toEqual(['_gcl_au', '_gcl_aw'])
  })
})
