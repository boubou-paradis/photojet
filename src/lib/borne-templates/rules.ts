// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Règles d'acceptation d'un template, partagées par l'aperçu de l'admin
// (navigateur, canvas) et le contrôle serveur (lecture du PNG) : les deux
// affichent exactement les mêmes refus et avertissements.

import {
  NO_TRANSPARENCY_MESSAGE,
  TEMPLATE_MAX_BYTES,
  TEMPLATE_MIN_LONG,
  TEMPLATE_MIN_SHORT,
  TEMPLATE_TARGET_LONG,
  TEMPLATE_TARGET_SHORT,
  type PhotoZone,
  type TemplateOrientation,
} from './constants'
import { detectPhotoZone } from './detect-zone'

export const NOT_PNG_MESSAGE =
  'Seuls les fichiers PNG sont acceptés (pas de JPEG, PSD ni format DSLR Booth / LumaBooth). Exportez la version PNG.'

export function tooHeavyMessage(bytes: number): string | null {
  return bytes > TEMPLATE_MAX_BYTES ? `Fichier trop lourd (${Math.round(bytes / 1024 / 1024)} Mo). Maximum : 15 Mo.` : null
}

export interface TemplateAnalysis {
  width: number
  height: number
  orientation: TemplateOrientation
  zone: PhotoZone
  /** Part de l'image occupée par la zone (0–1). */
  coverage: number
  warnings: string[]
}

export type AnalyzeResult = { ok: true; value: TemplateAnalysis } | { ok: false; error: string }

/** Dimensions + canal alpha déjà extraits (PNG décodé côté serveur, ou canvas côté navigateur). */
export function evaluateTemplate(width: number, height: number, hasAlpha: boolean, alpha: Uint8Array): AnalyzeResult {
  const short = Math.min(width, height)
  const long = Math.max(width, height)
  if (short < TEMPLATE_MIN_SHORT || long < TEMPLATE_MIN_LONG) {
    return { ok: false, error: `Image trop petite (${width} × ${height} px). Minimum : 600 × 900 px, conseillé : 1200 × 1800 px.` }
  }
  if (!hasAlpha) return { ok: false, error: NO_TRANSPARENCY_MESSAGE }

  const zone = detectPhotoZone(alpha, width, height)
  if (!zone.ok) {
    return {
      ok: false,
      error: zone.reason === 'no_transparency'
        ? NO_TRANSPARENCY_MESSAGE
        : 'La zone transparente est trop petite pour une photo (moins de 5 % du template).',
    }
  }

  const warnings: string[] = []
  if (short < TEMPLATE_TARGET_SHORT || long < TEMPLATE_TARGET_LONG) {
    warnings.push(`${width} × ${height} px : l'impression risque d'être floue. Conseillé : 1200 × 1800 px.`)
  }
  if (zone.otherZones > 0) {
    warnings.push(`${zone.otherZones + 1} zones transparentes trouvées : la plus grande est utilisée pour la photo.`)
  }
  if (Math.abs(long / short - 1.5) > 0.02) {
    warnings.push("Ce template n'est pas au format 10×15 : il sera imprimé avec des marges.")
  }

  return {
    ok: true,
    value: {
      width,
      height,
      orientation: height >= width ? 'portrait' : 'landscape',
      zone: zone.zone,
      coverage: zone.coverage,
      warnings,
    },
  }
}
