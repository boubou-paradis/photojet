// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Détection de la zone photo d'un template : la plus grande région
// transparente d'un seul tenant. Sa boîte englobante devient la zone où la
// photo est dessinée ; le cadre posé par-dessus masque ce qui dépasse
// (fenêtre arrondie, cœur…). Logique pure, sans canvas : utilisée par la
// route serveur et testable seule.

import type { PhotoZone } from './constants'

/** Pixel transparent si alpha < 128. */
const ALPHA_THRESHOLD = 128
/** Analyse un pixel sur STEP dans chaque sens (1200×1800 → 300×450 cases). */
const STEP = 4
/** En dessous de 5 % de l'image, la zone est trop petite pour une photo. */
const MIN_ZONE_RATIO = 0.05
/** Une autre région au-delà de 2 % déclenche l'avertissement « plusieurs zones ». */
const OTHER_ZONE_RATIO = 0.02

export type ZoneResult =
  | { ok: true; zone: PhotoZone; coverage: number; otherZones: number }
  | { ok: false; reason: 'no_transparency' | 'zone_too_small' }

/**
 * @param alpha canal alpha, un octet par pixel, ligne par ligne (width × height).
 */
export function detectPhotoZone(alpha: Uint8Array, width: number, height: number): ZoneResult {
  const cols = Math.ceil(width / STEP)
  const rows = Math.ceil(height / STEP)
  const cells = cols * rows

  // 1 = case transparente (pixel central de la case)
  const grid = new Uint8Array(cells)
  for (let cy = 0; cy < rows; cy++) {
    const y = Math.min(height - 1, cy * STEP + (STEP >> 1))
    for (let cx = 0; cx < cols; cx++) {
      const x = Math.min(width - 1, cx * STEP + (STEP >> 1))
      if (alpha[y * width + x] < ALPHA_THRESHOLD) grid[cy * cols + cx] = 1
    }
  }

  // Composantes connexes (4-voisinage), parcours en largeur sans récursion
  const label = new Int32Array(cells)
  const queue = new Int32Array(cells)
  const sizes: number[] = []
  let best = { size: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 }
  for (let start = 0; start < cells; start++) {
    if (grid[start] === 0 || label[start] !== 0) continue
    const id = sizes.length + 1
    let head = 0
    let tail = 0
    queue[tail++] = start
    label[start] = id
    let minX = cols, minY = rows, maxX = 0, maxY = 0
    while (head < tail) {
      const c = queue[head++]
      const cx = c % cols
      const cy = (c - cx) / cols
      if (cx < minX) minX = cx
      if (cx > maxX) maxX = cx
      if (cy < minY) minY = cy
      if (cy > maxY) maxY = cy
      if (cx > 0 && grid[c - 1] === 1 && label[c - 1] === 0) { label[c - 1] = id; queue[tail++] = c - 1 }
      if (cx < cols - 1 && grid[c + 1] === 1 && label[c + 1] === 0) { label[c + 1] = id; queue[tail++] = c + 1 }
      if (cy > 0 && grid[c - cols] === 1 && label[c - cols] === 0) { label[c - cols] = id; queue[tail++] = c - cols }
      if (cy < rows - 1 && grid[c + cols] === 1 && label[c + cols] === 0) { label[c + cols] = id; queue[tail++] = c + cols }
    }
    sizes.push(tail)
    if (tail > best.size) best = { size: tail, minX, minY, maxX, maxY }
  }

  if (best.size === 0) return { ok: false, reason: 'no_transparency' }
  const coverage = best.size / cells
  if (coverage < MIN_ZONE_RATIO) return { ok: false, reason: 'zone_too_small' }

  // Boîte élargie d'une case de chaque côté : mieux vaut que la photo passe
  // sous le cadre (invisible) que laisser un liseré transparent.
  const x0 = Math.max(0, (best.minX - 1) * STEP)
  const y0 = Math.max(0, (best.minY - 1) * STEP)
  const x1 = Math.min(width, (best.maxX + 2) * STEP)
  const y1 = Math.min(height, (best.maxY + 2) * STEP)

  let otherZones = 0
  let bestSkipped = false
  for (const s of sizes) {
    if (!bestSkipped && s === best.size) { bestSkipped = true; continue }
    if (s / cells >= OTHER_ZONE_RATIO) otherZones++
  }

  return { ok: true, zone: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, coverage, otherZones }
}
