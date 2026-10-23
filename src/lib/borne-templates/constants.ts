// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Templates AnimaBooth (cadres PNG transparents de la borne photo).
// Valeurs partagées entre l'admin, les routes API et la tablette.

/** Préfixe des fichiers dans le bucket `photos` : borne-templates/<user_id>/<uuid>.png */
export const TEMPLATES_PREFIX = 'borne-templates'

export const TEMPLATE_MAX_BYTES = 15 * 1024 * 1024
export const TEMPLATES_PER_USER = 30
export const TEMPLATE_NAME_MAX = 80

/** Côté court / côté long : refus en dessous, avertissement sous la cible 10×15 (1200×1800). */
export const TEMPLATE_MIN_SHORT = 600
export const TEMPLATE_MIN_LONG = 900
export const TEMPLATE_TARGET_SHORT = 1200
export const TEMPLATE_TARGET_LONG = 1800
/** Garde-fou contre les PNG géants (décompression en mémoire côté serveur). */
export const TEMPLATE_MAX_PIXELS = 40_000_000

export const NO_TRANSPARENCY_MESSAGE =
  "Ce fichier n'a pas de zone transparente pour la photo. Utilisez la version PNG transparente du template."

/** Écran d'accueil de la borne. */
export const WELCOME_DEFAULT_MESSAGE = "Touchez l'écran pour prendre une photo"
export const WELCOME_MESSAGE_MAX = 80
/** Retour automatique à l'accueil après ce délai sans activité sur l'écran caméra. */
export const WELCOME_IDLE_MS = 60_000

export type TemplateOrientation = 'portrait' | 'landscape'

export interface PhotoZone {
  x: number
  y: number
  w: number
  h: number
}

/** Cadre servi à la tablette par GET /api/borne/[code]/template. */
export interface BorneFrameTemplate {
  id: string
  url: string
  width: number
  height: number
  zone: PhotoZone
}

export interface BorneFrameConfig {
  enabled: boolean
  guestChoice: boolean
  portrait: BorneFrameTemplate | null
  landscape: BorneFrameTemplate | null
}

export function templatePath(userId: string, id: string): string {
  return `${TEMPLATES_PREFIX}/${userId}/${id}.png`
}
