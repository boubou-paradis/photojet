import { describe, expect, it } from 'vitest'
import { isGoogleAdsIdValid, isTrackedPath } from '@/lib/tracking/google-ads'

describe('isTrackedPath', () => {
  it('autorise les pages de la vitrine', () => {
    for (const p of ['/', '/animation-camping-interactive', '/blog', '/blog/animation-camping-soiree', '/confidentialite', '/cgv']) {
      expect(isTrackedPath(p)).toBe(true)
    }
  })
  it('exclut toutes les routes du SaaS, y compris leurs sous-pages et 404', () => {
    for (const p of [
      '/admin', '/admin/jeux', '/live/ABC123', '/play/x', '/join', '/borne', '/borne/x', '/invite/x',
      '/buzzer/x', '/vote/x', '/matching/x', '/album/x', '/host', '/demo/quiz', '/gestion-8k7m2x',
      '/login', '/trial', '/subscription/success', '/api/stripe/webhooks',
    ]) {
      expect(isTrackedPath(p)).toBe(false)
    }
  })
  it('ne confond pas un préfixe avec une page vitrine au nom proche', () => {
    expect(isTrackedPath('/jeu-vote')).toBe(true)
    expect(isTrackedPath('/jeu-buzzer')).toBe(true)
    expect(isTrackedPath('/livex')).toBe(true)
  })
  it('refuse un chemin absent', () => {
    expect(isTrackedPath(null)).toBe(false)
    expect(isTrackedPath(undefined)).toBe(false)
  })
})

describe('isGoogleAdsIdValid', () => {
  it('accepte uniquement le format AW-123456789', () => {
    expect(isGoogleAdsIdValid('AW-123456789')).toBe(true)
    expect(isGoogleAdsIdValid('G-ABC123')).toBe(false)
    expect(isGoogleAdsIdValid('')).toBe(false)
    expect(isGoogleAdsIdValid('AW-12')).toBe(false)
  })
})
