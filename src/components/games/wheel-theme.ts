// © 2025 AnimaJet
// Palette partagée de la Roue de la Destinée (WheelGame + WheelPreview).
// 6 segments façon casino / plateau TV — light = centre du dégradé radial,
// base = corps, dark = bord. Toute modification ici se répercute sur la roue
// plein écran ET la vignette admin.

export interface GemColor {
  light: string
  base: string
  dark: string
}

export const GEMS: GemColor[] = [
  { light: '#ff264d', base: '#c8102e', dark: '#66081a' }, // 1 — Rouge rubis
  { light: '#ff9d2e', base: '#f47b20', dark: '#8f4207' }, // 2 — Orange casino
  { light: '#16c66a', base: '#04994a', dark: '#035229' }, // 3 — Vert émeraude
  { light: '#1ba7ff', base: '#087dcc', dark: '#053f6e' }, // 4 — Bleu électrique
  { light: '#2939c7', base: '#18217a', dark: '#0b1040' }, // 5 — Bleu nuit / indigo
  { light: '#c238ff', base: '#7b18b8', dark: '#420d63' }, // 6 — Violet premium
]

// Gamme or métallique + ivoire (couronne, séparateurs, chiffres, textes)
export const GOLD = {
  g1: '#fff1a8', // reflet clair
  g2: '#f6c453', // or brillant
  g3: '#b77812', // or profond
  g4: '#6f4308', // or sombre (ombres)
  ivory: '#fff7df',
} as const

// Bleu des spots scéniques (plateau TV)
export const BLUE_SPOT = 'rgba(64, 148, 255, 0.55)'
