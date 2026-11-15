// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// Textures dessinées en canvas avec la police locale (Poppins).
// Lettres : mises en cache par caractère. Panneaux dynamiques (pupitres, bandeaux) :
// redessinés seulement quand leur contenu change.

import * as THREE from 'three'
import type { PlateauTheme } from '../themes'

/** Poppins chargée par next/font (nom de famille généré) : lue sur la variable CSS du site. */
let family: string | null = null
export function fontFamily(): string {
  if (family) return family
  const v = typeof document === 'undefined' ? '' : getComputedStyle(document.body).getPropertyValue('--font-poppins').trim()
  family = v || 'Poppins'
  return family
}

const cache = new Map<string, THREE.Texture>()
let maxAniso = 8

export function setAnisotropy(renderer: THREE.WebGLRenderer) {
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function toTexture(c: HTMLCanvasElement, mip = true) {
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = maxAniso
  tex.generateMipmaps = mip
  tex.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
  return tex
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number) {
  let s = size
  ctx.font = `${weight} ${s}px ${fontFamily()}, "Segoe UI", Arial, sans-serif`
  while (ctx.measureText(text).width > maxW && s > 10) {
    s -= 2
    ctx.font = `${weight} ${s}px ${fontFamily()}, "Segoe UI", Arial, sans-serif`
  }
  return s
}

// ------------------------------------------------------------------ lettres
const LW = 256
const LH = 320

/** Face révélée : blanc franc, lettre noire nette, capitales accentuées. */
export function letterTexture(raw: string): THREE.Texture {
  const ch = raw.toLocaleUpperCase('fr-FR')
  const key = `L:${ch}`
  const hit = cache.get(key)
  if (hit) return hit
  const [c, ctx] = canvas(LW, LH)
  const g = ctx.createLinearGradient(0, 0, 0, LH)
  g.addColorStop(0, '#FFFFFF')
  g.addColorStop(1, '#ECECE6')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, LW, LH)
  const isPunct = !/\p{L}|\p{N}/u.test(ch)
  const accented = /[ÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇ]/.test(ch)
  const size = isPunct ? 220 : accented ? 200 : 228
  ctx.fillStyle = '#0A0A0C'
  ctx.font = `800 ${size}px ${fontFamily()}, "Segoe UI", Arial, sans-serif`
  ctx.textAlign = 'center'
  const m = ctx.measureText(ch)
  // Ponctuation posée sur la ligne de base d'une capitale de référence (un point reste en bas).
  const ref = isPunct ? ctx.measureText('H') : m
  const y = LH / 2 + (ref.actualBoundingBoxAscent - ref.actualBoundingBoxDescent) / 2
  const sx = Math.min(1, (LW - 40) / Math.max(1, m.width))
  ctx.save()
  ctx.translate(LW / 2, 0)
  ctx.scale(sx, 1)
  ctx.fillText(ch, 0, y)
  ctx.restore()
  const tex = toTexture(c)
  cache.set(key, tex)
  return tex
}

/** Dos d'une case : teinte du thème, dégradé uni, léger liseré intérieur. Aucun motif répété.
 *  Une texture par thème (mise en cache) ; l'ancienne est libérée par `releaseThemeTextures`. */
export function hiddenTexture(theme: PlateauTheme): THREE.Texture {
  const key = `H:${theme.id}`
  const hit = cache.get(key)
  if (hit) return hit
  const [c, ctx] = canvas(LW, LH)
  const g = ctx.createLinearGradient(0, 0, 0, LH)
  g.addColorStop(0, theme.hidden.top)
  g.addColorStop(0.5, theme.hidden.mid)
  g.addColorStop(1, theme.hidden.bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, LW, LH)
  ctx.strokeStyle = theme.hidden.stroke
  ctx.lineWidth = 3
  ctx.strokeRect(8, 8, LW - 16, LH - 16)
  const tex = toTexture(c)
  cache.set(key, tex)
  return tex
}

