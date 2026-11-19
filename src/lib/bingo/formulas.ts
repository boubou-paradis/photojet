// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo : formules de partie (étapes + nombre de lots par étape).
// Les trois premières sont des modèles ; dès qu'une étape ou un lot change,
// la formule devient « Personnalisée ». La base reçoit seulement les étapes
// et les lots (bingo_runtime.phases / phase_lots).

import type { Phase } from './types'

export type FormulaId = 'classic' | 'plein' | 'suivie' | 'custom'

export const LOTS_MAX = 20

export const FORMULAS: Record<Exclude<FormulaId, 'custom'>, { label: string; help: string; phases: Phase[]; lots: number[] }> = {
  classic: { label: 'Classique', help: 'Quine, puis double quine, puis carton plein : un lot chacune.', phases: ['quine', 'double', 'plein'], lots: [1, 1, 1] },
  plein: { label: 'Carton plein direct', help: 'Une seule étape : le carton plein.', phases: ['plein'], lots: [1] },
  suivie: { label: 'Quine suivie', help: '5 quines d’affilée (un lot chacune), puis double quine et carton plein.', phases: ['quine', 'double', 'plein'], lots: [5, 1, 1] },
}

export const FORMULA_LABELS: Record<FormulaId, string> = {
  classic: FORMULAS.classic.label,
  plein: FORMULAS.plein.label,
  suivie: FORMULAS.suivie.label,
  custom: 'Personnalisée',
}

/** Lots alignés sur les étapes : 1 par défaut, bornés à 1…20. */
export function normalizeLots(phases: readonly Phase[], lots: readonly number[] | null | undefined): number[] {
  return phases.map((_, i) => {
    const n = Math.round(Number(lots?.[i]))
    return Number.isFinite(n) ? Math.min(LOTS_MAX, Math.max(1, n)) : 1
  })
}

/** Formule correspondant à ces étapes et ces lots (sinon « Personnalisée »). */
export function detectFormula(phases: readonly Phase[], lots: readonly number[]): FormulaId {
  const l = normalizeLots(phases, lots)
  for (const id of ['classic', 'plein', 'suivie'] as const) {
    const f = FORMULAS[id]
    if (f.phases.join() === phases.join() && f.lots.join() === l.join()) return id
  }
  return 'custom'
}

/** Nom de la formule pour le grand écran : « CARTON PLEIN », « QUINE SUIVIE »… */
export function formulaTitle(phases: readonly Phase[], lots: readonly number[] | null | undefined): string {
  const l = normalizeLots(phases, lots)
  const id = detectFormula(phases, l)
  if (id === 'plein') return 'CARTON PLEIN'
  if (id !== 'custom') return FORMULAS[id].label.toUpperCase()
  const names: Record<Phase, string> = { quine: 'QUINE', double: 'DOUBLE QUINE', plein: 'CARTON PLEIN' }
  return phases.map((p, i) => `${names[p]}${l[i] > 1 ? ` ×${l[i]}` : ''}`).join(' · ')
}
