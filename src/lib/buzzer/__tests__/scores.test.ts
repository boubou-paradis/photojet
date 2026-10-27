// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it } from 'vitest'
import { findMyScore, formatPoints, formatRank, hasAnyPoints, isNewerScores, isTied, parseScoreArgs, type ScoresActiveState } from '../scores'

const NOW = '2026-10-28T20:00:00.000Z'
const LATER = '2026-10-28T20:00:05.000Z'

function board(over: Partial<ScoresActiveState> = {}): ScoresActiveState {
  return {
    active: true, v: 3, shown: false, pointsPerRound: 1, votePoints: 1, serverNow: NOW,
    scores: [
      { unit: 'p:a', label: 'Luna', points: 3, rank: 1 },
      { unit: 'p:b', label: 'Max', points: 3, rank: 1 },
      { unit: 'p:c', label: 'Zoé', points: 0, rank: 3 },
    ],
    ...over,
  }
}

describe('parseScoreArgs', () => {
  it('correction : joueur et points entiers non nuls', () => {
    expect(parseScoreArgs('adjust', { unit: 'p:abc', delta: 2 })).toEqual({ ok: true, value: { unit: 'p:abc', delta: 2 } })
    expect(parseScoreArgs('adjust', { unit: 't:table 4', delta: -1 }).ok).toBe(true)
    expect(parseScoreArgs('adjust', { unit: 'p:abc', delta: 0 }).ok).toBe(false)
    expect(parseScoreArgs('adjust', { unit: 'p:abc', delta: 1.5 }).ok).toBe(false)
    expect(parseScoreArgs('adjust', { unit: 'p:abc', delta: 101 }).ok).toBe(false)
    expect(parseScoreArgs('adjust', { unit: 'x:abc', delta: 1 }).ok).toBe(false)
    expect(parseScoreArgs('adjust', { delta: 1 }).ok).toBe(false)
  })

  it('réglages : 0 à 100, au moins un', () => {
    expect(parseScoreArgs('settings', { pointsPerRound: 0 })).toEqual({ ok: true, value: { pointsPerRound: 0 } })
    expect(parseScoreArgs('settings', { pointsPerRound: 5, votePoints: 2 })).toEqual({ ok: true, value: { pointsPerRound: 5, votePoints: 2 } })
    expect(parseScoreArgs('settings', { pointsPerRound: -1 }).ok).toBe(false)
    expect(parseScoreArgs('settings', { votePoints: 101 }).ok).toBe(false)
    expect(parseScoreArgs('settings', { pointsPerRound: '2' }).ok).toBe(false)
    expect(parseScoreArgs('settings', {}).ok).toBe(false)
  })

  it('autres actions : aucun argument transmis', () => {
    expect(parseScoreArgs('show', { anything: 1 })).toEqual({ ok: true, value: {} })
    expect(parseScoreArgs('reset', null)).toEqual({ ok: true, value: {} })
  })
})

describe('isNewerScores', () => {
  it('version supérieure, ou même version plus récente', () => {
    expect(isNewerScores(board({ v: 4 }), board())).toBe(true)
    expect(isNewerScores(board({ v: 2 }), board())).toBe(false)
    expect(isNewerScores(board({ serverNow: LATER }), board())).toBe(true)
    expect(isNewerScores(board(), board())).toBe(false)
    expect(isNewerScores(board(), null)).toBe(true)
    expect(isNewerScores({ active: false, serverNow: LATER }, board())).toBe(true)
  })
})

describe('findMyScore', () => {
  it('par clé d’unité (joueur ou équipe)', () => {
    expect(findMyScore(board(), 'p:b')?.label).toBe('Max')
    expect(findMyScore(board(), 'p:z')).toBeNull()
    const teams = board({ scores: [{ unit: 't:table4', label: 'Table 4', points: 2, rank: 1 }] })
    expect(findMyScore(teams, 't:table4')?.points).toBe(2)
  })
})

describe('affichage', () => {
  it('points, rangs et ex æquo', () => {
    expect(formatPoints(1)).toBe('1 pt')
    expect(formatPoints(0)).toBe('0 pt')
    expect(formatPoints(3)).toBe('3 pts')
    expect(formatPoints(-2)).toBe('-2 pts')
    expect(formatRank(1)).toBe('1er')
    expect(formatRank(3)).toBe('3e')
    expect(formatRank(1, true)).toBe('1er ex æquo')
    expect(isTied(board(), board().scores[0])).toBe(true)
    expect(isTied(board(), board().scores[2])).toBe(false)
  })
  it('classement vide ou à zéro', () => {
    expect(hasAnyPoints(null)).toBe(false)
    expect(hasAnyPoints(board({ scores: [{ unit: 'p:a', label: 'A', points: 0, rank: 1 }] }))).toBe(false)
    expect(hasAnyPoints(board())).toBe(true)
  })
})
