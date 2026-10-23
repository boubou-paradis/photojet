// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Contrôle complet d'un fichier template (serveur uniquement) : PNG réel,
// poids, dimensions, transparence, zone photo. Renvoie le message exact à
// afficher à l'animateur en cas de refus.

import { TEMPLATE_MAX_PIXELS } from './constants'
import { decodePngAlpha } from './png'
import { NOT_PNG_MESSAGE, evaluateTemplate, tooHeavyMessage, type AnalyzeResult } from './rules'

export type { AnalyzeResult, TemplateAnalysis } from './rules'

export function analyzeTemplate(buf: Buffer): AnalyzeResult {
  const heavy = tooHeavyMessage(buf.length)
  if (heavy) return { ok: false, error: heavy }
  const decoded = decodePngAlpha(buf, TEMPLATE_MAX_PIXELS)
  if (!decoded.ok) {
    if (decoded.error === 'not_png') return { ok: false, error: NOT_PNG_MESSAGE }
    if (decoded.error === 'unsupported') {
      return { ok: false, error: 'Ce PNG ne peut pas être lu (image trop grande ou PNG entrelacé). Réexportez-le en PNG standard.' }
    }
    return { ok: false, error: 'Ce fichier PNG est abîmé. Réexportez-le puis réessayez.' }
  }
  const { info, alpha } = decoded
  return evaluateTemplate(info.width, info.height, info.hasAlpha, alpha)
}
