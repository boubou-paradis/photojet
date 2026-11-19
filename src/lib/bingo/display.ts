// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Affichage commun (régie, grand écran, téléphone) : couleurs des boules par
// dizaine (familles « pierres précieuses » de la maquette validée), nombres en
// lettres, libellés. Aucune dépendance : utilisable partout.

import { colOf } from './cards'
import { PHASE_LABELS } from './constants'
import type { BingoPublicState, ClaimCheck, Phase } from './types'

export interface Family { name: string; c: string; d: string }

export const FAMILIES: readonly Family[] = [
  { name: 'Rubis', c: '#d42a52', d: '#6e0f26' },
  { name: 'Cuivre', c: '#e0682a', d: '#7a2c0c' },
  { name: 'Ambre', c: '#e9a91c', d: '#7d5206' },
  { name: 'Jade', c: '#1fa67f', d: '#09503b' },
  { name: 'Lagon', c: '#169bb8', d: '#08465a' },
  { name: 'Saphir', c: '#3466e0', d: '#13286f' },
  { name: 'Indigo', c: '#6648dc', d: '#271777' },
  { name: 'Améthyste', c: '#9d3fd3', d: '#45136a' },
  { name: 'Prune', c: '#c2347f', d: '#5a0e37' },
]

export const familyOf = (n: number): Family => FAMILIES[colOf(n)]

/** Variables CSS d'une boule ou d'une case : --c (couleur), --d (ombre). */
export const ballVars = (n: number): Record<string, string> => {
  const f = familyOf(n)
  return { '--c': f.c, '--d': f.d }
}

const UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize']
const TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']

/** 1 à 90 en lettres (orthographe traditionnelle) : 71 → « soixante-et-onze ». */
export function inWords(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) return String(n)
  if (n <= 16) return UNITS[n]
  if (n < 20) return 'dix-' + UNITS[n - 10]
  const t = Math.floor(n / 10)
  const u = n % 10
  if (t === 7 || t === 9) return TENS[t] + (t === 7 && u === 1 ? '-et-' : '-') + inWords(10 + u)
  if (u === 0) return t === 8 ? 'quatre-vingts' : TENS[t]
  return TENS[t] + (u === 1 && t !== 8 ? '-et-' : '-') + UNITS[u]
}

export const phaseLabel = (p: Phase | undefined | null): string => (p ? PHASE_LABELS[p] : '')

/** Phase en cours (null si toutes jouées). */
export function currentPhase(s: BingoPublicState | null | undefined): Phase | null {
  if (!s?.active || s.phaseIndex >= s.phases.length) return null
  return s.phases[s.phaseIndex]
}

/** Libellé du bouton du téléphone : « QUINE ! », « DOUBLE QUINE ! », « CARTON PLEIN ! ». */
/**
 * Lots de l'étape en cours : nombre, déjà gagnés, et lot en jeu (1…n).
 * Pendant la fête, le lot affiché est celui qui vient d'être gagné.
 */
export function lotInfo(s: BingoPublicState | null | undefined): { n: number; used: number; now: number; done: boolean } {
  if (!s?.active || s.phaseIndex >= s.phases.length) return { n: 1, used: 0, now: 1, done: false }
  const n = s.lots?.[s.phaseIndex] ?? 1
  const used = s.lotsUsed ?? 0
  const done = s.phaseDone ?? false
  const now = Math.max(1, Math.min(n, s.status === 'celebrating' ? used : used + 1))
  return { n, used, now, done }
}

/** Étape suivante (null = c'était la dernière). */
export function nextPhase(s: BingoPublicState | null | undefined): Phase | null {
  if (!s?.active) return null
  return s.phaseIndex + 1 < s.phases.length ? s.phases[s.phaseIndex + 1] : null
}

export const claimButtonLabel = (p: Phase | null): string => (p ? `${PHASE_LABELS[p].toUpperCase()} !` : '')

/** Verdict lisible d'une demande, pour la régie (l'animateur reste seul juge). */
export function verdictText(check: ClaimCheck, phase: Phase): { tone: 'ok' | 'warn' | 'ko'; text: string } {
  const wrong = check.markedNotDrawn
  const wrongText = wrong.length === 1 ? `le ${wrong[0]} n’est pas sorti` : `les ${wrong.join(', ')} ne sont pas sortis`
  if (check.valid) {
    const lines = check.lines.map((l, i) => (l.complete ? i + 1 : 0)).filter(Boolean)
    const where = phase === 'plein' ? 'carton plein' : `ligne${lines.length > 1 ? 's' : ''} ${lines.join(' et ')}`
    if (wrong.length) return { tone: 'warn', text: `Combinaison compatible (${where}), mais coché à tort : ${wrongText}` }
    return { tone: 'ok', text: `Combinaison compatible · ${where}` }
  }
  const missing = check.lines.map((l) => l.missing.length).sort((a, b) => a - b)[0] ?? 0
  return {
    tone: 'ko',
    text: `Pas encore : ${check.completeLines} ligne${check.completeLines > 1 ? 's' : ''} complète${check.completeLines > 1 ? 's' : ''}` +
      (missing ? `, il manque ${missing} numéro${missing > 1 ? 's' : ''} au mieux` : '') + (wrong.length ? ` · ${wrongText}` : ''),
  }
}
