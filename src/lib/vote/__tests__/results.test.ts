import { describe, expect, it } from 'vitest'
import { computeRanking, lastRevealStep, participationPercent, percentOf, revealPlan } from '../results'
import type { VoteCandidate } from '../types'

const cand = (id: string, sortOrder: number): VoteCandidate => ({
  id, label: id, number: String(sortOrder + 1), description: null, imageUrl: null, emoji: null, color: null, sortOrder,
})
const C = [cand('emma', 0), cand('luna', 1), cand('clara', 2), cand('jade', 3)]
const res = (counts: Record<string, number>, blank = 0) => ({ blank, counts: Object.entries(counts).map(([id, votes]) => ({ id, votes })) })

describe('pourcentages', () => {
  it('entiers, sur les votes valides', () => {
    expect(percentOf(33, 86)).toBe(38)
    expect(percentOf(0, 86)).toBe(0)
    expect(percentOf(5, 0)).toBe(0)
  })
  it('les votes blancs ne comptent pas dans les pourcentages', () => {
    const r = computeRanking(C, res({ emma: 30, luna: 10 }, 60))
    expect(r.valid).toBe(40)
    expect(r.blank).toBe(60)
    expect(r.entries[0].percent).toBe(75)
  })
  it('100 % pour un seul candidat, 0 % pour les autres', () => {
    const r = computeRanking(C, res({ luna: 12 }))
    expect(r.entries[0]).toMatchObject({ votes: 12, percent: 100, rank: 1 })
    expect(r.entries.slice(1).every((e) => e.votes === 0 && e.percent === 0)).toBe(true)
    expect(r.leaders.map((e) => e.candidate.id)).toEqual(['luna'])
    expect(r.tie).toBe(false)
  })
})

describe('classement', () => {
  it('trié par voix, ex æquo au même rang (1, 1, 3)', () => {
    const r = computeRanking(C, res({ emma: 32, luna: 32, clara: 13, jade: 9 }))
    expect(r.entries.map((e) => [e.candidate.id, e.rank])).toEqual([['emma', 1], ['luna', 1], ['clara', 3], ['jade', 4]])
    expect(r.tie).toBe(true)
    expect(r.leaders).toHaveLength(2)
  })
  it('ex æquo affichés dans l’ordre de l’éditeur', () => {
    const r = computeRanking(C, res({ jade: 5, clara: 5 }))
    expect(r.entries.slice(0, 2).map((e) => e.candidate.id)).toEqual(['clara', 'jade'])
  })
  it('aucun vote : pas de gagnant, pas d’égalité inventée', () => {
    const r = computeRanking(C, res({}))
    expect(r.valid).toBe(0)
    expect(r.leaders).toEqual([])
    expect(r.tie).toBe(false)
  })
  it('uniquement des votes blancs : pas de gagnant', () => {
    const r = computeRanking(C, res({}, 7))
    expect(r.leaders).toEqual([])
    expect(r.blank).toBe(7)
  })
  it('résultats absents (mode caché) : tout à zéro', () => {
    const r = computeRanking(C, null)
    expect(r.entries.every((e) => e.votes === 0)).toBe(true)
  })
  it('un candidat inconnu dans les totaux est ignoré', () => {
    const r = computeRanking(C, res({ emma: 2, intrus: 50 }))
    expect(r.valid).toBe(2)
  })
})

describe('révélation', () => {
  it('podium : intro, 3e, 2e, gagnant', () => {
    const plan = revealPlan('podium', computeRanking(C, res({ emma: 33, luna: 25, clara: 16, jade: 12 })))
    expect(plan.map((s) => s.kind)).toEqual(['intro', 'place', 'place', 'winner'])
    expect(plan[1]).toMatchObject({ kind: 'place', rank: 3 })
    expect(plan[2]).toMatchObject({ kind: 'place', rank: 2 })
  })
  it('podium à deux candidats : pas de 3e place', () => {
    const plan = revealPlan('podium', computeRanking(C.slice(0, 2), res({ emma: 3, luna: 1 })))
    expect(plan.map((s) => s.kind)).toEqual(['intro', 'place', 'winner'])
  })
  it('podium avec égalité en tête : finale « égalité », pas de 2e place', () => {
    const plan = revealPlan('podium', computeRanking(C, res({ emma: 32, luna: 32, clara: 13 })))
    expect(plan.map((s) => s.kind)).toEqual(['intro', 'place', 'tie'])
  })
  it('gagnant seul et classement complet : deux étapes', () => {
    const r = computeRanking(C, res({ emma: 3, luna: 1 }))
    expect(revealPlan('winner', r).map((s) => s.kind)).toEqual(['intro', 'winner'])
    expect(revealPlan('full', r).map((s) => s.kind)).toEqual(['intro', 'full'])
    expect(lastRevealStep('winner', r)).toBe(1)
  })
  it('aucun vote : intro puis « aucun vote »', () => {
    expect(revealPlan('podium', computeRanking(C, res({}))).map((s) => s.kind)).toEqual(['intro', 'empty'])
  })
  it('un candidat sans voix ne monte jamais sur le podium', () => {
    const plan = revealPlan('podium', computeRanking(C, res({ emma: 4, luna: 2 })))
    expect(plan.some((s) => s.kind === 'place' && s.rank === 3)).toBe(false)
  })
})

describe('participation', () => {
  it('bornée à 100 %', () => {
    expect(participationPercent(83, 112)).toBe(74)
    expect(participationPercent(5, 0)).toBe(0)
    expect(participationPercent(120, 112)).toBe(100)
  })
})
