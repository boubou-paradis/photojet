import { describe, expect, it } from 'vitest'
import { computeTopMatches, minComparable, scorePair } from '../score'
import type { AffinityScoringPlayer } from '../types'

const Q10 = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10']

function player(id: string, answers: Record<string, number>, opts: Partial<AffinityScoringPlayer> = {}): AffinityScoringPlayer {
  return { id, nickname: id, table: null, consent: true, joinedAt: '2026-10-07T20:00:00.000Z', answers, ...opts }
}

/** Réponses sur q1..qN, toutes égales à `value` sauf les index listés dans `diff`. */
function answers(n: number, value = 0, diff: number[] = []): Record<string, number> {
  const out: Record<string, number> = {}
  for (let i = 0; i < n; i++) out[Q10[i]] = diff.includes(i) ? value + 1 : value
  return out
}

describe('scorePair', () => {
  it('compte les réponses identiques sur les questions répondues par les deux', () => {
    const result = scorePair(answers(10), answers(10, 0, [0, 1]), Q10)
    expect(result).toEqual({ identical: 8, comparable: 10, score: 80 })
  })

  it('ignore les questions auxquelles l\'un des deux n\'a pas répondu', () => {
    const b = answers(10)
    delete b.q10
    expect(scorePair(answers(10), b, Q10)).toEqual({ identical: 9, comparable: 9, score: 100 })
  })

  it('ne compte que les questions révélées', () => {
    expect(scorePair(answers(10), answers(10, 0, [9]), Q10.slice(0, 5))).toEqual({ identical: 5, comparable: 5, score: 100 })
  })

  it('n\'affiche rien sous le seuil de 60 % des questions révélées', () => {
    const b: Record<string, number> = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 } // 5 sur 10 < 6
    expect(scorePair(answers(10), b, Q10).score).toBeNull()
    expect(scorePair(answers(10), { ...b, q6: 0 }, Q10).score).toBe(100) // 6 sur 10 = seuil
  })

  it('n\'affiche jamais 0 %', () => {
    expect(scorePair(answers(10), answers(10, 1), Q10)).toEqual({ identical: 0, comparable: 10, score: null })
  })

  it('n\'affiche rien sans question révélée', () => {
    expect(scorePair(answers(10), answers(10), []).score).toBeNull()
  })

  it('arrondit le pourcentage', () => {
    expect(scorePair(answers(9), answers(9, 0, [0, 1, 2]), Q10.slice(0, 9)).score).toBe(67) // 6/9
  })
})

describe('minComparable', () => {
  it('vaut 60 % des questions révélées, arrondi au-dessus, au moins 1', () => {
    expect(minComparable(10)).toBe(6)
    expect(minComparable(7)).toBe(5)
    expect(minComparable(1)).toBe(1)
    expect(minComparable(0)).toBe(1)
  })
})

describe('computeTopMatches', () => {
  it('trie par réponses identiques, puis par %, et limite à 5', () => {
    const me = player('me', answers(10))
    const others = [
      player('luna', answers(10, 0, [0, 1])), // 8/10
      player('chris', answers(10, 0, [0, 1, 2])), // 7/10
      player('sam', (() => { const a = answers(10, 0, [0, 1, 2]); delete a.q10; return a })()), // 6/9 = 67
      player('jo', answers(10, 0, [0, 1, 2, 3])), // 6/10 = 60
      player('max', answers(10, 0, [0, 1, 2, 3, 4])), // 5/10
      player('zoe', answers(10, 0, [0, 1, 2, 3, 4, 5])), // 4/10, hors Top 5
    ]
    const top = computeTopMatches([me, ...others], Q10).get('me')!
    expect(top.map((m) => m.nickname)).toEqual(['luna', 'chris', 'sam', 'jo', 'max'])
    expect(top[0]).toEqual({ nickname: 'luna', table: null, score: 80, identicalAnswers: 8, comparableAnswers: 10 })
  })

  it('n\'affiche chez les autres que les joueurs qui ont consenti', () => {
    const paul = player('paul', answers(10), { consent: false })
    const luna = player('luna', answers(10, 0, [0, 1]))
    const result = computeTopMatches([paul, luna], Q10)
    expect(result.get('luna')).toEqual([]) // Paul n'apparaît chez personne…
    expect(result.get('paul')!.map((m) => m.nickname)).toEqual(['luna']) // …mais reçoit son propre Top 5
  })

  it('renvoie un Top 5 vide si personne n\'a consenti', () => {
    const result = computeTopMatches([player('a', answers(10), { consent: false }), player('b', answers(10), { consent: false })], Q10)
    expect(result.get('a')).toEqual([])
    expect(result.get('b')).toEqual([])
  })

  it('départage les ex æquo de façon stable : arrivée, puis identifiant', () => {
    const me = player('me', answers(10))
    const late = player('mango', answers(10, 0, [0, 1, 2]), { joinedAt: '2026-10-07T20:05:00.000Z' })
    const early = player('chris', answers(10, 0, [0, 1, 2]), { joinedAt: '2026-10-07T20:01:00.000Z' })
    const sameTimeB = player('b-id', answers(10, 0, [0, 1, 2]), { joinedAt: '2026-10-07T20:03:00.000Z' })
    const sameTimeA = player('a-id', answers(10, 0, [0, 1, 2]), { joinedAt: '2026-10-07T20:03:00.000Z' })
    const order = (list: AffinityScoringPlayer[]) => computeTopMatches([me, ...list], Q10).get('me')!.map((m) => m.nickname)

    const expected = ['chris', 'a-id', 'b-id', 'mango']
    expect(order([late, early, sameTimeB, sameTimeA])).toEqual(expected)
    // Même résultat quel que soit l'ordre d'entrée (stabilité après recalcul)
    expect(order([sameTimeA, sameTimeB, early, late])).toEqual(expected)
    expect(order([early, late, sameTimeA, sameTimeB])).toEqual(expected)
  })

  it('ne propose jamais le joueur à lui-même', () => {
    const me = player('me', answers(10))
    expect(computeTopMatches([me], Q10).get('me')).toEqual([])
  })

  it('reste rapide avec 200 joueurs et 20 questions', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `q${i}`)
    const players = Array.from({ length: 200 }, (_, p) =>
      player(`p${String(p).padStart(3, '0')}`, Object.fromEntries(ids.map((q, i) => [q, (p * 7 + i * 3) % 4]))),
    )
    const start = performance.now()
    const result = computeTopMatches(players, ids)
    expect(performance.now() - start).toBeLessThan(2000)
    expect(result.size).toBe(200)
  })
})
