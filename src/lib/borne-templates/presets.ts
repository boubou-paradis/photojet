// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Modèles de templates originaux AnimaJet (créés pour AnimaJet, aucun
// élément tiers), dessinés sur un canvas aux dimensions 10×15 avec le texte
// de l'animateur. Le résultat est un PNG transparent ordinaire, enregistré
// dans la bibliothèque par le même circuit (et les mêmes contrôles) qu'un import.

import type { PhotoZone, TemplateOrientation } from './constants'

export type PresetId = 'or' | 'champetre' | 'anniv' | 'neon'

export interface PresetFonts {
  script: string // Great Vibes
  serif: string // Cormorant Garamond
  display: string // Bebas Neue
  sans: string // Inter
}

export const PRESETS: { id: PresetId; title: string; use: string }[] = [
  { id: 'or', title: 'Élégance dorée', use: 'Mariage, gala' },
  { id: 'champetre', title: 'Champêtre', use: 'Mariage, baptême' },
  { id: 'anniv', title: 'Confettis', use: 'Anniversaire' },
  { id: 'neon', title: 'Néon', use: 'Soirée, nouvel an' },
]

export function presetGeometry(orientation: TemplateOrientation) {
  const land = orientation === 'landscape'
  return {
    land,
    W: land ? 1800 : 1200,
    H: land ? 1200 : 1800,
    zone: (land ? { x: 80, y: 80, w: 1100, h: 1040 } : { x: 100, y: 100, w: 1000, h: 1300 }) as PhotoZone,
    tx: land ? 1490 : 600,
    namesY: land ? 600 : 1580,
    sepY: land ? 650 : 1628,
    dateY: land ? 730 : 1700,
    /** Largeur maximale du texte (sous la photo en vertical, colonne droite en horizontal). */
    textMax: land ? 540 : 1000,
  }
}

type Ctx = CanvasRenderingContext2D

function grow(z: PhotoZone, d: number) {
  return { x: z.x - d, y: z.y - d, w: z.w + 2 * d, h: z.h + 2 * d }
}

function roundRect(ctx: Ctx, r: { x: number; y: number; w: number; h: number }, radius: number) {
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.w, r.h, radius)
}

