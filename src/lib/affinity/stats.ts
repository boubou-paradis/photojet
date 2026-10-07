// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Statistiques collectives : uniquement des données agrégées, jamais
// nominatives. Une statistique sans intérêt n'est pas produite plutôt que
// d'être fabriquée.

import { AFFINITY_MIN_RESPONSES_FOR_STATS } from './constants'
import type {
  AffinityFinalStats,
  AffinityQuestion,
  AffinityRevealData,
  AffinityScoringPlayer,
  AffinityStatAnswer,
} from './types'

const UNANIMOUS_MIN = 70 // « le choix le plus unanime » : au moins 70 % de la salle
const DIVIDED_MAX_GAP = 10 // « a divisé la salle » : les deux premières réponses à 10 points ou moins
const MAJORITY_MIN = 55 // « la majorité de la soirée » : une majorité nette mais pas unanime
const ORIGINALS_MAX = 15 // « les originaux » : 15 % ou moins de la salle
const SURPRISE_MIN = 75 // « la surprise » : 75 % du groupe font le même choix…
const SURPRISE_MIN_LIFT = 1.3 // …nettement plus que la salle en général
const SURPRISE_MIN_GROUP = 5

/** Pourcentages entiers dont la somme fait 100 (méthode du plus fort reste). */
export function toPercents(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, n) => sum + n, 0)
  if (total === 0) return counts.map(() => 0)

  const exact = counts.map((n) => (n / total) * 100)
  const floors = exact.map(Math.floor)
  let missing = 100 - floors.reduce((sum, n) => sum + n, 0)
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((x, y) => y.rest - x.rest || x.index - y.index)
  for (const { index } of order) {
    if (missing <= 0) break
    floors[index]++
    missing--
  }
  return floors
}

/** Données de révélation d'une question, à partir des index de réponse reçus. */
export function buildReveal(question: AffinityQuestion, answerIndexes: readonly number[]): AffinityRevealData {
  const counts = question.answers.map(() => 0)
  for (const index of answerIndexes) {
    if (Number.isInteger(index) && index >= 0 && index < counts.length) counts[index]++
  }
  const total = counts.reduce((sum, n) => sum + n, 0)
  const max = Math.max(...counts)
  const leaders = counts.filter((n) => n === max).length

  return {
    questionId: question.id,
    counts,
    percents: toPercents(counts),
    total,
    majorityIndex: total > 0 && leaders === 1 ? counts.indexOf(max) : null,
  }
}

function statAnswer(question: AffinityQuestion, reveal: AffinityRevealData, answerIndex: number): AffinityStatAnswer {
  return {
    questionId: question.id,
    questionText: question.text,
    answerIndex,
    answerText: question.answers[answerIndex],
    percent: reveal.percents[answerIndex],
  }
}

/**
 * Statistiques de fin, calculées sur les questions révélées.
 * Une même question n'est utilisée que par une seule statistique.
 */
