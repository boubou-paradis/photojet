// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo — calculs d'affichage du téléphone (purs, sans réseau).

import type { BingoPublicState, Cells } from './types'

/** Les 3 lignes du carton (9 cases chacune, 0 = case vide). */
export const rowsOf = (cells: Cells): number[][] => [cells.slice(0, 9), cells.slice(9, 18), cells.slice(18, 27)]

/** Nombre de jetons posés sur chaque ligne (0 à 5). */
export function rowProgress(cells: Cells, marks: readonly number[]): number[] {
  const m = new Set(marks)
  return rowsOf(cells).map((row) => row.filter((n) => n && m.has(n)).length)
}

/** Meilleure ligne (pour les onglets des cartons). */
export const bestRow = (cells: Cells, marks: readonly number[]): number => Math.max(0, ...rowProgress(cells, marks))

/** Lignes entièrement couvertes de jetons (numéros 1 à 3). */
export function fullRows(cells: Cells, marks: readonly number[]): number[] {
  return rowProgress(cells, marks).flatMap((k, i) => (k === 5 ? [i + 1] : []))
}

/** Jetons posés sur un numéro pas encore sorti (signalés en ambre après un refus). */
export function wrongMarks(marks: readonly number[], drawn: readonly number[]): number[] {
  const d = new Set(drawn)
  return marks.filter((n) => !d.has(n))
}

/** Lignes demandées par la phase en cours. */
export const linesNeeded = (phase: 'quine' | 'double' | 'plein'): number => (phase === 'quine' ? 1 : phase === 'double' ? 2 : 3)

/**
 * Dernier numéro visible sur le téléphone : jamais avant qu'il apparaisse sur
 * le grand écran (revealAt), et seulement si la régie l'autorise (showLast).
 */
export function visibleLast(s: BingoPublicState | null, serverNow: number): number | null {
  if (!s?.active || s.display.showLast === false || !s.last) return null
  const reveal = s.revealAt ? Date.parse(s.revealAt) : 0
  if (serverNow >= reveal) return s.last
  return s.drawn.length >= 2 ? s.drawn[s.drawn.length - 2] : null
}
