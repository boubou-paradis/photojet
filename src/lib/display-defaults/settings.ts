// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Réglages d'affichage par défaut du compte (table account_display_defaults).
// Module pur, sans dépendance serveur : partagé par la route API, les tests
// et l'affichage du résumé dans Paramètres.
//
// Liste FERMÉE : tout ce qui n'est pas ici n'est jamais copié (nom, code,
// modération, impression, état actif, contenu des jeux, mot de passe album,
// code de verrouillage de la borne, mode du diaporama).

export const DISPLAY_DEFAULT_KEYS = [
  // Fond d'écran
  'background_type', 'background_color', 'background_image', 'background_opacity',
  // Logo
  'show_logo', 'custom_logo', 'logo_size', 'logo_position',
  // QR code (pas de position : le réglage n'existe pas)
  'show_qr_on_screen', 'qr_size',
  // Diaporama
  'transition_type', 'transition_duration',
  // Messages à l'écran
  'messages_enabled', 'messages_frequency', 'messages_duration',
  // Affiches promotionnelles (promo_affiches = JSON de chemins, comme en session)
  'promo_enabled', 'promo_frequency', 'promo_affiches',
  // Borne : textes affichés
  'borne_welcome_enabled', 'borne_welcome_message', 'borne_show_event_name',
  // Cadres AnimaBooth (identifiants de la bibliothèque borne_templates)
  'borne_template_enabled', 'borne_template_portrait_id', 'borne_template_landscape_id', 'borne_template_guest_choice',
] as const

export type DisplayDefaultKey = (typeof DISPLAY_DEFAULT_KEYS)[number]
export type DisplaySettings = Partial<Record<DisplayDefaultKey, unknown>>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_COLOR_RE = /^#[0-9a-f]{3,8}$/i

const oneOf = (values: readonly string[]) => (v: unknown) => typeof v === 'string' && values.includes(v)
const bool = (v: unknown) => typeof v === 'boolean'
const intIn = (min: number, max: number) => (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const nullableString = (max: number) => (v: unknown) => v === null || (typeof v === 'string' && v.length <= max)
const nullableUuid = (v: unknown) => v === null || (typeof v === 'string' && UUID_RE.test(v))

// Validation de chaque valeur. Les chemins de fichiers sont vérifiés à part
// (préfixes stricts selon le propriétaire, cf. isOwnDefaultsPath).
const VALIDATORS: Record<DisplayDefaultKey, (v: unknown) => boolean> = {
  background_type: oneOf(['color', 'image']),
  background_color: (v) => typeof v === 'string' && HEX_COLOR_RE.test(v),
  background_image: nullableString(500),
  background_opacity: intIn(0, 100),
  show_logo: bool,
  custom_logo: nullableString(500),
  logo_size: oneOf(['small', 'medium', 'large']),
  logo_position: oneOf(['center', 'bottom-left', 'top-left']),
  show_qr_on_screen: bool,
  qr_size: oneOf(['small', 'medium', 'large']),
  transition_type: oneOf(['fade', 'slide', 'zoom']),
  transition_duration: intIn(1, 120),
  messages_enabled: bool,
  messages_frequency: intIn(1, 1000),
  messages_duration: intIn(1, 600),
  promo_enabled: bool,
  promo_frequency: intIn(1, 1000),
  promo_affiches: (v) => v === null || typeof v === 'string',
  borne_welcome_enabled: bool,
  borne_welcome_message: nullableString(500),
  borne_show_event_name: bool,
  borne_template_enabled: bool,
  borne_template_portrait_id: nullableUuid,
  borne_template_landscape_id: nullableUuid,
  borne_template_guest_choice: bool,
}

/** Garde uniquement les clés autorisées dont la valeur est valide. */
export function pickDisplaySettings(source: Record<string, unknown> | null | undefined): DisplaySettings {
  const out: DisplaySettings = {}
  if (!source || typeof source !== 'object') return out
  for (const key of DISPLAY_DEFAULT_KEYS) {
    if (!(key in source)) continue
    const value = source[key]
    if (value === undefined) continue
    if (VALIDATORS[key](value)) out[key] = value
  }
  return out
}

/** Liste ordonnée des chemins d'affiches (colonne JSON), entrées invalides ignorées. */
export function parsePromoPaths(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((p): p is string => typeof p === 'string' && p.length > 0) : []
  } catch {
    return []
  }
}

