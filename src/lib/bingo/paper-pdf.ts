// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Cartons papier AnimaBingo : 6 cartons par page A4, numérotés (le numéro
// sert à la vérification en régie). Impression économe : fond blanc, encre
// foncée, cases vides grisées. Fabriqué dans le navigateur (pdf-lib).

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Cells } from './types'

export interface PaperCard { serial: number; cells: Cells }

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 28
export const CARDS_PER_PAGE = 6
const SLOT = (A4[1] - MARGIN * 2) / CARDS_PER_PAGE
const HEADER = 20
const CELL_H = 29
const INK = rgb(0.09, 0.07, 0.13)
const MUTED = rgb(0.42, 0.39, 0.5)
const GOLD = rgb(0.72, 0.56, 0.12)
const EMPTY = rgb(0.9, 0.89, 0.92)
const LINE = rgb(0.55, 0.52, 0.62)

/** Texte sans caractères hors WinAnsi (police standard du PDF). */
const safe = (s: string) => s.normalize('NFC').replace(/[^ -~ -ÿ]/g, '').slice(0, 60)

function drawCard(page: PDFPage, card: PaperCard, top: number, bold: PDFFont, regular: PDFFont, title: string) {
  const width = A4[0] - MARGIN * 2
  const cellW = width / 9
  const gridTop = top - HEADER
  page.drawText('AnimaBingo', { x: MARGIN, y: top - 14, size: 12, font: bold, color: GOLD })
  if (title) page.drawText(safe(title), { x: MARGIN + 82, y: top - 14, size: 9.5, font: regular, color: MUTED })
  const label = `N° ${card.serial}`
  page.drawText(label, { x: MARGIN + width - bold.widthOfTextAtSize(label, 13), y: top - 14, size: 13, font: bold, color: INK })
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 9; col++) {
      const n = card.cells[row * 9 + col]
      const x = MARGIN + col * cellW
      const y = gridTop - (row + 1) * CELL_H
      page.drawRectangle({ x, y, width: cellW, height: CELL_H, color: n ? rgb(1, 1, 1) : EMPTY, borderColor: LINE, borderWidth: 0.8 })
      if (n) {
        const t = String(n)
        const size = 17
        page.drawText(t, { x: x + (cellW - bold.widthOfTextAtSize(t, size)) / 2, y: y + (CELL_H - size * 0.72) / 2, size, font: bold, color: INK })
      }
    }
  }
  page.drawRectangle({ x: MARGIN, y: gridTop - 3 * CELL_H, width, height: 3 * CELL_H, borderColor: INK, borderWidth: 1.6 })
}

/** PDF des cartons (dans l'ordre reçu), 6 par page. */
export async function buildPaperPdf(cards: readonly PaperCard[], title = ''): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle('AnimaBingo - cartons papier')
  doc.setCreator('AnimaJet')
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < cards.length; i += CARDS_PER_PAGE) {
    const page = doc.addPage(A4)
    cards.slice(i, i + CARDS_PER_PAGE).forEach((card, k) => {
      const top = A4[1] - MARGIN - k * SLOT
      drawCard(page, card, top, bold, regular, title)
      // pointillés de découpe entre deux cartons
      if (k < CARDS_PER_PAGE - 1) {
        const y = top - SLOT + 8
        page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.5, color: LINE, dashArray: [4, 4] })
      }
    })
  }
  return doc.save()
}

/** Nombre de pages pour n cartons. */
export const pagesFor = (n: number) => Math.ceil(n / CARDS_PER_PAGE)

// ---------------------------------------------------------------- loto musical

/** Loto musical : 4 cartons par page (titres lisibles), 3 lignes de 5 titres. */
export const MUSIC_CARDS_PER_PAGE = 4
const MUSIC_SLOT = (A4[1] - MARGIN * 2) / MUSIC_CARDS_PER_PAGE
const MUSIC_CELL_H = 52

