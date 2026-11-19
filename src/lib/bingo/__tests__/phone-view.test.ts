import { describe, expect, it } from 'vitest'
import { bestRow, fullRows, rowProgress, visibleLast, wrongMarks } from '../phone-view'
import type { BingoPublicState } from '../types'

// Carton conforme : 5 numéros par ligne.
const cells = [
  1, 0, 22, 0, 41, 0, 63, 0, 85,
  0, 12, 0, 33, 0, 55, 0, 77, 88,
  5, 0, 27, 38, 0, 59, 0, 79, 0,
]

const state = (over: Partial<Extract<BingoPublicState, { active: true }>>): BingoPublicState => ({
  active: true, v: 1, gameId: 'g', round: 1, status: 'running', phases: ['quine'], phaseIndex: 0,
  drawn: [7, 42], count: 2, last: 42, lastDrawAt: null, revealAt: '2026-11-18T20:00:00.000Z', autoMode: 'manual', autoMs: 8000,
  display: {}, players: 1, pending: 0, winners: [], paused: false, serverNow: '2026-11-18T20:00:00.000Z', ...over,
})

describe('téléphone AnimaBingo', () => {
  it('progression par ligne et meilleure ligne', () => {
    expect(rowProgress(cells, [1, 22, 12, 999])).toEqual([2, 1, 0])
    expect(bestRow(cells, [])).toBe(0)
    expect(bestRow(cells, [5, 27, 38])).toBe(3)
  })
  it('lignes complètes', () => {
    expect(fullRows(cells, [1, 22, 41, 63, 85, 12])).toEqual([1])
    expect(fullRows(cells, [1, 22, 41, 63, 85, 5, 27, 38, 59, 79])).toEqual([1, 3])
  })
  it('jetons sur un numéro pas encore sorti', () => {
    expect(wrongMarks([1, 22, 41], [1, 41, 90])).toEqual([22])
  })
  it('dernier numéro : jamais avant le grand écran, masquable par la régie', () => {
    const reveal = Date.parse('2026-11-18T20:00:00.000Z')
    expect(visibleLast(state({}), reveal + 10)).toBe(42)
    expect(visibleLast(state({}), reveal - 500)).toBe(7)
    expect(visibleLast(state({ display: { showLast: false } }), reveal + 10)).toBeNull()
    expect(visibleLast(state({ drawn: [42], count: 1 }), reveal - 500)).toBeNull()
  })
})