/** Tous les fichiers Storage (bucket photos) référencés par des réglages. */
export function filePathsOf(settings: DisplaySettings | Record<string, unknown> | null | undefined): string[] {
  if (!settings) return []
  const s = settings as Record<string, unknown>
  const out: string[] = []
  if (typeof s.background_image === 'string' && s.background_image) out.push(s.background_image)
  if (typeof s.custom_logo === 'string' && s.custom_logo) out.push(s.custom_logo)
  out.push(...parsePromoPaths(s.promo_affiches))
  return Array.from(new Set(out))
}

// --- Chemins des copies ---------------------------------------------------
// Les fichiers ne sont JAMAIS partagés entre une session et les réglages par
// défaut : chacun a sa propre copie. Le code existant de Paramètres efface
// l'ancien fond/logo sans vérifier les autres sessions ; avec des copies, il
// reste juste sans modification.

export type FileKind = 'background' | 'logo' | 'promo'

function extensionOf(path: string): string {
  const m = path.match(/\.([a-z0-9]{1,5})$/i)
  return m ? m[1].toLowerCase() : 'jpg'
}

function stamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Chemin d'une copie appartenant aux réglages par défaut d'un compte. */
export function defaultsCopyPath(kind: FileKind, userId: string, source: string): string {
  const ext = extensionOf(source)
  if (kind === 'background') return `backgrounds/defaults-${userId}-${stamp()}.${ext}`
  if (kind === 'logo') return `logos/defaults-${userId}-${stamp()}.${ext}`
  return `promos/defaults-${userId}/${stamp()}.${ext}`
}

/** Chemin d'une copie appartenant à une session (mêmes formes que Paramètres). */
export function sessionCopyPath(kind: FileKind, sessionId: string, source: string): string {
  const ext = extensionOf(source)
  if (kind === 'background') return `backgrounds/${sessionId}-${stamp()}.${ext}`
  if (kind === 'logo') return `logos/${sessionId}-${stamp()}.${ext}`
  return `promos/${sessionId}/${stamp()}.${ext}`
}

/** Vrai si le chemin est une copie des réglages par défaut DE CE compte. */
export function isOwnDefaultsPath(kind: FileKind, userId: string, path: unknown): path is string {
  if (typeof path !== 'string' || path.includes('..')) return false
  if (kind === 'background') return path.startsWith(`backgrounds/defaults-${userId}-`)
  if (kind === 'logo') return path.startsWith(`logos/defaults-${userId}-`)
  return path.startsWith(`promos/defaults-${userId}/`)
}

// --- Résumé lisible -------------------------------------------------------

const SIZE_LABEL: Record<string, string> = { small: 'petit', medium: 'moyen', large: 'grand' }
const POSITION_LABEL: Record<string, string> = { center: 'centre', 'bottom-left': 'bas gauche', 'top-left': 'haut gauche' }
const TRANSITION_LABEL: Record<string, string> = { fade: 'Fondu', slide: 'Glissement', zoom: 'Zoom' }

/** Courte description affichée dans Paramètres (« Fond image · Logo perso … »). */
export function describeDisplaySettings(settings: DisplaySettings | null | undefined): string[] {
  if (!settings) return []
  const s = settings as Record<string, unknown>
  const parts: string[] = []
  parts.push(s.background_type === 'image' && s.background_image ? 'Fond image' : 'Fond couleur')
  if (s.show_logo === false) parts.push('Logo masqué')
  else parts.push(`${s.custom_logo ? 'Logo perso' : 'Logo AnimaJet'} (${SIZE_LABEL[String(s.logo_size)] ?? 'moyen'}, ${POSITION_LABEL[String(s.logo_position)] ?? 'centre'})`)
  parts.push(s.show_qr_on_screen === false ? 'QR masqué' : `QR ${SIZE_LABEL[String(s.qr_size)] ?? 'moyen'}`)
  parts.push(`${TRANSITION_LABEL[String(s.transition_type)] ?? 'Fondu'} ${Number(s.transition_duration) || 5} s`)
  parts.push(s.messages_enabled === false ? 'Messages désactivés' : `Messages toutes les ${Number(s.messages_frequency) || 4} photos`)
  const promos = parsePromoPaths(s.promo_affiches).length
  if (promos > 0) parts.push(`${promos} affiche${promos > 1 ? 's' : ''}${s.promo_enabled ? '' : ' (désactivées)'}`)
  if (s.borne_welcome_enabled) parts.push('Accueil borne')
  if (s.borne_template_enabled && (s.borne_template_portrait_id || s.borne_template_landscape_id)) parts.push('Cadre borne')
  return parts
}