/** Coupe un texte en lignes de largeur maximale (au plus `max` lignes, « … » si tronqué). */
function wrap(text: string, font: PDFFont, size: number, width: number, max: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(next, size) <= width) cur = next
    else {
      if (cur) lines.push(cur)
      cur = w
      while (font.widthOfTextAtSize(cur, size) > width && cur.length > 1) cur = cur.slice(0, -1)
    }
    if (lines.length === max) break
  }
  if (cur && lines.length < max) lines.push(cur)
  if (lines.length === max && words.join(' ') !== lines.join(' ')) {
    let last = lines[max - 1]
    while (font.widthOfTextAtSize(`${last}…`, size) > width && last.length > 1) last = last.slice(0, -1)
    lines[max - 1] = `${last}…`
  }
  return lines
}

function drawMusicCard(page: PDFPage, card: PaperCard, titles: readonly { t: string; a: string }[], top: number, bold: PDFFont, regular: PDFFont, title: string) {
  const width = A4[0] - MARGIN * 2
  const cellW = width / 5
  const gridTop = top - HEADER
  page.drawText('AnimaBingo musical', { x: MARGIN, y: top - 14, size: 12, font: bold, color: GOLD })
  if (title) page.drawText(safe(title), { x: MARGIN + 126, y: top - 14, size: 9.5, font: regular, color: MUTED })
  const label = `N° ${card.serial}`
  page.drawText(label, { x: MARGIN + width - bold.widthOfTextAtSize(label, 13), y: top - 14, size: 13, font: bold, color: INK })
  for (let row = 0; row < 3; row++) {
    const items = card.cells.slice(row * 9, row * 9 + 9).filter(Boolean)
    items.forEach((n, col) => {
      const x = MARGIN + col * cellW
      const y = gridTop - (row + 1) * MUSIC_CELL_H
      page.drawRectangle({ x, y, width: cellW, height: MUSIC_CELL_H, color: rgb(1, 1, 1), borderColor: LINE, borderWidth: 0.8 })
      const t = titles[n - 1] ?? { t: `Titre ${n}`, a: '' }
      const lines = wrap(t.t, bold, 9.5, cellW - 10, 2)
      const artist = t.a ? wrap(t.a, regular, 7.5, cellW - 10, 1) : []
      const blockH = lines.length * 11 + (artist.length ? 10 : 0)
      let ty = y + (MUSIC_CELL_H + blockH) / 2 - 9
      for (const l of lines) {
        page.drawText(l, { x: x + (cellW - bold.widthOfTextAtSize(l, 9.5)) / 2, y: ty, size: 9.5, font: bold, color: INK })
        ty -= 11
      }
      for (const l of artist) page.drawText(l, { x: x + (cellW - regular.widthOfTextAtSize(l, 7.5)) / 2, y: ty + 1, size: 7.5, font: regular, color: MUTED })
    })
  }
  page.drawRectangle({ x: MARGIN, y: gridTop - 3 * MUSIC_CELL_H, width, height: 3 * MUSIC_CELL_H, borderColor: INK, borderWidth: 1.6 })
}

/** PDF des cartons musicaux (titres de la playlist figée), 4 par page. */
export async function buildMusicPaperPdf(cards: readonly PaperCard[], titles: readonly { t: string; a: string }[], title = ''): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle('AnimaBingo musical - cartons papier')
  doc.setCreator('AnimaJet')
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < cards.length; i += MUSIC_CARDS_PER_PAGE) {
    const page = doc.addPage(A4)
    cards.slice(i, i + MUSIC_CARDS_PER_PAGE).forEach((card, k) => {
      const top = A4[1] - MARGIN - k * MUSIC_SLOT
      drawMusicCard(page, card, titles, top, bold, regular, title)
      if (k < MUSIC_CARDS_PER_PAGE - 1) {
        const y = top - MUSIC_SLOT + 10
        page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.5, color: LINE, dashArray: [4, 4] })
      }
    })
  }
  return doc.save()
}
