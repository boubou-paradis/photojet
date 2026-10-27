// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — déroulé des manches préparées : logique pure (sans base ni
// navigateur), testée unitairement. L'état public est celui que renvoie la
// fonction SQL buzzer_prep_public (diffusé sur le canal privé, événement
// « prep ») : la réponse et l'image n'y sont qu'après la révélation, les
// résultats du vote qu'à la clôture. Le bouton principal de l'animateur et
// la télécommande suivent le même enchaînement :
// lancer la manche → (buzz → réponse) → lancer le vote → clôturer → suivante.

import type { BuzzerActiveState } from './types'

export type PrepStep = 'ready' | 'question' | 'reveal' | 'vote_open' | 'vote_closed' | 'end'

export interface PrepPublicVote {
  id: string
  question: string
  choices: string[]
  /** Nombre de votes reçus (sans détail tant que le vote est ouvert). */
  count: number
  /** Votes par choix : à la clôture seulement. */
  results: number[] | null
  /** Bonne réponse du vote (index) : à la clôture seulement, si elle existe. */
  correct: number | null
}

export interface PrepActiveState {
  active: true
  v: number
  step: PrepStep
  /** Index de la manche en cours (0 = la 1re). Égal à `total` à la fin. */
  roundIndex: number
  total: number
  question?: string | null
  revealed?: boolean
  answer?: string | null
  imagePath?: string | null
  hasVote?: boolean
  vote?: PrepPublicVote | null
  serverNow: string
}

export interface PrepInactiveState {
  active: false
  serverNow: string
}

export type PrepState = PrepActiveState | PrepInactiveState

/** Actions de la fonction SQL buzzer_prep_admin. */
export const PREP_ACTIONS = ['start', 'stop', 'round_start', 'right', 'wrong', 'reveal', 'vote_open', 'vote_close', 'next_round'] as const
export type PrepAction = (typeof PREP_ACTIONS)[number]

/** Un état reçu ne remplace l'état affiché que s'il est plus récent. */
export function isNewerPrep(next: PrepState, current: PrepState | null): boolean {
  if (!current) return true
  if (!next.active || !current.active) return Date.parse(next.serverNow) >= Date.parse(current.serverNow)
  return next.v > current.v
}

export interface NextStep {
  /** `open` : action du mode libre (rouvrir après une pause de l'animateur). */
  action: PrepAction | 'open'
  label: string
}

export interface PrepStepOptions {
  /** Manche sans question, extrait, réponse ni image : elle commence par le vote. */
  voteOnly?: boolean
}

/**
 * Action « suivante » de l'enchaînement (bouton principal et PageDown).
 * `null` : rien à faire tout de suite (buzzers ouverts, quelqu'un a la main :
 * l'animateur choisit Bonne ou Mauvaise réponse, ou fin des manches).
 */
export function nextPrepStep(state: BuzzerActiveState, prep: PrepActiveState, options: PrepStepOptions = {}): NextStep | null {
  const last = prep.roundIndex + 1 >= prep.total
  const nextLabel = last ? 'Terminer les manches' : 'Manche suivante'
  switch (prep.step) {
    case 'ready':
      if (options.voteOnly && prep.hasVote) return { action: 'vote_open', label: 'Lancer le vote' }
      return { action: 'round_start', label: `Lancer la manche ${prep.roundIndex + 1}` }
    case 'question':
      if (state.phase === 'waiting') return { action: 'open', label: 'Rouvrir les buzzers' }
      if (state.phase === 'closed') return { action: 'reveal', label: 'Révéler la réponse' }
      return null
    case 'reveal':
      return prep.hasVote ? { action: 'vote_open', label: 'Lancer le vote' } : { action: 'next_round', label: nextLabel }
    case 'vote_open':
      return { action: 'vote_close', label: 'Clôturer le vote' }
    case 'vote_closed':
      return { action: 'next_round', label: nextLabel }
    case 'end':
      return null
  }
}

/**
 * Télécommande en manches préparées (même mapping que le mode libre) :
 * quelqu'un a la main → PageDown = mauvaise réponse, PageUp = bonne réponse ;
 * sinon PageDown = action suivante et PageUp ne fait rien.
 */
export function prepRemoteAction(state: BuzzerActiveState, prep: PrepActiveState, key: 'next' | 'prev', options: PrepStepOptions = {}): PrepAction | 'open' | null {
  if (state.paused) return null
  const hasHand = prep.step === 'question' && state.phase === 'buzzed' && !!state.priority
  if (key === 'prev') return hasHand ? 'right' : null
  if (hasHand) return 'wrong'
  return nextPrepStep(state, prep, options)?.action ?? null
}

/**
 * Pourcentages entiers du vote (méthode du plus fort reste : le total fait
 * toujours 100 dès qu'il y a un vote) et choix mis en avant : la bonne
 * réponse si elle existe, sinon le choix le plus voté (aucun en cas d'égalité).
 */
export function voteBars(results: number[], correct: number | null): { pct: number[]; top: number | null; total: number } {
  const total = results.reduce((a, b) => a + b, 0)
  if (total === 0) return { pct: results.map(() => 0), top: correct, total }
  const raw = results.map((n) => (n * 100) / total)
  const pct = raw.map(Math.floor)
  let rest = 100 - pct.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (rest <= 0) break
    pct[i] += 1
    rest -= 1
  }
  if (correct !== null) return { pct, top: correct, total }
  const max = Math.max(...results)
  const leaders = results.filter((n) => n === max).length
  return { pct, top: leaders === 1 ? results.indexOf(max) : null, total }
}

export const VOTE_LETTERS = ['A', 'B', 'C', 'D'] as const
