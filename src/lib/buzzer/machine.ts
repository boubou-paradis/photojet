// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Logique pure d'AnimaBuzz (sans base ni navigateur), testée unitairement :
// actions possibles selon la phase, télécommande, écran du téléphone,
// ordre des états reçus. L'ordre des buzz et les règles d'acceptation
// vivent dans la base (fonctions SQL), seule source de vérité.

import type { BuzzerActiveState, BuzzerState, BuzzStatus } from './types'

export type GameAction =
  | 'test_start' | 'test_stop' | 'new_round' | 'open' | 'timeout'
  | 'right' | 'wrong' | 'cancel'

/** Actions de jeu proposées à l'animateur dans l'état courant. */
export function availableActions(state: BuzzerActiveState): GameAction[] {
  switch (state.phase) {
    case 'lobby':
      return ['test_start', 'new_round']
    case 'test':
      return ['test_stop', 'new_round']
    case 'waiting':
      return ['open', 'test_start', 'cancel']
    case 'open':
      return state.deadlineAt ? ['timeout', 'cancel'] : ['cancel']
    case 'buzzed':
      return state.priority ? ['right', 'wrong', 'cancel'] : ['cancel']
    case 'closed':
      return ['new_round', 'test_start']
  }
}

/**
 * Télécommande. PageDown = action logique suivante, PageUp = mauvaise
 * réponse (seulement si quelqu'un a la main). Jamais d'action destructive.
 * `null` = la touche ne fait rien dans cet état.
 */
export function remoteAction(state: BuzzerActiveState, key: 'next' | 'prev'): 'open' | 'right' | 'wrong' | 'new_round' | null {
  if (state.paused) return null
  if (key === 'prev') return state.phase === 'buzzed' && state.priority ? 'wrong' : null
  if (state.phase === 'waiting') return 'open'
  if (state.phase === 'buzzed' && state.priority) return 'right'
  if (state.phase === 'closed') return 'new_round'
  return null
}

/** Un état reçu ne remplace l'état affiché que s'il est plus récent (les diffusions peuvent arriver dans le désordre). */
export function isNewer(next: BuzzerState, current: BuzzerState | null): boolean {
  if (!current) return true
  if (!next.active || !current.active) return Date.parse(next.serverNow) >= Date.parse(current.serverNow)
  return next.v > current.v
}

/** Fin de la fenêtre de buzz (heure serveur, ms), ou null si personne n'a buzzé. */
export function windowEndsAt(state: BuzzerActiveState): number | null {
  if (!state.firstBuzzAt) return null
  return Date.parse(state.firstBuzzAt) + state.windowMs
}

export type PhoneScreen =
  | 'paused' | 'lobby' | 'test' | 'tested' | 'waiting' | 'open'
  | 'first' | 'rank' | 'late' | 'blocked' | 'won' | 'done'

export interface PhoneView {
  screen: PhoneScreen
  rank?: number
  gapMs?: number
  /** Qui a la main (pour « +0,14 s derrière Luna »). */
  leader?: string
}

export interface MyBuzz {
  rank: number
  gapMs: number
  status: BuzzStatus
  attempt: number
}

/**
 * Écran du téléphone à partir de l'état public et de MON buzz dans la
 * manche (réponse de buzzer_buzz ou de /api/buzzer/me). Un rang n'est
 * affiché que s'il vient du serveur. `serverNowMs` : heure serveur estimée.
 */
export function phoneView(
  state: BuzzerActiveState,
  me: { unit: string; tested: boolean; myBuzz: MyBuzz | null },
  serverNowMs: number,
): PhoneView {
  if (state.paused) return { screen: 'paused' }

  const leader = state.priority?.label
  const blockedEarlier = me.myBuzz !== null && (me.myBuzz.status === 'blocked' || me.myBuzz.attempt < state.attempt)

  switch (state.phase) {
    case 'lobby':
      return { screen: 'lobby' }
    case 'test':
      return { screen: me.tested ? 'tested' : 'test' }
    case 'waiting':
      return { screen: 'waiting' }
    case 'open':
      return { screen: blockedEarlier ? 'blocked' : 'open' }
    case 'buzzed': {
      if (state.priority?.unit === me.unit) return { screen: 'first' }
      const entry = state.queue.find((q) => q.unit === me.unit)
      if (entry) {
        if (entry.status === 'blocked') return { screen: 'blocked' }
        return { screen: 'rank', rank: entry.rank, gapMs: entry.gapMs, leader }
      }
      if (me.myBuzz && me.myBuzz.attempt === state.attempt) {
        if (me.myBuzz.status === 'blocked') return { screen: 'blocked' }
        return { screen: 'rank', rank: me.myBuzz.rank, gapMs: me.myBuzz.gapMs, leader }
      }
      if (blockedEarlier) return { screen: 'blocked' }
      const end = windowEndsAt(state)
      return { screen: end !== null && serverNowMs <= end ? 'open' : 'late' }
    }
    case 'closed':
      if (state.outcome === 'won' && state.priority?.unit === me.unit) return { screen: 'won' }
      return { screen: 'done' }
  }
}
