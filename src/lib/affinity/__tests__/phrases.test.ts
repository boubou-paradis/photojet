import { describe, expect, it } from 'vitest'
import { clockOffset, secondsLeft } from '../clock'
import { finalStatLines, playerRevealLine, revealPhrase } from '../phrases'
import { buildReveal } from '../stats'
import type { AffinityQuestion } from '../types'

const apero: AffinityQuestion = { id: 'apero', text: 'Ton apéro idéal ?', answers: ['Terrasse au soleil', 'Canapé entre amis', 'Bar animé', 'Pique-nique'], timeLimit: 20 }
/** Les phrases utilisent des espaces insécables ; on les compare en espaces simples. */
const plain = (text: string) => text.replace(/\u00a0/g, ' ')

const reveal = buildReveal(apero, [...Array(68).fill(0), ...Array(17).fill(1), ...Array(11).fill(2), ...Array(4).fill(3)])

describe('revealPhrase', () => {
  it('annonce la majorité', () => {
    expect(plain(revealPhrase(apero, reveal))).toBe('68 % de la salle a choisi « Terrasse au soleil »')
  })
  it('gère une question sans réponse', () => {
    expect(revealPhrase(apero, buildReveal(apero, []))).toBe('Personne n\'a répondu à celle-ci.')
  })
  it('gère une égalité en tête', () => {
    expect(revealPhrase(apero, buildReveal(apero, [0, 1]))).toBe('La salle est partagée à égalité !')
  })
  it('gère l\'unanimité', () => {
    expect(plain(revealPhrase(apero, buildReveal(apero, [2, 2, 2])))).toBe('Toute la salle a choisi « Bar animé »')
  })
})

describe('playerRevealLine', () => {
  it('majorité', () => {
    expect({ ...playerRevealLine(reveal, 0), headline: plain(playerRevealLine(reveal, 0).headline) }).toEqual({ percent: 68, headline: 'Tu fais partie des 68 %', original: false })
  })
  it('originaux à 25 % ou moins', () => {
    expect({ ...playerRevealLine(reveal, 2), headline: plain(playerRevealLine(reveal, 2).headline) }).toEqual({ percent: 11, headline: 'Tu fais partie des 11 % d\'originaux', original: true })
  })
  it('pas de réponse', () => {
    expect(playerRevealLine(reveal, null).headline).toBe('Tu n\'as pas répondu à celle-ci')
  })
})

describe('finalStatLines', () => {
  it('ne produit que les statistiques présentes', () => {
    expect(finalStatLines({})).toEqual([])
    expect(finalStatLines(null)).toEqual([])
    const lines = finalStatLines({
      originals: { questionId: 'k', questionText: 'Le karaoké ?', answerIndex: 0, answerText: 'J\'adore', percent: 11 },
    })
    expect(lines.map((l) => ({ ...l, text: plain(l.text) }))).toEqual([{ label: 'Les originaux', text: 'Seulement 11 % ont choisi « J\'adore »' }])
  })
})

describe('horloge', () => {
  it('estime le décalage au milieu de l\'aller-retour', () => {
    expect(clockOffset(new Date(10_500).toISOString(), 1_000, 2_000)).toBe(9_000)
  })
  it('compte les secondes restantes avec le décalage, jamais en négatif', () => {
    const deadline = new Date(30_000).toISOString()
    expect(secondsLeft(deadline, 0, 10_000)).toBe(20)
    expect(secondsLeft(deadline, 5_000, 10_000)).toBe(15)
    expect(secondsLeft(deadline, 0, 40_000)).toBe(0)
    expect(secondsLeft(null, 0)).toBeNull()
  })
})
