// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import type { AFFINITY_TIME_LIMITS } from './constants'

export type AffinityPhase = 'lobby' | 'question' | 'closed' | 'revealed' | 'finished'

export type AffinityTimeLimit = (typeof AFFINITY_TIME_LIMITS)[number]

/** Une question telle que stockée dans sessions.affinity_questions (public). */
export interface AffinityQuestion {
  id: string
  text: string
  answers: string[]
  timeLimit: AffinityTimeLimit
}

/** Pourcentages d'une question révélée (sessions.affinity_reveal, public, agrégé). */
export interface AffinityRevealData {
  questionId: string
  counts: number[]
  /** Arrondis dont la somme fait 100 (0 partout si personne n'a répondu). */
  percents: number[]
  total: number
  /** Réponse majoritaire, `null` si personne n'a répondu ou en cas d'égalité en tête. */
  majorityIndex: number | null
}

/** Une personne du Top 5 telle que reçue par le téléphone. Rien d'autre. */
export interface AffinityMatch {
  nickname: string
  table: string | null
  score: number
  identicalAnswers: number
  comparableAnswers: number
}

/** Joueur et réponses, tel que lu côté serveur pour le calcul final. */
export interface AffinityScoringPlayer {
  id: string
  nickname: string
  table: string | null
  consent: boolean
  joinedAt: string
  /** questionId -> index de réponse */
  answers: Record<string, number>
}

/** Une ligne de stat : une réponse d'une question, avec sa part de la salle. */
export interface AffinityStatAnswer {
  questionId: string
  questionText: string
  answerIndex: number
  answerText: string
  percent: number
}

/** Statistiques collectives de fin (sessions.affinity_final_stats, public, agrégé).
 *  Chaque entrée est absente quand rien d'intéressant n'a été trouvé. */
export interface AffinityFinalStats {
  unanimous?: AffinityStatAnswer
  divided?: { first: AffinityStatAnswer; second: AffinityStatAnswer }
  majority?: AffinityStatAnswer
  originals?: AffinityStatAnswer
  /** « Parmi ceux qui ont répondu `given`, `then.percent` % ont répondu `then` ».
   *  `given.percent` est la part de la salle, `then.percent` la part du groupe `given`. */
  surprise?: { given: AffinityStatAnswer; then: AffinityStatAnswer }
}

/** Réponse de GET /api/affinity/status (publique, agrégée). */
export interface AffinityStatus {
  live: boolean
  phase: AffinityPhase | null
  playerCount: number
  answeredCount: number
}