/** Libère les textures propres aux thèmes autres que celui en cours. */
export function releaseThemeTextures(keep: string) {
  for (const [k, t] of cache) {
    if ((k.startsWith('H:') || k.startsWith('LED:')) && !k.endsWith(`:${keep}`)) {
      t.dispose()
      cache.delete(k)
    }
  }
}

// ------------------------------------------------------------------ décor
/** Bandeau de texte simple (catégorie, ligne d'état). Non mis en cache : redessiné à la demande. */
/** Abrège un texte (…) pour qu'il tienne dans `maxW` avec la police courante. */
function ellipsis(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t.trimEnd()}…`).width > maxW) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

export function drawBand(target: HTMLCanvasElement, parts: { text: string; color: string }[], opts: { size: number; spacing?: number; weight?: number; wrap?: boolean }) {
  const ctx = target.getContext('2d')!
  ctx.clearRect(0, 0, target.width, target.height)
  const full = parts.map((p) => p.text).join('')
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const spacing = opts.spacing ?? 0
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${spacing}px`
  const weight = opts.weight ?? 700
  const maxW = target.width * 0.92
  // Texte long d'une seule couleur (catégorie) : deux lignes plutôt qu'une police minuscule.
  if (opts.wrap && parts.length === 1 && fitFont(ctx, full, weight, opts.size, maxW) < opts.size * 0.72 && full.includes(' ')) {
    const words = full.split(' ')
    let best = 1
    let bestDiff = Infinity
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length)
      if (d < bestDiff) [best, bestDiff] = [i, d]
    }
    const lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')]
    const lineSize = Math.min(...lines.map((l) => fitFont(ctx, l, weight, Math.floor(target.height * 0.42), maxW)))
    ctx.font = `${weight} ${lineSize}px ${fontFamily()}, "Segoe UI", Arial, sans-serif`
    ctx.fillStyle = parts[0].color
    ctx.textAlign = 'center'
    lines.forEach((l, i) => ctx.fillText(ellipsis(ctx, l, maxW), target.width / 2, target.height / 2 + (i - 0.5) * lineSize * 1.08 + 2))
    return
  }
  const size = fitFont(ctx, full, weight, opts.size, maxW)
  ctx.font = `${opts.weight ?? 700} ${size}px ${fontFamily()}, "Segoe UI", Arial, sans-serif`
  const total = ctx.measureText(full).width
  let x = (target.width - total) / 2
  for (const p of parts) {
    ctx.fillStyle = p.color
    ctx.fillText(p.text, x, target.height / 2 + 2)
    x += ctx.measureText(p.text).width
  }
}

