// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Calcul des résultats d'AnimaVote (logique pure, testée unitairement).
// Entrée : les totaux agrégés par la base, jamais des bulletins individuels.
// Pourcentage = votes du candidat / votes valides (hors blancs) × 100, arrondi
// à l'entier. Ex æquo : même rang (1, 1, 3), jamais de gagnant inventé.

import type { VoteCandidate, VoteResults, VoteRevealMode } from './types'

export interface RankedCandidate {
  candidate: VoteCandidate
  votes: number
  /** Pourcentage entier des votes valides (0 s'il n'y en a aucun). */
  percent: number
  /** Rang « sportif » : deux premiers ex æquo = 1, 1, puis 3. */
  rank: number
}

export interface Ranking {
  entries: RankedCandidate[]
  /** Votes pour un candidat (blancs exclus). */
  valid: number
  blank: number
  /** Candidats classés premiers (plusieurs = égalité ; vide si aucun vote valide). */
  leaders: RankedCandidate[]
  tie: boolean
}

export function percentOf(votes: number, valid: number): number {
  if (valid <= 0) return 0
  return Math.round((votes / valid) * 100)
}

/** Classement à partir des totaux. Ex æquo départagés à l'affichage par l'ordre de l'éditeur. */
export function computeRanking(candidates: readonly VoteCandidate[], results: VoteResults | null): Ranking {
  const byId = new Map((results?.counts ?? []).map((c) => [c.id, Math.max(0, c.votes)]))
  const blank = Math.max(0, results?.blank ?? 0)
  const valid = candidates.reduce((sum, c) => sum + (byId.get(c.id) ?? 0), 0)

  const sorted = [...candidates]
    .map((candidate) => ({ candidate, votes: byId.get(candidate.id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes || a.candidate.sortOrder - b.candidate.sortOrder)

  const entries: RankedCandidate[] = []
  sorted.forEach((item, index) => {
    const previous = entries[index - 1]
    const rank = previous && previous.votes === item.votes ? previous.rank : index + 1
    entries.push({ ...item, percent: percentOf(item.votes, valid), rank })
  })

  const leaders = valid > 0 ? entries.filter((e) => e.rank === 1) : []
  return { entries, valid, blank, leaders, tie: leaders.length > 1 }
}

/**
 * Étapes de la révélation sur l'écran géant. L'étape 0 est toujours
 * l'introduction (« Les votes sont clos », nombre de votants, « Découvrons
 * le résultat… »). Ensuite :
 *  - winner : le gagnant (ou l'égalité) ;
 *  - podium : 3e place, 2e place, puis le gagnant (places existantes seulement,
 *    ex æquo révélés ensemble) ;
 *  - full : le classement complet.
 * Sans aucun vote valide : introduction puis « aucun vote ».
 */
export type RevealStep =
  | { kind: 'intro' }
  | { kind: 'place'; rank: number; entries: RankedCandidate[] }
  | { kind: 'winner'; entries: RankedCandidate[] }
  | { kind: 'tie'; entries: RankedCandidate[] }
  | { kind: 'full'; entries: RankedCandidate[] }
  | { kind: 'empty' }

export function revealPlan(mode: VoteRevealMode, ranking: Ranking): RevealStep[] {
  const steps: RevealStep[] = [{ kind: 'intro' }]
  if (ranking.valid === 0) return [...steps, { kind: 'empty' }]

  const final: RevealStep = ranking.tie
    ? { kind: 'tie', entries: ranking.leaders }
    : { kind: 'winner', entries: ranking.leaders }

  if (mode === 'full') return [...steps, { kind: 'full', entries: ranking.entries }]
  if (mode === 'winner') return [...steps, final]

  // Podium : groupes de rang 3 puis 2 (s'ils existent et ont des voix), puis le 1er.
  for (const rank of [3, 2]) {
    const group = ranking.entries.filter((e) => e.rank === rank && e.votes > 0)
    if (group.length > 0) steps.push({ kind: 'place', rank, entries: group })
  }
  return [...steps, final]
}

/** Dernière étape de la révélation (la base n'accepte que l'étape suivante, une à la fois). */
export function lastRevealStep(mode: VoteRevealMode, ranking: Ranking): number {
  return revealPlan(mode, ranking).length - 1
}

/** Participation en pourcentage entier (bulletins / téléphones connectés). */
export function participationPercent(total: number, participants: number): number {
  if (participants <= 0) return 0
  return Math.min(100, Math.round((total / participants) * 100))
}
