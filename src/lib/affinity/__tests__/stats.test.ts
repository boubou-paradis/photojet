import { describe, expect, it } from 'vitest'
import { buildReveal, computeFinalStats, toPercents } from '../stats'
import type { AffinityQuestion, AffinityScoringPlayer } from '../types'

const q = (id: string, text: string, answers: string[]): AffinityQuestion => ({ id, text, answers, timeLimit: 20 })

describe('toPercents', () => {
  it('donne des entiers dont la somme fait 100', () => {
    const percents = toPercents([1, 1, 1])
    expect(percents.reduce((a, b) => a + b, 0)).toBe(100)
    expect(percents).toEqual([34, 33, 33])
  })

  it('ne divise jamais par zéro', () => {
    expect(toPercents([0, 0, 0, 0])).toEqual([0, 0, 0, 0])
  })
})

describe('buildReveal', () => {
  const mer = q('mer', 'Plutôt mer ou montagne ?', ['Mer', 'Montagne'])

  it('compte les réponses et désigne la majorité', () => {
    expect(buildReveal(mer, [0, 0, 1])).toEqual({ questionId: 'mer', counts: [2, 1], percents: [67, 33], total: 3, majorityIndex: 0 })
  })

  it('gère une question sans aucune réponse', () => {
    expect(buildReveal(mer, [])).toEqual({ questionId: 'mer', counts: [0, 0], percents: [0, 0], total: 0, majorityIndex: null })
  })

  it('n\'invente pas de majorité en cas d\'égalité', () => {
    expect(buildReveal(mer, [0, 1]).majorityIndex).toBeNull()
  })

  it('ignore les index hors bornes', () => {
    expect(buildReveal(mer, [0, 5, -1]).counts).toEqual([1, 0])
  })
})

describe('computeFinalStats', () => {
  const questions = [
    q('batterie', 'La batterie de ton téléphone ?', ['Toujours à 100 %', 'Je vis à 3 %']),
    q('mer', 'Plutôt mer ou montagne ?', ['Mer', 'Montagne']),
    q('apero', 'Ton apéro idéal ?', ['Terrasse au soleil', 'Canapé entre amis', 'Bar animé', 'Pique-nique']),
    q('karaoke', 'Le karaoké ?', ['J\'adore', 'Seulement après minuit', 'Jamais']),
  ]
  const ids = questions.map((x) => x.id)

  // 100 joueurs : batterie 87 % « 3 % », mer 51/49, apéro 68 % terrasse, karaoké 11 % « J'adore »
  const players: AffinityScoringPlayer[] = Array.from({ length: 100 }, (_, i) => ({
    id: `p${i}`,
    nickname: `p${i}`,
    table: null,
    consent: true,
    joinedAt: '2026-10-07T20:00:00.000Z',
    answers: {
      batterie: i < 87 ? 1 : 0,
      mer: i < 51 ? 0 : 1,
      apero: i < 68 ? 0 : i < 85 ? 1 : i < 96 ? 2 : 3,
      karaoke: i < 11 ? 0 : i < 60 ? 1 : 2,
    },
  }))

  it('trouve les statistiques intéressantes, chacune sur une question différente', () => {
    const stats = computeFinalStats(questions, ids, players)
    expect(stats.unanimous).toMatchObject({ questionId: 'batterie', answerText: 'Je vis à 3 %', percent: 87 })
    expect(stats.divided?.first).toMatchObject({ questionId: 'mer', answerText: 'Mer', percent: 51 })
    expect(stats.divided?.second).toMatchObject({ answerText: 'Montagne', percent: 49 })
    expect(stats.majority).toMatchObject({ questionId: 'apero', answerText: 'Terrasse au soleil', percent: 68 })
    expect(stats.originals).toMatchObject({ questionId: 'karaoke', answerText: 'J\'adore', percent: 11 })
    const used = [stats.unanimous?.questionId, stats.divided?.first.questionId, stats.majority?.questionId, stats.originals?.questionId]
    expect(new Set(used).size).toBe(used.length)
  })

  it('n\'invente rien quand rien n\'est intéressant', () => {
    // 4 joueurs seulement : sous le minimum de réponses, aucune stat
    expect(computeFinalStats(questions, ids, players.slice(0, 4))).toEqual({})
  })

  it('ignore les questions non révélées', () => {
    const stats = computeFinalStats(questions, ['mer'], players)
    expect(stats.unanimous).toBeUndefined()
    expect(stats.divided?.first.questionId).toBe('mer')
  })

  it('détecte une surprise : deux réponses qui vont ensemble', () => {
    const qs = [q('nuit', 'Lève-tôt ou couche-tard ?', ['Lève-tôt', 'Couche-tard']), q('fromage', 'Fondue, raclette ou tartiflette ?', ['Fondue', 'Raclette', 'Tartiflette'])]
    // 20 joueurs : 10 couche-tard dont 9 raclette ; les lève-tôt jamais raclette
    const group: AffinityScoringPlayer[] = Array.from({ length: 20 }, (_, i) => ({
      id: `s${i}`, nickname: `s${i}`, table: null, consent: true, joinedAt: '2026-10-07T20:00:00.000Z',
      answers: { nuit: i < 10 ? 1 : 0, fromage: i < 9 ? 1 : i < 15 ? 0 : 2 },
    }))
    const stats = computeFinalStats(qs, ['nuit', 'fromage'], group)
    expect(stats.surprise?.given).toMatchObject({ questionId: 'nuit', answerText: 'Couche-tard', percent: 50 })
    expect(stats.surprise?.then).toMatchObject({ questionId: 'fromage', answerText: 'Raclette', percent: 90 })
  })
})
