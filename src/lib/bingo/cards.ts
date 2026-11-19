// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Cartons du loto français : 3 lignes x 9 colonnes, 5 numéros par ligne,
// colonne 1 = 1-9, colonnes 2 à 8 = dizaines, colonne 9 = 80-90, 1 à 3
// numéros par colonne, croissants de haut en bas.
// Fabriqués par SÉRIES DE 6 : les 6 cartons d'une série se partagent les 90
// numéros, chacun une seule fois (un joueur à plusieurs cartons n'a donc
// jamais deux fois le même numéro).

import type { BingoCardDraft, Cells } from './types'

export const COL_RANGES: ReadonlyArray<readonly [number, number]> = [
  [1, 9], [10, 19], [20, 29], [30, 39], [40, 49], [50, 59], [60, 69], [70, 79], [80, 90],
]

export const colOf = (n: number): number => (n >= 80 ? 8 : Math.floor(n / 10))

/** Hasard fort par défaut (Web Crypto : navigateur et Node). */
export function cryptoRandom(): number {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0] / 4294967296
}

function shuffle<T>(a: T[], rand: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Combien de numéros chaque carton prend dans chaque colonne (1 à 3, 15 par carton). */
function columnCounts(rand: () => number): number[][] {
  for (let attempt = 0; attempt < 500; attempt++) {
    const counts = Array.from({ length: 6 }, () => Array<number>(9).fill(1))
    const need = Array<number>(6).fill(6)
    const extras = COL_RANGES.map(([a, b], col) => ({ col, left: b - a + 1 - 6 }))
    shuffle(extras, rand).sort((x, y) => y.left - x.left)
    let ok = true
    for (const { col, left } of extras) {
      for (let k = 0; k < left && ok; k++) {
        const cand = [0, 1, 2, 3, 4, 5].filter((c) => counts[c][col] < 3 && need[c] > 0)
        if (!cand.length) { ok = false; break }
        // tirage pondéré par le besoin restant : variété des cartons
        const total = cand.reduce((s, c) => s + need[c], 0)
        let pick = rand() * total
        let chosen = cand[cand.length - 1]
        for (const c of cand) { pick -= need[c]; if (pick < 0) { chosen = c; break } }
        counts[chosen][col]++
        need[chosen]--
      }
      if (!ok) break
    }
    if (ok && need.every((n) => n === 0)) return counts
  }
  throw new Error('répartition des colonnes impossible')
}

/** Place les numéros d'un carton sur 3 lignes de 5 exactement. */
function rowLayout(counts: number[], rand: () => number): boolean[][] {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const grid = [Array<boolean>(9).fill(false), Array<boolean>(9).fill(false), Array<boolean>(9).fill(false)]
    const rowLeft = [5, 5, 5]
    const order = shuffle([...Array(9).keys()], rand).sort((a, b) => counts[b] - counts[a])
    let ok = true
    for (const col of order) {
      const rows = shuffle([0, 1, 2], rand).sort((a, b) => rowLeft[b] - rowLeft[a]).slice(0, counts[col])
      if (rows.some((row) => rowLeft[row] === 0)) { ok = false; break }
      for (const row of rows) { grid[row][col] = true; rowLeft[row]-- }
    }
    if (ok && rowLeft.every((n) => n === 0)) return grid
  }
  throw new Error('mise en lignes impossible')
}

/** Une série de 6 cartons couvrant les 90 numéros. */
export function makeSeries(rand: () => number = cryptoRandom): Cells[] {
  const counts = columnCounts(rand)
  const pools = COL_RANGES.map(([a, b]) => shuffle(Array.from({ length: b - a + 1 }, (_, i) => a + i), rand))
  return counts.map((c) => {
    const layout = rowLayout(c, rand)
    const cells: Cells = Array<number>(27).fill(0)
    for (let col = 0; col < 9; col++) {
      const nums = pools[col].splice(0, c[col]).sort((x, y) => x - y)
      let k = 0
      for (let row = 0; row < 3; row++) if (layout[row][col]) cells[row * 9 + col] = nums[k++]
    }
    return cells
  })
}

export const signatureOf = (cells: Cells): string => cells.filter(Boolean).sort((a, b) => a - b).join('.')

/**
 * n cartons uniques, par séries de 6 (les cartons consécutifs d'une même
 * série ne partagent aucun numéro). `exclude` : signatures déjà prises.
 */
export function makeCards(n: number, rand: () => number = cryptoRandom, exclude: ReadonlySet<string> = new Set()): BingoCardDraft[] {
  const seen = new Set(exclude)
  const out: BingoCardDraft[] = []
  while (out.length < n) {
    for (const cells of makeSeries(rand)) {
      const signature = signatureOf(cells)
      if (seen.has(signature)) continue
      seen.add(signature)
      out.push({ cells, signature })
      if (out.length === n) break
    }
  }
  return out
}

/** Contrôle des règles du loto français. Liste vide = carton conforme. */
export function checkCard(cells: Cells): string[] {
  const errors: string[] = []
  if (cells.length !== 27) return ['27 cases attendues']
  for (let row = 0; row < 3; row++) {
    const k = cells.slice(row * 9, row * 9 + 9).filter(Boolean).length
    if (k !== 5) errors.push(`ligne ${row + 1} : ${k} numéros`)
  }
  for (let col = 0; col < 9; col++) {
    const nums = [cells[col], cells[9 + col], cells[18 + col]].filter(Boolean)
    if (nums.length < 1 || nums.length > 3) errors.push(`colonne ${col + 1} : ${nums.length} numéros`)
    if (nums.some((n) => n < 1 || n > 90 || colOf(n) !== col)) errors.push(`colonne ${col + 1} : mauvaise dizaine`)
    if (nums.some((n, i) => i > 0 && n <= nums[i - 1])) errors.push(`colonne ${col + 1} : pas croissante`)
  }
  return errors
}

/** Lignes d'un carton (numéros sans les cases vides). */
export const rowsOf = (cells: Cells): number[][] => [0, 1, 2].map((r) => cells.slice(r * 9, r * 9 + 9).filter(Boolean))
