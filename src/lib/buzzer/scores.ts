// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — points et classement : logique pure (sans base ni navigateur),
// testée unitairement. Le classement public est celui que renvoie la
// fonction SQL buzzer_scores_public (diffusé sur le canal privé, événement
// « scores ») : tous les joueurs (ou équipes) présents, même à 0 point,
// rang avec ex æquo (1, 1, 3).

export interface ScoreEntry {
  /** « p:<joueur> » en individuel, « t:<équipe> » en équipe. */
  unit: string
  label: string
  points: number
  rank: number
}

export interface ScoresActiveState {
  active: true
  v: number
  /** Classement affiché sur l'écran géant. */
  shown: boolean
  pointsPerRound: number
  votePoints: number
  scores: ScoreEntry[]
  serverNow: string
}

export interface ScoresInactiveState {
  active: false
  serverNow: string
}

export type ScoresState = ScoresActiveState | ScoresInactiveState

/** Actions de la fonction SQL buzzer_score_admin ouvertes à la page animateur. */
export const SCORE_ACTIONS = ['snapshot', 'adjust', 'settings', 'show', 'hide', 'reset'] as const
export type ScoreAction = (typeof SCORE_ACTIONS)[number]

export const MAX_POINTS = 100

/** Un état reçu ne remplace l'état affiché que s'il est plus récent. */
export function isNewerScores(next: ScoresState, current: ScoresState | null): boolean {
  if (!current) return true
  if (!next.active || !current.active) return Date.parse(next.serverNow) >= Date.parse(current.serverNow)
  return next.v > current.v || (next.v === current.v && Date.parse(next.serverNow) > Date.parse(current.serverNow))
}

type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

const isPoints = (v: unknown, min: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= MAX_POINTS

/** Arguments d'une action de points (envoyés par la page animateur). */
export function parseScoreArgs(action: ScoreAction, raw: unknown): Validated<Record<string, unknown>> {
  const a = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  if (action === 'adjust') {
    const unit = a.unit
    const delta = a.delta
    if (typeof unit !== 'string' || !/^[pt]:.{1,62}$/.test(unit)) return { ok: false, error: 'Joueur inconnu.' }
    if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_POINTS) {
      return { ok: false, error: 'Nombre de points invalide.' }
    }
    return { ok: true, value: { unit, delta } }
  }
  if (action === 'settings') {
    const value: Record<string, unknown> = {}
    if (a.pointsPerRound !== undefined) {
      if (!isPoints(a.pointsPerRound, 0)) return { ok: false, error: `Points par bonne réponse : de 0 à ${MAX_POINTS}.` }
      value.pointsPerRound = a.pointsPerRound
    }
    if (a.votePoints !== undefined) {
      if (!isPoints(a.votePoints, 0)) return { ok: false, error: `Points d’un bon vote : de 0 à ${MAX_POINTS}.` }
      value.votePoints = a.votePoints
    }
    if (Object.keys(value).length === 0) return { ok: false, error: 'Aucun réglage.' }
    return { ok: true, value }
  }
  return { ok: true, value: {} }
}

/** Ligne d'un téléphone : son joueur en individuel, son équipe en mode équipe (même clé que les buzz). */
export function findMyScore(state: ScoresActiveState, unit: string): ScoreEntry | null {
  return state.scores.find((s) => s.unit === unit) ?? null
}

/** Y a-t-il au moins un point (positif ou négatif) dans la partie ? */
export function hasAnyPoints(state: ScoresState | null): boolean {
  return !!state && state.active && state.scores.some((s) => s.points !== 0)
}

export function formatPoints(n: number): string {
  return `${n} pt${Math.abs(n) > 1 ? 's' : ''}`
}

export function formatRank(rank: number, tied = false): string {
  return `${rank}${rank === 1 ? 'er' : 'e'}${tied ? ' ex æquo' : ''}`
}

/** Le rang est-il partagé avec un autre joueur ? */
export function isTied(state: ScoresActiveState, entry: ScoreEntry): boolean {
  return state.scores.filter((s) => s.rank === entry.rank).length > 1
}
