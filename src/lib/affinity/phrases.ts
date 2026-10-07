// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Phrases affichées à partir des chiffres agrégés. Toujours vraies : elles
// ne disent que ce que les pourcentages disent.

import type { AffinityFinalStats, AffinityQuestion, AffinityRevealData } from './types'

/** Au-delà de ce seuil, une réponse minoritaire fait de toi un « original ». */
export const ORIGINALS_THRESHOLD = 25

const NBSP = '\u00a0'
/** « réponse », avec espaces insécables. */
const quote = (text: string) => `«${NBSP}${text}${NBSP}»`
/** 68 %, avec espace insécable. */
const pct = (value: number) => `${value}${NBSP}%`

/** Phrase de l'écran géant après la révélation. */
export function revealPhrase(question: AffinityQuestion, reveal: AffinityRevealData): string {
  if (reveal.total === 0) return 'Personne n\'a répondu à celle-ci.'
  if (reveal.majorityIndex === null) return 'La salle est partagée à égalité !'
  const percent = reveal.percents[reveal.majorityIndex]
  const answer = question.answers[reveal.majorityIndex]
  if (percent === 100) return `Toute la salle a choisi ${quote(answer)}`
  return `${pct(percent)} de la salle a choisi ${quote(answer)}`
}

export interface PlayerRevealLine {
  /** Pourcentage de sa réponse, `null` s'il n'a pas répondu. */
  percent: number | null
  headline: string
  original: boolean
}

/** Ce que voit le joueur après la révélation. */
export function playerRevealLine(reveal: AffinityRevealData, myAnswerIndex: number | null): PlayerRevealLine {
  if (myAnswerIndex === null || reveal.percents[myAnswerIndex] === undefined) {
    return { percent: null, headline: 'Tu n\'as pas répondu à celle-ci', original: false }
  }
  const percent = reveal.percents[myAnswerIndex]
  const original = myAnswerIndex !== reveal.majorityIndex && percent <= ORIGINALS_THRESHOLD
  return {
    percent,
    headline: original ? `Tu fais partie des ${pct(percent)} d'originaux` : `Tu fais partie des ${pct(percent)}`,
    original,
  }
}

export interface FinalStatLine {
  label: string
  text: string
}

/** Lignes de l'écran de fin, dans l'ordre d'affichage. Seules les stats présentes. */
export function finalStatLines(stats: AffinityFinalStats | null | undefined): FinalStatLine[] {
  if (!stats) return []
  const lines: FinalStatLine[] = []
  if (stats.unanimous) {
    lines.push({ label: 'Le choix le plus unanime', text: `${pct(stats.unanimous.percent)} ont choisi ${quote(stats.unanimous.answerText)}` })
  }
  if (stats.divided) {
    const { first, second } = stats.divided
    lines.push({ label: 'La question qui a divisé la salle', text: `${first.answerText} ${pct(first.percent)} · ${second.answerText} ${pct(second.percent)}` })
  }
  if (stats.majority) {
    lines.push({ label: 'La majorité de la soirée', text: `${pct(stats.majority.percent)} ont choisi ${quote(stats.majority.answerText)}` })
  }
  if (stats.originals) {
    lines.push({ label: 'Les originaux', text: `Seulement ${pct(stats.originals.percent)} ont choisi ${quote(stats.originals.answerText)}` })
  }
  if (stats.surprise) {
    const { given, then } = stats.surprise
    lines.push({ label: 'La surprise de la soirée', text: `Parmi ceux qui ont choisi ${quote(given.answerText)}, ${pct(then.percent)} ont aussi choisi ${quote(then.answerText)}` })
  }
  return lines
}
