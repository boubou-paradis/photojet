// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Tablette AnimaBooth : placement du cadre à l'écran et composition de la
// photo finale. Le recadrage de la photo (centré, mode « remplir ») est le
// même que celui de la vidéo dans la zone (object-cover) : ce que l'invité
// voit est ce qu'il obtient.

import type { PhotoZone } from './constants'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Place réservée aux boutons : bandeau bas en vertical, colonne droite en horizontal. */
const BOTTOM_RESERVED = 300
const RIGHT_RESERVED = 216
const MARGIN = 16

/** Rectangle du template à l'écran (le plus grand possible hors zone des boutons). */
export function fitStage(viewW: number, viewH: number, landscape: boolean, tplW: number, tplH: number): Rect {
  const area: Rect = landscape
    ? { x: MARGIN, y: MARGIN, w: viewW - RIGHT_RESERVED - MARGIN, h: viewH - 2 * MARGIN }
    : { x: MARGIN, y: MARGIN, w: viewW - 2 * MARGIN, h: viewH - BOTTOM_RESERVED - MARGIN }
  const scale = Math.max(0, Math.min(area.w / tplW, area.h / tplH))
  const w = tplW * scale
  const h = tplH * scale
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h }
}

/** Zone photo du template, en pixels écran, à partir du rectangle du template. */
export function zoneOnScreen(stage: Rect, tplW: number, zone: PhotoZone): Rect {
  const s = stage.w / tplW
  return { x: stage.x + zone.x * s, y: stage.y + zone.y * s, w: zone.w * s, h: zone.h * s }
}

/** Portion centrée de la source qui remplit la cible sans déformation (équivalent d'object-cover). */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  const dstRatio = dstW / dstH
  if (srcW / srcH > dstRatio) {
    const w = srcH * dstRatio
    return { x: (srcW - w) / 2, y: 0, w, h: srcH }
  }
  const h = srcW / dstRatio
  return { x: 0, y: (srcH - h) / 2, w: srcW, h }
}

/**
 * Photo finale aux dimensions du template : image caméra recadrée dans la
 * zone (miroir pour la caméra avant, la photo seulement), puis le cadre.
 */
export function composeFramedPhoto(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  frame: HTMLImageElement,
  tplW: number,
  tplH: number,
  zone: PhotoZone,
  mirror: boolean
): void {
  canvas.width = tplW
  canvas.height = tplH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, tplW, tplH)
  const crop = coverCrop(video.videoWidth, video.videoHeight, zone.w, zone.h)
  ctx.save()
  if (mirror) {
    ctx.translate(zone.x + zone.w, zone.y)
    ctx.scale(-1, 1)
    ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, zone.w, zone.h)
  } else {
    ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, zone.x, zone.y, zone.w, zone.h)
  }
  ctx.restore()
  ctx.drawImage(frame, 0, 0, tplW, tplH)
}
