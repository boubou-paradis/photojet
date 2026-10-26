// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Logique pure d'AnimaVote (sans base ni navigateur), testée unitairement :
// actions possibles selon l'étape, télécommande, écran du téléphone, ordre
// des états reçus, ordre mélangé des candidats. Les règles d'acceptation
// d'un bulletin vivent dans la base (vote_cast), seule source de vérité.

import type { VoteActiveState, VoteCandidate, VoteMyBallot, VoteState } from './types'

export type VoteGameAction = 'open' | 'close' | 'cancel_close' | 'reveal' | 'reveal_next' | 'second_round' | 'new_vote' | 'edit'

/** Actions proposées à l'animateur. `lastStep` : dernière étape de la révélation (voir revealPlan). */
export function availableActions(state: VoteActiveState, lastStep: number): VoteGameAction[] {
  const event = state.event
  if (!event) return ['new_vote']
  switch (event.status) {
    case 'lobby':
      return ['open', 'edit', 'new_vote']
    case 'open':
      return event.closesAt ? ['cancel_close'] : ['close']
    case 'closed':
      return ['reveal', 'second_round', 'new_vote']
    case 'revealed':
      return event.revealStep < lastStep ? ['reveal_next', 'second_round', 'new_vote'] : ['second_round', 'new_vote']
  }
}

/** Le bouton principal (une seule grande action à la fois). */
export function primaryAction(state: VoteActiveState, lastStep: number): 'open' | 'close' | 'cancel_close' | 'reveal' | 'reveal_next' | null {
  const first = availableActions(state, lastStep)[0]
  return first === 'open' || first === 'close' || first === 'cancel_close' || first === 'reveal' || first === 'reveal_next' ? first : null
}

/**
 * Télécommande : PageDown = action logique suivante (ouvrir, fermer,
 * révéler, étape suivante). PageUp ne fait rien. Fermer le vote demande un
 * second appui (voir REMOTE_CONFIRM_MS) : une fermeture accidentelle est
 * impossible d'un seul geste.
 */
export function remoteAction(state: VoteActiveState, lastStep: number): 'open' | 'close' | 'reveal' | 'reveal_next' | null {
  const action = primaryAction(state, lastStep)
  return action === 'cancel_close' ? null : action
}

export const REMOTE_CONFIRM_MS = 3000

/** Une action de télécommande s'applique-t-elle tout de suite, ou faut-il un second appui ? */
export function remoteNeedsConfirm(action: 'open' | 'close' | 'reveal' | 'reveal_next'): boolean {
  return action === 'close'
}

/**
 * Un état reçu ne remplace l'état affiché que s'il est plus récent. Les
 * changements d'étape augmentent `v` ; à `v` égal (nouveaux bulletins), on
 * garde le plus grand nombre de bulletins du même scrutin.
 */
export function isNewer(next: VoteState, current: VoteState | null): boolean {
  if (!current) return true
  if (!next.active || !current.active) return Date.parse(next.serverNow) >= Date.parse(current.serverNow)
  if (next.v !== current.v) return next.v > current.v
  if (next.event?.id !== current.event?.id) return false
  return next.total >= current.total
}

/** Millisecondes restantes avant la fermeture (heure serveur estimée), ou null sans compte à rebours. */
export function closingRemainingMs(state: VoteActiveState, serverNowMs: number): number | null {
  const at = state.event?.status === 'open' && state.event.closesAt ? Date.parse(state.event.closesAt) : NaN
  if (!Number.isFinite(at)) return null
  return Math.max(0, at - serverNowMs)
}

export type PhoneScreen = 'waiting' | 'choose' | 'voted' | 'closed'

/**
 * Écran du téléphone. `myBallot` : mon bulletin connu (réponse de vote_cast
 * ou de /api/vote/me) ; il ne compte que pour le scrutin affiché, donc un
 * second tour redonne l'écran de choix.
 */
export function phoneScreen(state: VoteState, myBallot: VoteMyBallot | null, serverNowMs: number): PhoneScreen {
  if (!state.active || !state.event) return 'waiting'
  const event = state.event
  if (myBallot && myBallot.eventId === event.id) return 'voted'
  if (event.status === 'lobby') return 'waiting'
  if (event.status === 'open') {
    const remaining = closingRemainingMs(state, serverNowMs)
    return remaining === 0 ? 'closed' : 'choose'
  }
  return 'closed'
}

/** Graine 32 bits stable à partir d'un texte (FNV-1a). */
function seedFrom(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Ordre d'affichage sur un téléphone. Mélangé si l'animateur l'a demandé :
 * le même pour un téléphone et un scrutin donnés (un rechargement ne
 * bouleverse pas la liste), différent d'un téléphone à l'autre. Les numéros
 * et les identités ne changent jamais.
 */
export function displayOrder(candidates: readonly VoteCandidate[], shuffle: boolean, seed: string): VoteCandidate[] {
  const list = [...candidates].sort((a, b) => a.sortOrder - b.sortOrder)
  if (!shuffle) return list
  let s = seedFrom(seed) || 1
  const next = () => {
    // xorshift32
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 0x100000000
  }
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}
