// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Calcul des points communs. Exécuté UNIQUEMENT côté serveur, une fois, à la
// fin de la partie. Le navigateur ne reçoit que son propre Top 5.

import { AFFINITY_MIN_COMMON_RATIO, AFFINITY_TOP_SIZE } from './constants'
import type { AffinityMatch, AffinityScoringPlayer } from './types'

export interface PairScore {
  identical: number
  comparable: number
  /** Pourcentage arrondi, `null` si le résultat ne doit pas être affiché. */
  score: number | null
}

/** Nombre minimal de questions répondues en commun : 60 % des questions révélées, au moins 1. */
export function minComparable(revealedCount: number): number {
  return Math.max(1, Math.ceil(revealedCount * AFFINITY_MIN_COMMON_RATIO))
}

/**
 * Score entre deux joueurs sur les questions révélées.
 * Les questions auxquelles l'un des deux n'a pas répondu sont ignorées.
 * Pas de résultat sous le seuil de 60 %, ni à 0 %.
 */
export function scorePair(
  a: Record<string, number>,
  b: Record<string, number>,
  revealedQuestionIds: readonly string[],
): PairScore {
  let comparable = 0
  let identical = 0
  for (const questionId of revealedQuestionIds) {
    const answerA = a[questionId]
    const answerB = b[questionId]
    if (answerA === undefined || answerB === undefined) continue
    comparable++
    if (answerA === answerB) identical++
  }

  const displayable =
    revealedQuestionIds.length > 0 &&
    comparable >= minComparable(revealedQuestionIds.length) &&
    identical > 0

  return {
    identical,
    comparable,
    score: displayable ? Math.round((identical / comparable) * 100) : null,
  }
}

/**
 * Ordre du Top 5 : le plus de réponses identiques d'abord, puis le meilleur %,
 * puis un départage stable et sans signification (arrivée, puis identifiant).
 * Jamais de hasard : le résultat est le même après chaque recalcul.
 */
function compareCandidates(
  x: { pair: PairScore; player: AffinityScoringPlayer },
  y: { pair: PairScore; player: AffinityScoringPlayer },
): number {
  if (y.pair.identical !== x.pair.identical) return y.pair.identical - x.pair.identical
  if ((y.pair.score ?? 0) !== (x.pair.score ?? 0)) return (y.pair.score ?? 0) - (x.pair.score ?? 0)
  if (x.player.joinedAt !== y.player.joinedAt) return x.player.joinedAt < y.player.joinedAt ? -1 : 1
  return x.player.id < y.player.id ? -1 : x.player.id > y.player.id ? 1 : 0
}

/**
 * Top 5 de chaque joueur. Seuls les joueurs ayant consenti peuvent apparaître
 * chez les autres ; chaque joueur reçoit son propre Top 5 qu'il ait consenti
 * ou non.
 */
export function computeTopMatches(
  players: readonly AffinityScoringPlayer[],
  revealedQuestionIds: readonly string[],
): Map<string, AffinityMatch[]> {
  const result = new Map<string, AffinityMatch[]>()
  const visible = players.filter((p) => p.consent)

  for (const player of players) {
    const candidates: { pair: PairScore; player: AffinityScoringPlayer }[] = []
    for (const other of visible) {
      if (other.id === player.id) continue
      const pair = scorePair(player.answers, other.answers, revealedQuestionIds)
      if (pair.score === null) continue
      candidates.push({ pair, player: other })
    }

    candidates.sort(compareCandidates)
    result.set(
      player.id,
      candidates.slice(0, AFFINITY_TOP_SIZE).map(({ pair, player: other }) => ({
        nickname: other.nickname,
        table: other.table,
        score: pair.score as number,
        identicalAnswers: pair.identical,
        comparableAnswers: pair.comparable,
      })),
    )
  }

  return result
}