/** Texte centré, réduit si besoin pour tenir dans `max` px. */
function fitText(ctx: Ctx, text: string, x: number, y: number, family: string, size: number, max: number, opts: { weight?: string; style?: string; spacing?: number } = {}) {
  if (!text) return
  let s = size
  const font = () => `${opts.style ?? ''} ${opts.weight ?? ''} ${s}px ${family}`.trim()
  ctx.font = font()
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${opts.spacing ?? 0}px`
  while (ctx.measureText(text).width > max && s > 20) {
    s -= 4
    ctx.font = font()
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, x, y)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
}

function corners(z: PhotoZone): [number, number, number][] {
  return [
    [z.x, z.y, 0],
    [z.x + z.w, z.y, 90],
    [z.x + z.w, z.y + z.h, 180],
    [z.x, z.y + z.h, 270],
  ]
}

function fan(ctx: Ctx, x: number, y: number, deg: number, r: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((deg * Math.PI) / 180)
  const k = r / 64
  ctx.stroke(new Path2D(`M0 0 L${-64 * k} 0 A${64 * k} ${64 * k} 0 0 1 0 ${-64 * k} Z`))
  ctx.stroke(new Path2D(`M0 0 L${-45 * k} ${-45 * k} M0 0 L${-59 * k} ${-25 * k} M0 0 L${-25 * k} ${-59 * k}`))
  ctx.restore()
}

function separator(ctx: Ctx, tx: number, y: number) {
  ctx.beginPath()
  ctx.moveTo(tx - 170, y)
  ctx.lineTo(tx - 22, y)
  ctx.moveTo(tx + 22, y)
  ctx.lineTo(tx + 170, y)
  ctx.stroke()
}

/** Dessine le modèle et renvoie sa zone photo (laissée transparente). */
export function drawPreset(
  canvas: HTMLCanvasElement,
  id: PresetId,
  orientation: TemplateOrientation,
  names: string,
  date: string,
  fonts: PresetFonts
): PhotoZone {
  const g = presetGeometry(orientation)
  const { W, H, zone: z, tx, namesY, sepY, dateY, textMax } = g
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.clearRect(0, 0, W, H)

  if (id === 'or') {
    ctx.fillStyle = '#141416'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#D4AF37'
    ctx.lineWidth = 5
    const o1 = grow(z, 24)
    ctx.strokeRect(o1.x, o1.y, o1.w, o1.h)
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 1.5
    const o2 = grow(z, 44)
    ctx.strokeRect(o2.x, o2.y, o2.w, o2.h)
    ctx.globalAlpha = 1
    ctx.lineWidth = 3
    for (const [x, y, d] of corners(z)) fan(ctx, x, y, d, 64)
    if (g.land) fan(ctx, tx, 430, 45, 90)
    ctx.fillStyle = '#D4AF37'
    fitText(ctx, names, tx, namesY, fonts.script, g.land ? 104 : 132, textMax)
    ctx.lineWidth = 2
    separator(ctx, tx, sepY)
    ctx.save()
    ctx.translate(tx, sepY)
    ctx.rotate(Math.PI / 4)
    ctx.fillRect(-7, -7, 14, 14)
    ctx.restore()
    ctx.fillStyle = '#E8D9A8'
    fitText(ctx, date, tx, dateY, fonts.serif, g.land ? 40 : 46, textMax, { weight: '500', spacing: 10 })
  }

  if (id === 'champetre') {
    ctx.fillStyle = '#F4EFE4'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#8A9A7B'
    ctx.lineWidth = 3
    roundRect(ctx, grow(z, 24), 6)
    ctx.stroke()
    for (const [x, y, d] of corners(z)) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate((d * Math.PI) / 180)
      ctx.strokeStyle = '#7D8E6E'
      ctx.lineWidth = 4
      ctx.stroke(new Path2D('M-8 -8 C-36 -26 -62 -34 -92 -34 M-8 -8 C-26 -36 -34 -62 -34 -92'))
      const leaves: [number, number, number, number, number, string][] = [
        [-38, -30, 16, 7, -25, '#A9B79A'],
        [-66, -40, 15, 6, -10, '#8A9A7B'],
        [-30, -38, 16, 7, -65, '#8A9A7B'],
        [-40, -66, 15, 6, -80, '#A9B79A'],
      ]
      for (const [cx, cy, rx, ry, rot, c] of leaves) {
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, (rot * Math.PI) / 180, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    ctx.fillStyle = '#3F4A36'
    fitText(ctx, names, tx, namesY, fonts.serif, g.land ? 92 : 120, textMax, { style: 'italic', weight: '500' })
    ctx.strokeStyle = '#8A9A7B'
    ctx.lineWidth = 2
    separator(ctx, tx, sepY)
    ctx.fillStyle = '#8A9A7B'
    ctx.beginPath()
    ctx.arc(tx, sepY, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#5E6E50'
    fitText(ctx, date, tx, dateY, fonts.serif, g.land ? 40 : 46, textMax, { weight: '500', spacing: 8 })
  }

  if (id === 'anniv') {
    ctx.fillStyle = '#FFF7EC'
    ctx.fillRect(0, 0, W, H)
    // Confettis déterministes, hors zone photo et hors texte
    let seed = 7
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
    const colors = ['#F25C54', '#F7B267', '#4ECDC4', '#6C63FF', '#FFD23F']
    let count = 0
    for (let i = 0; i < 140 && count < 70; i++) {
      const cx = rnd() * W, cy = rnd() * H, s = 10 + rnd() * 18
      const inZone = cx > z.x - 30 && cx < z.x + z.w + 30 && cy > z.y - 30 && cy < z.y + z.h + 30
      const inText = g.land ? cx > 1240 && cy > 470 && cy < 770 : cy > 1480 && cy < 1730 && cx > 180 && cx < 1020
      const round = rnd() > 0.5
      const rot = rnd() * Math.PI
      if (inZone || inText) continue
      count++
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rot)
      ctx.fillStyle = colors[i % colors.length]
      ctx.beginPath()
      if (round) ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2)
      else ctx.roundRect(0, 0, s * 0.6, s * 1.8, 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 18
    const o0 = grow(z, 9)
    ctx.strokeRect(o0.x, o0.y, o0.w, o0.h)
    ctx.fillStyle = '#E2483F'
    fitText(ctx, names, tx, namesY, fonts.display, g.land ? 120 : 150, textMax, { spacing: 4 })
    ctx.fillStyle = '#5B52E0'
    fitText(ctx, date, tx, dateY, fonts.sans, g.land ? 34 : 40, textMax, { weight: '700', spacing: 6 })
  }

  if (id === 'neon') {
    ctx.fillStyle = '#0A0A12'
    ctx.fillRect(0, 0, W, H)
    ctx.shadowBlur = 18
    ctx.shadowColor = '#FF3EA5'
    ctx.strokeStyle = '#FF3EA5'
    ctx.lineWidth = 8
    roundRect(ctx, grow(z, 24), 10)
    ctx.stroke()
    ctx.shadowColor = '#3EE7FF'
    ctx.strokeStyle = '#3EE7FF'
    ctx.lineWidth = 4
    roundRect(ctx, grow(z, 44), 16)
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    fitText(ctx, names, tx, namesY, fonts.display, g.land ? 120 : 150, textMax, { spacing: 6 })
    ctx.shadowColor = '#FF6CBF'
    ctx.fillStyle = '#FF6CBF'
    fitText(ctx, date, tx, dateY, fonts.sans, g.land ? 34 : 40, textMax, { weight: '600', spacing: 12 })
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
  }

  // Fenêtre photo transparente, nette (aucun halo ni trait n'y déborde)
  ctx.clearRect(z.x, z.y, z.w, z.h)
  return z
}
