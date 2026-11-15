// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Événements du moteur → noms d'effets sonores (« type » ou « type:valeur »),
// comme le serveur du prototype. Les sons sont joués par la régie seulement.

import type { GameEvent } from './engine'
import type { PublicView } from './view'

export function toSoundEvents(events: readonly GameEvent[] | null | undefined): string[] {
  if (!Array.isArray(events)) return []
  return events.map((e) => (e.type === 'letter' ? `letter:${e.hits}` : e.type === 'resolved' ? `resolved:${e.won ? 1 : 0}` : e.type))
}

/** Échéance qui mérite un tic-tac (temps de réponse, dernière chance, tour de lettres), sinon null. */
export function countdownDeadline(view: PublicView | null | undefined): number | null {
  const r = view?.round
  if (!view || !r) return null
  if (view.phase === 'answering') return r.buzz?.deadline ?? null
  if (view.phase === 'final_window') return r.finalWindowEndsAt ?? null
  if (view.phase === 'turn') return r.turn?.deadline ?? null
  return null
}

/** Tic-tac des 5 dernières secondes : 'tick', puis 'tickLast' à la dernière ; null hors fenêtre. */
export function tickFor(deadline: number, serverNow: number): 'tick' | 'tickLast' | null {
  const left = Math.ceil((deadline - serverNow) / 1000)
  if (left < 1 || left > 5) return null
  return left === 1 ? 'tickLast' : 'tick'
}
