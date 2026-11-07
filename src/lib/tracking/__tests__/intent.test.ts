import { describe, expect, it } from 'vitest'
import { classifyIntentClick, payButtonAmount } from '@/lib/tracking/intent'

describe('payButtonAmount', () => {
  it('lit les montants des 3 boutons « Payer » de l\'accueil', () => {
    expect(payButtonAmount('Payer 29,90€')).toBe(29.9)
    expect(payButtonAmount('  Payer 299€ ')).toBe(299)
    expect(payButtonAmount('Payer 14,90 €')).toBe(14.9)
  })
  it('ignore tout autre texte', () => {
    expect(payButtonAmount('J’ai un code parrain')).toBeNull()
    expect(payButtonAmount('')).toBeNull()
    expect(payButtonAmount(null)).toBeNull()
  })
})

describe('classifyIntentClick', () => {
  it('reconnaît les liens vers le formulaire d\'essai', () => {
    for (const href of ['/#essai', '#essai', 'https://animajet.fr/#essai', 'https://www.animajet.fr/#essai']) {
      expect(classifyIntentClick({ tag: 'A', href })).toBe('intent_trial_click')
    }
  })
  it('ne confond pas d\'autres ancres ou pages', () => {
    for (const href of ['/#pricing', '/essai', '#essais', 'https://autre-site.fr/#essai', '/login', null]) {
      expect(classifyIntentClick({ tag: 'a', href })).toBeNull()
    }
  })
  it('reconnaît WhatsApp', () => {
    expect(classifyIntentClick({ tag: 'a', href: 'https://chat.whatsapp.com/J8SuTrkzsAS0YFMxFhLdC4' })).toBe('intent_whatsapp_click')
    expect(classifyIntentClick({ tag: 'a', href: 'https://wa.me/33600000000' })).toBe('intent_whatsapp_click')
  })
  it('distingue mensuel, annuel et Pass Événement dans la section tarifs', () => {
    expect(classifyIntentClick({ tag: 'BUTTON', text: 'Payer 29,90€', inPricing: true })).toBe('intent_subscribe_monthly_click')
    expect(classifyIntentClick({ tag: 'button', text: 'Payer 299€', inPricing: true })).toBe('intent_subscribe_annual_click')
    expect(classifyIntentClick({ tag: 'button', text: 'Payer 14,90€', inPricing: true })).toBe('intent_event_pass_click')
  })
  it('ignore un bouton « Payer » hors de la section tarifs ou à un autre montant', () => {
    expect(classifyIntentClick({ tag: 'button', text: 'Payer 29,90€', inPricing: false })).toBeNull()
    expect(classifyIntentClick({ tag: 'button', text: 'Payer 10€', inPricing: true })).toBeNull()
    expect(classifyIntentClick({ tag: 'button', text: 'Accepter', inPricing: true })).toBeNull()
  })
})
