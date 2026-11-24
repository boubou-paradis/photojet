// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it } from 'vitest'
import { ballVars, familyOf } from '../display'
import {
  digitsClass, isNewerTombola, isPhoneTicket, machineSample, normalizeRanges, overlapsPhones, phoneStartAfter,
  rangesCount, rangesText, ticketRanges, type TombolaLive,
} from '../tombola'

const base = (over: Partial<TombolaLive> = {}): TombolaLive => ({
  active: true, mode: 'tombola', v: 1, tombolaId: 't1', status: 'lobby', paper: [[1, 250]], paperCount: 250,
  phoneFrom: 301, phoneCount: 3, phoneOpen: true, total: 253, left: 253, draws: [], hidden: false,
  lastDrawAt: null, revealAt: null, display: {}, paused: false, serverNow: new Date().toISOString(), ...over,
})

describe('tombola : plages', () => {
  it('trie et fusionne les plages (contiguës comprises)', () => {
    expect(normalizeRanges([[400, 450], [1, 250], [251, 260], [100, 120]])).toEqual([[1, 260], [400, 450]])
  })
  it('ignore les plages invalides', () => {
    expect(normalizeRanges([[0, 5], [9, 3], [1, 10000], [5, 5]])).toEqual([[5, 5]])
  })
  it('compte et décrit', () => {
    expect(rangesCount([[1, 250], [400, 450]])).toBe(301)
    expect(rangesText([[400, 450], [1, 250]])).toBe('1 à 250, 400 à 450')
    expect(rangesText([])).toBe('aucun')
  })
})

describe('tombola : départ des tickets téléphone (centaine suivante)', () => {
  it.each([
    [[[1, 250]], 301],
    [[[1, 300]], 401],
    [[[1, 99]], 101],
    [[[1, 250], [400, 450]], 501],
    [[], 1],
    [[[1, 9950]], null],
  ] as const)('%j → %s', (ranges, from) => {
    expect(phoneStartAfter(ranges as unknown as [number, number][])).toBe(from)
  })
  it('détecte une plage qui touche les numéros téléphone', () => {
    expect(overlapsPhones([[1, 250]], 301)).toBe(false)
    expect(overlapsPhones([[1, 301]], 301)).toBe(true)
    expect(overlapsPhones([[1, 5000]], null)).toBe(false)
  })
})

describe('tombola : numéros distribués et machine', () => {
  it('papier + téléphone consécutifs', () => {
    expect(ticketRanges(base())).toEqual([[1, 250], [301, 303]])
    expect(isPhoneTicket(base(), 302)).toBe(true)
    expect(isPhoneTicket(base(), 250)).toBe(false)
  })
  it('la machine ne montre que des numéros distribués et pas encore sortis', () => {
    const s = base({ draws: [{ seq: 1, n: 7, o: 'winner', lot: 1 }, { seq: 2, n: 302, o: 'absent', lot: null }] })
    const sample = machineSample(s, 40, 3)
    expect(sample.length).toBe(40)
    expect(new Set(sample).size).toBe(40)
    for (const n of sample) {
      expect((n >= 1 && n <= 250) || (n >= 301 && n <= 303)).toBe(true)
      expect(n === 7 || n === 302).toBe(false)
    }
  })
  it('échantillon stable (même graine = mêmes boules)', () => {
    expect(machineSample(base(), 10, 5)).toEqual(machineSample(base(), 10, 5))
  })
})

describe('tombola : boules au-delà de 90 (loto inchangé)', () => {
  it('1 à 90 : couleur de la dizaine, comme avant', () => {
    for (const n of [1, 9, 10, 45, 79, 80, 90]) expect(ballVars(n)['--c']).toBe(familyOf(n).c)
  })
  it('au-delà de 90 : couleurs variées', () => {
    const cols = new Set([91, 92, 93, 94, 95, 96, 97, 98, 99].map((n) => ballVars(n)['--c']))
    expect(cols.size).toBeGreaterThan(5)
  })
  it('taille du texte selon les chiffres', () => {
    expect(digitsClass(90)).toBe('')
    expect(digitsClass(147)).toBe('d3')
    expect(digitsClass(1234)).toBe('d4')
    expect(digitsClass(null)).toBe('')
  })
})

describe('tombola : versions', () => {
  it('ignore un état plus ancien, accepte une autre tombola', () => {
    expect(isNewerTombola(base({ v: 1 }), base({ v: 2 }))).toBe(false)
    expect(isNewerTombola(base({ v: 3 }), base({ v: 2 }))).toBe(true)
    expect(isNewerTombola(base({ v: 1, tombolaId: 't2' }), base({ v: 9 }))).toBe(true)
    expect(isNewerTombola({ active: false, serverNow: '' }, base())).toBe(true)
  })
})
