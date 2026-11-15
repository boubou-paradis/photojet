// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// Couleur du plateau : source de vérité unique des trois habillages de l'écran public.
// Utilisée par la 3D (StudioScene), le secours DOM et les panneaux HTML (variables CSS).
// Les couleurs d'équipe n'en dépendent jamais. Le futur serveur transmettra seulement l'identifiant.

export const THEME_IDS = ['champagne-glacier', 'rubis-champagne', 'amethyste-argent'] as const
export type ThemeId = (typeof THEME_IDS)[number]
export const DEFAULT_THEME: ThemeId = 'champagne-glacier'

export interface PlateauTheme {
  id: ThemeId
  name: string
  /** Trois teintes pour la vignette du sélecteur (fond, case fermée, métal). */
  swatch: [string, string, string]
  /** Métal des profils : poli (portique, filets), satiné (chants des cases, colonnes), profond (retraits). */
  metal: { polished: string; satin: string; deep: string; text: string }
  /** Face fermée des cases (dégradé haut → bas), liseré intérieur, lueur propre. */
  hidden: { top: string; mid: string; bottom: string; stroke: string; emissive: string; emissiveIntensity: number }
  /** Cartouche de catégorie. */
  band: { color: string; emissive: string; emissiveIntensity: number; text: string }
  /** Diffuseurs LED latéraux : fond sombre, fond clair, trame. */
  led: { dark: string; mid: string; dot: string }
  /** Lumière d'accompagnement (projecteur d'ambiance, colonnes lointaines, environnement). */
  accent: string
  /** Couleur d'accent lisible en texte (« Dernière chance », bonus de finale). */
  accentText: string
  /** Jauge par défaut (dernière chance) quand aucune équipe n'a la main. */
  gauge: string
  /** Lumières de contour (contre-jours) et filets lumineux des marches. */
  rim: string
  strip: string
  /** Faisceaux discrets derrière le mur. */
  beam: string
  /** Secours DOM / panneaux : fond radial et lueur. */
  dom: { bg: string; glow: string }
}

export const THEMES: Record<ThemeId, PlateauTheme> = {
  'champagne-glacier': {
    id: 'champagne-glacier',
    name: 'Champagne et bleu glacier',
    swatch: ['#16181D', '#2B2F36', '#DCCFAE'],
    metal: { polished: '#DCCFAE', satin: '#B7AA88', deep: '#77705E', text: '#E6DABD' },
    hidden: { top: '#2E323A', mid: '#252830', bottom: '#1B1D23', stroke: 'rgba(196,222,248,0.12)', emissive: '#1C2633', emissiveIntensity: 0.22 },
    band: { color: '#15171C', emissive: '#1D2A3A', emissiveIntensity: 0.3, text: '#FFFFFF' },
    led: { dark: '#06090D', mid: '#1A2938', dot: 'rgba(205,228,255,0.17)' },
    accent: '#A9D2F5',
    accentText: '#BFE0FF',
    gauge: '#BFE0FF',
    rim: '#EEF5FF',
    strip: '#E8F1FB',
    beam: '#E8F2FF',
    dom: { bg: '#141a22', glow: 'rgba(169,210,245,0.22)' },
  },
  'rubis-champagne': {
    id: 'rubis-champagne',
    name: 'Rubis et champagne',
    swatch: ['#0E0A0B', '#8E1430', '#D8C8A6'],
    metal: { polished: '#D8C8A6', satin: '#B09F80', deep: '#6E6352', text: '#E6D8BA' },
    hidden: { top: '#95173A', mid: '#7C1230', bottom: '#5C0B22', stroke: 'rgba(255,178,198,0.14)', emissive: '#5A0A1E', emissiveIntensity: 0.3 },
    band: { color: '#5A0B1F', emissive: '#8E1430', emissiveIntensity: 0.32, text: '#FFFFFF' },
    led: { dark: '#130409', mid: '#4C0D21', dot: 'rgba(255,130,160,0.18)' },
    accent: '#E2496F',
    accentText: '#FF9DB3',
    gauge: '#FF7896',
    rim: '#FFF3EC',
    strip: '#F6E7D6',
    beam: '#FFE6EC',
    dom: { bg: '#2a0a14', glow: 'rgba(226,73,111,0.22)' },
  },
  'amethyste-argent': {
    id: 'amethyste-argent',
    name: 'Améthyste et argent',
    swatch: ['#131217', '#5E2F92', '#D5D7DD'],
    metal: { polished: '#D5D7DD', satin: '#A9ACB5', deep: '#6B6E78', text: '#E4E6EC' },
    hidden: { top: '#63339A', mid: '#512981', bottom: '#3C1D60', stroke: 'rgba(222,200,255,0.14)', emissive: '#3A1A60', emissiveIntensity: 0.3 },
    band: { color: '#3D1E66', emissive: '#6A3BA8', emissiveIntensity: 0.32, text: '#FFFFFF' },
    led: { dark: '#0B0614', mid: '#341A56', dot: 'rgba(205,175,255,0.17)' },
    accent: '#A983EE',
    accentText: '#CDB4FF',
    gauge: '#C6A8FF',
    rim: '#F2EEFF',
    strip: '#ECEAF4',
    beam: '#EFE6FF',
    dom: { bg: '#1c1229', glow: 'rgba(169,131,238,0.22)' },
  },
}

/** Identifiant connu ou repli (ancien thème vert, valeur invalide, absente) vers le thème par défaut. */
export function resolveTheme(id: unknown): ThemeId {
  return typeof id === 'string' && (THEME_IDS as readonly string[]).includes(id) ? (id as ThemeId) : DEFAULT_THEME
}

export const themeOf = (id: unknown): PlateauTheme => THEMES[resolveTheme(id)]

/** Variables CSS du thème, posées sur l'écran public, le secours DOM et l'aperçu de la régie. */
export function themeCssVars(id: unknown): Record<string, string> {
  const t = themeOf(id)
  return {
    '--plate-metal': t.metal.polished,
    '--plate-metal-2': t.metal.satin,
    '--plate-metal-deep': t.metal.deep,
    '--plate-metal-text': t.metal.text,
    '--plate-hidden-1': t.hidden.top,
    '--plate-hidden-2': t.hidden.bottom,
    '--plate-hidden-stroke': t.hidden.stroke,
    '--plate-band-1': t.band.emissive,
    '--plate-band-2': t.band.color,
    '--plate-accent': t.accent,
    '--plate-accent-text': t.accentText,
    '--plate-bg': t.dom.bg,
    '--plate-glow': t.dom.glow,
    '--gold': t.metal.polished,
  }
}
