// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// À Demi-Mot — analyse d'une phrase : cases, normalisation française, mise en lignes.
// Module pur, partagé entre le serveur (autorité), l'écran public, la régie et les tests.

export type CellKind = 'letter' | 'punct' | 'space'

export interface Cell {
  /** Caractère exact à afficher (accents, ligatures et casse conservés). */
  ch: string
  kind: CellKind
}

/** Longueur maximale d'une solution (caractères, espaces compris). */
export const MAX_TEXT_LENGTH = 64
/** Longueur maximale d'un mot (un mot n'est jamais coupé entre deux lignes). */
export const MAX_WORD_LENGTH = 16
/** Colonnes maximales du plateau. */
export const MAX_COLUMNS = 18

const LETTER_RE = /\p{L}/u

/** Nettoie une saisie : forme composée NFC, apostrophe typographique, espaces simples. */
export function cleanText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[‘’ʼ`]/g, '’')
    .replace(/'/g, '’')
    .replace(/[‐‑‒–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export function toCells(text: string): Cell[] {
  return Array.from(cleanText(text)).map((ch) => ({
    ch,
    kind: ch === ' ' ? 'space' : LETTER_RE.test(ch) ? 'letter' : 'punct',
  }))
}

/** Lettres de base couvertes par un caractère (É → E, Ç → C, Œ → O et E). */
export function baseLetters(ch: string): string[] {
  const up = ch.toLocaleUpperCase('fr-FR')
  if (up === 'Œ') return ['O', 'E']
  if (up === 'Æ') return ['A', 'E']
  const base = up.normalize('NFD').replace(/\p{M}/gu, '')
  return base ? [base] : [up]
}

/** Normalise une lettre proposée (« é » → « E ») ; null si ce n'est pas une lettre seule. */
export function normalizeLetter(input: string): string | null {
  const s = input.trim()
  if (Array.from(s).length !== 1 || !LETTER_RE.test(s)) return null
  const bases = baseLetters(s)
  return bases.length === 1 ? bases[0] : null
}

/** Normalise une phrase entière pour comparer une variante (casse, accents, ponctuation). */
export function normalizeForCompare(text: string): string {
  return cleanText(text)
    .toLocaleUpperCase('fr-FR')
    .replace(/Œ/g, 'OE')
    .replace(/Æ/g, 'AE')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

export function letterIndexes(cells: Cell[]): number[] {
  const out: number[] = []
  cells.forEach((c, i) => {
    if (c.kind === 'letter') out.push(i)
  })
  return out
}

export interface TextIssue {
  code: 'empty' | 'too_long' | 'word_too_long' | 'no_letter' | 'bad_char'
  message: string
}

/** Validation éditeur : longueur max documentée, mots non sécables. */
export function validateSolution(raw: string): TextIssue[] {
  const text = cleanText(raw)
  const issues: TextIssue[] = []
  if (!text) return [{ code: 'empty', message: 'La solution est vide.' }]
  const len = Array.from(text).length
  if (len > MAX_TEXT_LENGTH) issues.push({ code: 'too_long', message: `Trop longue : ${len} caractères (maximum ${MAX_TEXT_LENGTH}).` })
  for (const w of text.split(' ')) {
    const wl = Array.from(w).length
    if (wl > MAX_WORD_LENGTH) issues.push({ code: 'word_too_long', message: `Le mot « ${w} » dépasse ${MAX_WORD_LENGTH} caractères.` })
  }
  if (!LETTER_RE.test(text)) issues.push({ code: 'no_letter', message: 'Aucune lettre à deviner.' })
  if (/[^\p{L}\p{N} ,.;:!?’\-«»"()&]/u.test(text)) issues.push({ code: 'bad_char', message: 'Caractère non pris en charge (lettres, chiffres et ponctuation simple uniquement).' })
  return issues
}

export interface BoardLayout {
  /** Chaque ligne : indices des cases (dans toCells) sans les espaces de fin de ligne. */
  lines: number[][]
  cols: number
  rows: number
  /** Taille relative d'une case (largeur) dans une zone de largeur 1. */
  tile: number
}

/**
 * Mots non sécables. Une ponctuation isolée par une espace (« : », « ? », « ! » à la
 * française) reste collée au mot précédent : -1 marque l'espace interne.
 */
export function words(cells: Cell[]): number[][] {
  const raw: number[][] = []
  let cur: number[] = []
  cells.forEach((c, i) => {
    if (c.kind === 'space') {
      if (cur.length) raw.push(cur)
      cur = []
    } else cur.push(i)
  })
  if (cur.length) raw.push(cur)
  const out: number[][] = []
  for (const w of raw) {
    const punctOnly = w.every((i) => cells[i].kind === 'punct')
    if (punctOnly && out.length) out[out.length - 1].push(-1, ...w)
    else out.push([...w])
  }
  return out
}

/** Découpe en lignes de `cols` colonnes maximum sans couper un mot. null si impossible. */
export function wrap(cells: Cell[], cols: number): number[][] | null {
  const lines: number[][] = []
  let line: number[] = []
  let width = 0
  for (const w of words(cells)) {
    if (w.length > cols) return null
    const need = width === 0 ? w.length : width + 1 + w.length
    if (need <= cols) {
      if (width > 0) line.push(-1) // -1 = espace entre deux mots
      line.push(...w)
      width = need
    } else {
      lines.push(line)
      line = [...w]
      width = w.length
    }
  }
  if (line.length) lines.push(line)
  return lines
}

/**
 * Choisit le nombre de colonnes donnant les plus grandes cases dans une zone
 * de rapport largeur/hauteur `aspect`. On ajuste d'abord les lignes, puis la taille.
 */
export function layoutBoard(cells: Cell[], aspect: number, tileAspect = 0.78, maxCols = MAX_COLUMNS): BoardLayout {
  const gap = 0.14 // écart entre cases, en fraction de largeur de case
  let best: BoardLayout | null = null
  const longest = Math.max(1, ...words(cells).map((w) => w.length))
  for (let cols = Math.min(longest, maxCols); cols <= maxCols; cols++) {
    const lines = wrap(cells, cols)
    if (!lines) continue
    const used = Math.max(...lines.map((l) => l.length))
    const rows = lines.length
    const tileW = Math.min(1 / (used * (1 + gap)), (1 / aspect) / (rows * (1 / tileAspect) * (1 + gap * 1.6)))
    if (!best || tileW > best.tile + 1e-9) best = { lines, cols: used, rows, tile: tileW }
  }
  return best ?? { lines: [cells.map((_, i) => i)], cols: cells.length, rows: 1, tile: 1 / Math.max(1, cells.length) }
}
