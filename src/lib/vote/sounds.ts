// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaVote : quel effet sonore jouer quand l'étape change (page animateur).
// Fonction pure : on compare l'étape précédente et la nouvelle. Aucun son à
// la première lecture (ouverture de la page, F5). Nouveau scrutin : le second
// tour s'ouvre directement (son d'ouverture), un nouveau vote attend au lobby.

import type { VoteStatus } from './types'
import type { RevealStep } from './results'

export type VoteSoundCue = 'open' | 'close' | 'drumroll' | 'winner'

export interface VoteStepMark {
  eventId: string
  status: VoteStatus
  revealStep: number
  /** Nature de l'étape de révélation affichée (status = revealed). */
  stepKind?: RevealStep['kind']
}

export function voteSoundCue(prev: VoteStepMark | null, next: VoteStepMark): VoteSoundCue | null {
  if (!prev) return null
  if (prev.eventId !== next.eventId) return next.status === 'open' ? 'open' : null
  if (prev.status === 'lobby' && next.status === 'open') return 'open'
  if (prev.status === 'open' && next.status === 'closed') return 'close'
  const advanced = next.status === 'revealed' && (prev.status !== 'revealed' || next.revealStep > prev.revealStep)
  if (!advanced) return null
  switch (next.stepKind) {
    case 'intro':
    case 'place':
    case 'tie':
      return 'drumroll'
    case 'winner':
    case 'full':
      return 'winner'
    default:
      return null
  }
}

/** Tic du compte à rebours : une fois par seconde entière restante, jusqu'à 1. */
export function countdownTickSecond(remainingMs: number | null): number | null {
  if (remainingMs === null || remainingMs <= 0) return null
  return Math.ceil(remainingMs / 1000)
}
