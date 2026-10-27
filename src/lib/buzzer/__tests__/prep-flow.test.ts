// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it } from 'vitest'
import { isNewerPrep, nextPrepStep, prepRemoteAction, voteBars, type PrepActiveState } from '../prep-flow'
import type { BuzzerActiveState } from '../types'

const NOW = '2026-10-27T20:00:00.000Z'

function game(over: Partial<BuzzerActiveState> = {}): BuzzerActiveState {
  return {
    active: true, v: 1, phase: 'open', mode: 'solo', teams: [], windowMs: 300, timerS: null,
    roundNo: 1, attempt: 1, openedAt: NOW, deadlineAt: null, firstBuzzAt: null, priority: null,
    queue: [], blocked: [], outcome: null, winner: null, paused: false, serverNow: NOW, ...over,
  }
}

function prep(over: Partial<PrepActiveState> = {}): PrepActiveState {
  return { active: true, v: 1, step: 'ready', roundIndex: 0, total: 3, hasVote: false, serverNow: NOW, ...over }
}

const hand = { phase: 'buzzed' as const, priority: { unit: 'p1', label: 'Léa' } }

describe('nextPrepStep', () => {
  it('lance la manche (ou le vote pour une manche vote seul)', () => {
    expect(nextPrepStep(game({ phase: 'waiting' }), prep())).toEqual({ action: 'round_start', label: 'Lancer la manche 1' })
    expect(nextPrepStep(game({ phase: 'waiting' }), prep({ hasVote: true }), { voteOnly: true })?.action).toBe('vote_open')
    // Vote seul sans vote : on garde le lancement normal.
    expect(nextPrepStep(game(), prep({ hasVote: false }), { voteOnly: true })?.action).toBe('round_start')
  })

  it('pendant la question : rien si ouvert ou buzzé, rouvrir après pause, révéler si fermé', () => {
    expect(nextPrepStep(game(), prep({ step: 'question' }))).toBeNull()
    expect(nextPrepStep(game(hand), prep({ step: 'question' }))).toBeNull()
    expect(nextPrepStep(game({ phase: 'waiting' }), prep({ step: 'question' }))?.action).toBe('open')
    expect(nextPrepStep(game({ phase: 'closed' }), prep({ step: 'question' }))?.action).toBe('reveal')
  })

  it('après la révélation : vote si prévu, sinon manche suivante / fin', () => {
    expect(nextPrepStep(game(), prep({ step: 'reveal', hasVote: true }))?.action).toBe('vote_open')
    expect(nextPrepStep(game(), prep({ step: 'reveal' }))).toEqual({ action: 'next_round', label: 'Manche suivante' })
    expect(nextPrepStep(game(), prep({ step: 'reveal', roundIndex: 2 }))).toEqual({ action: 'next_round', label: 'Terminer les manches' })
  })

  it('vote ouvert → clôturer, clôturé → suivante, fin → rien', () => {
    expect(nextPrepStep(game(), prep({ step: 'vote_open' }))?.action).toBe('vote_close')
    expect(nextPrepStep(game(), prep({ step: 'vote_closed' }))?.action).toBe('next_round')
    expect(nextPrepStep(game(), prep({ step: 'end', roundIndex: 3 }))).toBeNull()
  })
})

describe('prepRemoteAction', () => {
  it('quelqu’un a la main : PageUp = bonne, PageDown = mauvaise', () => {
    expect(prepRemoteAction(game(hand), prep({ step: 'question' }), 'prev')).toBe('right')
    expect(prepRemoteAction(game(hand), prep({ step: 'question' }), 'next')).toBe('wrong')
  })

  it('sinon PageDown suit l’enchaînement et PageUp ne fait rien', () => {
    expect(prepRemoteAction(game({ phase: 'waiting' }), prep(), 'next')).toBe('round_start')
    expect(prepRemoteAction(game({ phase: 'waiting' }), prep(), 'prev')).toBeNull()
    expect(prepRemoteAction(game(), prep({ step: 'vote_open' }), 'next')).toBe('vote_close')
    expect(prepRemoteAction(game(), prep({ step: 'question' }), 'next')).toBeNull()
  })

  it('en pause : aucune action', () => {
    expect(prepRemoteAction(game({ ...hand, paused: true }), prep({ step: 'question' }), 'prev')).toBeNull()
    expect(prepRemoteAction(game({ paused: true }), prep(), 'next')).toBeNull()
  })
})

describe('voteBars', () => {
  it('pourcentages qui totalisent 100', () => {
    const { pct, total } = voteBars([1, 1, 1], null)
    expect(total).toBe(3)
    expect(pct.reduce((a, b) => a + b, 0)).toBe(100)
    expect(pct).toEqual([34, 33, 33])
  })

  it('aucun vote : 0 partout', () => {
    expect(voteBars([0, 0], null)).toEqual({ pct: [0, 0], top: null, total: 0 })
    expect(voteBars([0, 0], 1).top).toBe(1)
  })

  it('mise en avant : bonne réponse, sinon le plus voté, aucun si égalité', () => {
    expect(voteBars([5, 2, 1], 2).top).toBe(2)
    expect(voteBars([5, 2, 1], null).top).toBe(0)
    expect(voteBars([3, 3, 1], null).top).toBeNull()
  })
})

describe('isNewerPrep', () => {
  it('compare les versions entre états actifs', () => {
    expect(isNewerPrep(prep({ v: 2 }), prep({ v: 1 }))).toBe(true)
    expect(isNewerPrep(prep({ v: 1 }), prep({ v: 1 }))).toBe(false)
    expect(isNewerPrep(prep({ v: 1 }), null)).toBe(true)
  })

  it('compare l’horloge serveur si l’un est inactif', () => {
    const later = '2026-10-27T20:00:05.000Z'
    expect(isNewerPrep({ active: false, serverNow: later }, prep())).toBe(true)
    expect(isNewerPrep(prep({ serverNow: NOW }), { active: false, serverNow: later })).toBe(false)
  })
})