export function computeFinalStats(
  questions: readonly AffinityQuestion[],
  revealedQuestionIds: readonly string[],
  players: readonly AffinityScoringPlayer[],
): AffinityFinalStats {
  const revealed = questions.filter((q) => revealedQuestionIds.includes(q.id))
  const reveals = new Map<string, AffinityRevealData>()
  for (const question of revealed) {
    const indexes = players.map((p) => p.answers[question.id]).filter((n): n is number => n !== undefined)
    reveals.set(question.id, buildReveal(question, indexes))
  }

  const usable = revealed.filter((q) => (reveals.get(q.id)?.total ?? 0) >= AFFINITY_MIN_RESPONSES_FOR_STATS)
  const used = new Set<string>()
  const stats: AffinityFinalStats = {}

  const sortedByTopShare = usable
    .map((q) => {
      const reveal = reveals.get(q.id) as AffinityRevealData
      const ranked = reveal.percents.map((percent, index) => ({ percent, index })).sort((x, y) => y.percent - x.percent || x.index - y.index)
      return { q, reveal, ranked }
    })
    .sort((x, y) => y.ranked[0].percent - x.ranked[0].percent || questions.indexOf(x.q) - questions.indexOf(y.q))

  // Le choix le plus unanime
  const unanimous = sortedByTopShare.find((e) => e.reveal.majorityIndex !== null && e.ranked[0].percent >= UNANIMOUS_MIN)
  if (unanimous) {
    stats.unanimous = statAnswer(unanimous.q, unanimous.reveal, unanimous.ranked[0].index)
    used.add(unanimous.q.id)
  }

  // La question qui a le plus divisé la salle
  const divided = sortedByTopShare
    .filter((e) => !used.has(e.q.id) && e.ranked[1] && e.ranked[0].percent - e.ranked[1].percent <= DIVIDED_MAX_GAP && e.ranked[1].percent > 0)
    .sort((x, y) => (x.ranked[0].percent - x.ranked[1].percent) - (y.ranked[0].percent - y.ranked[1].percent) || questions.indexOf(x.q) - questions.indexOf(y.q))[0]
  if (divided) {
    stats.divided = {
      first: statAnswer(divided.q, divided.reveal, divided.ranked[0].index),
      second: statAnswer(divided.q, divided.reveal, divided.ranked[1].index),
    }
    used.add(divided.q.id)
  }

  // La majorité de la soirée
  const majority = sortedByTopShare.find(
    (e) => !used.has(e.q.id) && e.reveal.majorityIndex !== null && e.ranked[0].percent >= MAJORITY_MIN,
  )
  if (majority) {
    stats.majority = statAnswer(majority.q, majority.reveal, majority.ranked[0].index)
    used.add(majority.q.id)
  }

  // Les originaux : la réponse la plus rare (mais choisie par quelqu'un)
  const originals = sortedByTopShare
    .filter((e) => !used.has(e.q.id))
    .flatMap((e) => e.reveal.counts.map((count, index) => ({ e, index, count, percent: e.reveal.percents[index] })))
    .filter((c) => c.count > 0 && c.percent > 0 && c.percent <= ORIGINALS_MAX)
    .sort((x, y) => x.percent - y.percent || questions.indexOf(x.e.q) - questions.indexOf(y.e.q) || x.index - y.index)[0]
  if (originals) {
    stats.originals = statAnswer(originals.e.q, originals.e.reveal, originals.index)
    used.add(originals.e.q.id)
  }

  // La surprise : deux réponses de deux questions différentes qui vont ensemble
  let best: { given: AffinityStatAnswer; then: AffinityStatAnswer; lift: number } | null = null
  for (const qa of usable) {
    const revealA = reveals.get(qa.id) as AffinityRevealData
    for (let a = 0; a < qa.answers.length; a++) {
      const group = players.filter((p) => p.answers[qa.id] === a)
      if (group.length < SURPRISE_MIN_GROUP) continue
      for (const qb of usable) {
        if (qb.id === qa.id) continue
        const revealB = reveals.get(qb.id) as AffinityRevealData
        const answered = group.filter((p) => p.answers[qb.id] !== undefined)
        if (answered.length < SURPRISE_MIN_GROUP) continue
        for (let b = 0; b < qb.answers.length; b++) {
          const share = Math.round((answered.filter((p) => p.answers[qb.id] === b).length / answered.length) * 100)
          const overall = revealB.percents[b]
          if (share < SURPRISE_MIN || overall === 0) continue
          const lift = share / overall
          if (lift < SURPRISE_MIN_LIFT) continue
          if (!best || lift > best.lift) {
            best = {
              given: statAnswer(qa, revealA, a),
              then: { ...statAnswer(qb, revealB, b), percent: share },
              lift,
            }
          }
        }
      }
    }
  }
  if (best) stats.surprise = { given: best.given, then: best.then }

  return stats
}
