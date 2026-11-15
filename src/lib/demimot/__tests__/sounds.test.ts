// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it } from 'vitest'
import { countdownDeadline, tickFor, toSoundEvents } from '../sounds'
import type { PublicView } from '../view'

describe('toSoundEvents', () => {
  it('traduit les événements du moteur comme le prototype', () => {
    expect(
      toSoundEvents([
        { type: 'reveal', positions: [3] },
        { type: 'buzz', teamId: 'a' },
        { type: 'letter', letter: 'E', hits: 2 },
        { type: 'letter', letter: 'Z', hits: 0 },
        { type: 'resolved', won: true },
        { type: 'resolved', won: false },
        { type: 'podium' },
      ]),
    ).toEqual(['reveal', 'buzz', 'letter:2', 'letter:0', 'resolved:1', 'resolved:0', 'podium'])
  })

  it('rien ou format inattendu : aucun son', () => {
    expect(toSoundEvents(undefined)).toEqual([])
    expect(toSoundEvents(null)).toEqual([])
  })
})

describe('tic-tac des 5 dernières secondes', () => {
  const view = (phase: string, round: Record<string, unknown>) => ({ phase, round } as unknown as PublicView)

  it('échéance selon la phase', () => {
    expect(countdownDeadline(view('answering', { buzz: { deadline: 10 } }))).toBe(10)
    expect(countdownDeadline(view('final_window', { finalWindowEndsAt: 20 }))).toBe(20)
    expect(countdownDeadline(view('turn', { turn: { deadline: 30 } }))).toBe(30)
    expect(countdownDeadline(view('revealing', { buzz: null }))).toBeNull()
    expect(countdownDeadline(view('paused', { buzz: { deadline: 10 } }))).toBeNull()
    expect(countdownDeadline(null)).toBeNull()
  })

  it('tic de 5 à 2, dernier tic à 1, silence ailleurs', () => {
    expect(tickFor(10_000, 4_000)).toBeNull() // 6 s
    expect(tickFor(10_000, 5_000)).toBe('tick') // 5 s
    expect(tickFor(10_000, 8_500)).toBe('tick') // 2 s
    expect(tickFor(10_000, 9_200)).toBe('tickLast') // 1 s
    expect(tickFor(10_000, 10_000)).toBeNull() // fini
  })
})