/** Écran d'un pupitre : numéro, nom, ligne de couleur, score, état de jeu. */
export function drawLectern(target: HTMLCanvasElement, t: { index: number; name: string; color: string; score: number; state: 'normal' | 'active' | 'blocked' | 'off'; note?: string }, metalText = '#E6DABD') {
  const ctx = target.getContext('2d')!
  const W = target.width
  const H = target.height
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, t.state === 'active' ? '#1A1D24' : '#121216')
  g.addColorStop(1, '#08080A')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  if (t.state === 'active') {
    ctx.strokeStyle = t.color
    ctx.lineWidth = 14
    ctx.strokeRect(7, 7, W - 14, H - 14)
  }
  const dim = t.state === 'blocked' || t.state === 'off'
  // numéro d'ordre
  ctx.fillStyle = metalText
  ctx.font = `800 56px ${fontFamily()}, Arial, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(String(t.index), 30, 24)
  // nom
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = dim ? '#8C8C86' : '#F7F7F2'
  // Taille plancher : au-delà, le nom est abrégé (…) plutôt que rendu illisible.
  const maxName = Math.round(Math.min(96, H * 0.22))
  const nameSize = fitFont(ctx, t.name, 700, maxName, W - 150)
  let name = t.name
  if (nameSize < maxName * 0.62) {
    ctx.font = `700 ${Math.round(maxName * 0.62)}px ${fontFamily()}, "Segoe UI", Arial, sans-serif`
    name = ellipsis(ctx, name, W - 150)
  }
  ctx.fillText(name, W / 2, H * 0.19)
  // ligne de couleur
  ctx.fillStyle = t.color
  ctx.globalAlpha = dim ? 0.45 : 1
  ctx.shadowColor = t.color
  ctx.shadowBlur = 18
  roundRect(ctx, W * 0.16, H * 0.32, W * 0.68, 9, 4.5)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  // score
  ctx.fillStyle = dim ? '#9A9A94' : '#FFFFFF'
  const label = t.note ?? (t.state === 'blocked' ? 'BLOQUÉE' : t.state === 'active' ? 'À VOUS' : '')
  ctx.font = `800 ${Math.round(Math.min(210, H * (label ? 0.42 : 0.56)))}px ${fontFamily()}, Arial, sans-serif`
  ctx.fillText(String(t.score), W / 2, H * (label ? 0.58 : 0.66))
  // état
  if (label) {
    ctx.font = `800 ${Math.round(H * 0.15)}px ${fontFamily()}, Arial, sans-serif`
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '6px'
    ctx.fillStyle = t.state === 'active' ? t.color : '#C9C9C2'
    ctx.fillText(label, W / 2, H * 0.865)
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'
    if (t.state === 'blocked') drawLock(ctx, W / 2 - ctx.measureText(label).width / 2 - 44, H * 0.865)
  }
}

function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.strokeStyle = '#C9C9C2'
  ctx.fillStyle = '#C9C9C2'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(x, y - 10, 11, Math.PI, 0)
  ctx.stroke()
  ctx.fillRect(x - 16, y - 10, 32, 26)
  ctx.restore()
}

/** Diffuseur LED des panneaux latéraux (teinte du thème), répétable. */
export function ledTexture(theme: PlateauTheme): THREE.Texture {
  const key = `LED:${theme.id}`
  const hit = cache.get(key)
  if (hit) return hit
  // Diffuseur LED : trame fine à faible contraste derrière un dépoli (flou), sans points durs.
  const [c, ctx] = canvas(256, 512)
  const bg = ctx.createLinearGradient(0, 0, 0, 512)
  bg.addColorStop(0, theme.led.dark)
  bg.addColorStop(0.45, theme.led.mid)
  bg.addColorStop(0.55, theme.led.mid)
  bg.addColorStop(1, theme.led.dark)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 256, 512)
  ctx.filter = 'blur(1.6px)'
  const step = 8
  for (let y = 0; y < 512; y += step) {
    for (let x = 0; x < 256; x += step) {
      ctx.fillStyle = theme.led.dot
      ctx.fillRect(x + 2, y + 2, step - 4, step - 4)
    }
  }
  ctx.filter = 'none'
  // joints de modules : fines lignes sombres régulières (structure du mur, sans contraste agressif)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  for (let y = 0; y < 512; y += 128) ctx.fillRect(0, y, 256, 2)
  ctx.fillRect(127, 0, 2, 512)
  const tex = toTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  cache.set(key, tex)
  return tex
}

/** Ombre de contact (dégradé elliptique), posée sous les objets au sol. */
export function contactShadowTexture(): THREE.Texture {
  const hit = cache.get('CS')
  if (hit) return hit
  const [c, ctx] = canvas(256, 128)
  ctx.translate(128, 64)
  ctx.scale(1, 0.5)
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 128)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(-128, -128, 256, 256)
  const tex = toTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  cache.set('CS', tex)
  return tex
}

/** Dégradé radial (halos, têtes de projecteurs). */
export function glowTexture(): THREE.Texture {
  const hit = cache.get('G')
  if (hit) return hit
  const [c, ctx] = canvas(128, 128)
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  cache.set('G', tex)
  return tex
}

/** Faisceau de projecteur (dégradé vertical, bords doux). */
export function beamTexture(): THREE.Texture {
  const hit = cache.get('B')
  if (hit) return hit
  const [c, ctx] = canvas(64, 256)
  const v = ctx.createLinearGradient(0, 0, 0, 256)
  v.addColorStop(0, 'rgba(255,255,255,0.8)')
  v.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, 64, 256)
  ctx.globalCompositeOperation = 'destination-in'
  const h = ctx.createLinearGradient(0, 0, 64, 0)
  h.addColorStop(0, 'rgba(0,0,0,0)')
  h.addColorStop(0.5, 'rgba(0,0,0,1)')
  h.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = h
  ctx.fillRect(0, 0, 64, 256)
  const tex = new THREE.CanvasTexture(c)
  cache.set('B', tex)
  return tex
}

/** Image chargée (logo) sur fond noir laqué, centrée. */
export function imagePanelTexture(img: HTMLImageElement, w: number, h: number, label?: string): THREE.Texture {
  const [c, ctx] = canvas(w, h)
  ctx.clearRect(0, 0, w, h)
  const scale = Math.min((h * 0.62) / img.height, (w * (label ? 0.5 : 0.8)) / img.width)
  const iw = img.width * scale
  const ih = img.height * scale
  ctx.drawImage(img, label ? w * 0.08 : (w - iw) / 2, (h - ih) / 2, iw, ih)
  return toTexture(c)
}

export function disposeTextures() {
  for (const t of cache.values()) t.dispose()
  cache.clear()
}

/** Plaque compte à rebours : pastille de couleur + nom de l'équipe à gauche, secondes en gros à droite. */
export function drawTimer(target: HTMLCanvasElement, label: string, color: string, secs: number) {
  const ctx = target.getContext('2d')!
  const W = target.width
  const H = target.height
  ctx.clearRect(0, 0, W, H)
  const r = H / 2 - 6
  const pill = (x: number, y: number, w: number, h: number, rr: number) => {
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, 'rgba(24,24,28,0.96)')
  g.addColorStop(1, 'rgba(8,8,10,0.96)')
  pill(6, 6, W - 12, H - 12, r)
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = color
  ctx.stroke()
  // zone secondes (droite)
  const numW = 330
  const sepX = W - 6 - numW
  ctx.fillStyle = color
  ctx.globalAlpha = 0.18
  ctx.beginPath()
  ctx.moveTo(sepX, 6)
  ctx.lineTo(W - 6 - r, 6)
  ctx.arcTo(W - 6, 6, W - 6, H / 2, r)
  ctx.arcTo(W - 6, H - 6, W - 6 - r, H - 6, r)
  ctx.lineTo(sepX, H - 6)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `800 150px ${fontFamily()}, "Segoe UI", Arial, sans-serif`
  const n = String(Math.max(0, secs))
  const nw = ctx.measureText(n).width
  ctx.font = `700 64px ${fontFamily()}, "Segoe UI", Arial, sans-serif`
  const sw = ctx.measureText(' s').width
  const cx = sepX + numW / 2 - (nw + sw) / 2
  ctx.textAlign = 'left'
  ctx.font = `800 150px ${fontFamily()}, "Segoe UI", Arial, sans-serif`
  ctx.fillText(n, cx, H / 2 + 8)
  ctx.font = `700 64px ${fontFamily()}, "Segoe UI", Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(' s', cx + nw, H / 2 + 30)
  // pastille + nom (gauche)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(6 + r + 4, H / 2, 26, 0, Math.PI * 2)
  ctx.fill()
  const x0 = 6 + r + 52
  const maxW = sepX - x0 - 30
  const text = label.toLocaleUpperCase('fr-FR')
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '4px'
  const size = fitFont(ctx, text, 800, 96, maxW)
  ctx.font = `800 ${size}px ${fontFamily()}, "Segoe UI", Arial, sans-serif`
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(text, x0, H / 2 + 4)
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'
}
