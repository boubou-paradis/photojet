// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Vérification d'un carton. La vérité, ce sont les numéros SORTIS (au moment
// de la demande) ; les coches du joueur ne servent qu'à signaler des
// anomalies à l'animateur, qui reste le seul juge.
// completeLines suit exactement la règle de bingo_complete_lines (SQL).

import { PHASE_LINES } from './constants'
import { rowsOf } from './cards'
import type { Cells, ClaimCheck, Phase } from './types'

export function completeLines(cells: Cells, drawn: readonly number[]): number {
  const out = new Set(drawn)
  return rowsOf(cells).filter((row) => row.every((n) => out.has(n))).length
}

/** Rang (1 = 1re boule) à partir duquel le carton a `need` lignes complètes, null sinon. */
function completedAt(cells: Cells, drawn: readonly number[], need: number): number | null {
  const rows = rowsOf(cells)
  const rank = new Map(drawn.map((n, i) => [n, i + 1]))
  const doneAt = rows
    .map((row) => (row.every((n) => rank.has(n)) ? Math.max(...row.map((n) => rank.get(n)!)) : Infinity))
    .sort((a, b) => a - b)
  const at = doneAt[need - 1]
  return Number.isFinite(at) ? at : null
}

export function checkClaim(cells: Cells, drawn: readonly number[], phase: Phase, marks: readonly number[] = []): ClaimCheck {
  const out = new Set(drawn)
  const marked = new Set(marks)
  const nums = cells.filter(Boolean)
  const lines = rowsOf(cells).map((row) => {
    const missing = row.filter((n) => !out.has(n))
    return { nums: row, missing, complete: missing.length === 0 }
  })
  const complete = lines.filter((l) => l.complete).length
  const need = PHASE_LINES[phase]
  return {
    valid: complete >= need,
    completeLines: complete,
    lines,
    markedNotDrawn: nums.filter((n) => marked.has(n) && !out.has(n)),
    drawnNotMarked: nums.filter((n) => out.has(n) && !marked.has(n)),
    completedAt: completedAt(cells, drawn, need),
  }
}
