// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Templates côté admin (navigateur) : aperçu avant envoi, avec les mêmes
// règles que le contrôle serveur (rules.ts) calculées sur un canvas, puis
// envoi. Le serveur refait tout à partir du fichier reçu : l'aperçu ne sert
// qu'à l'affichage.

import { createClient } from '@/lib/supabase'
import type { BorneTemplate } from '@/types/database'
import { NOT_PNG_MESSAGE, evaluateTemplate, tooHeavyMessage, type AnalyzeResult } from './rules'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export async function analyzeTemplateFile(file: File): Promise<AnalyzeResult> {
  const heavy = tooHeavyMessage(file.size)
  if (heavy) return { ok: false, error: heavy }

  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (head.length < 8 || PNG_SIGNATURE.some((b, i) => head[i] !== b)) return { ok: false, error: NOT_PNG_MESSAGE }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  } catch {
    return { ok: false, error: 'Ce fichier PNG est abîmé. Réexportez-le puis réessayez.' }
  }
  const { width, height } = bitmap
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    bitmap.close()
    return { ok: false, error: "Votre navigateur ne permet pas d'analyser ce fichier." }
  }
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const rgba = ctx.getImageData(0, 0, width, height).data
  const alpha = new Uint8Array(width * height)
  for (let i = 0, j = 3; i < alpha.length; i++, j += 4) alpha[i] = rgba[j]
  canvas.width = 0
  canvas.height = 0
  return evaluateTemplate(width, height, true, alpha)
}

/**
 * Envoi d'un template : URL signée (fichier direct vers le Storage, sans la
 * limite de 4,5 Mo de Vercel), puis enregistrement après contrôle serveur.
 */
export async function uploadTemplate(
  file: Blob,
  name: string,
  source: 'import' | 'animajet' = 'import'
): Promise<{ template: BorneTemplate; warnings: string[] }> {
  const auth = await fetch('/api/borne/templates/upload-url', { method: 'POST' })
  const slot = await auth.json()
  if (!auth.ok) throw new Error(slot.error ?? "Envoi impossible pour l'instant, réessayez.")

  const { error: uploadError } = await createClient()
    .storage.from('photos')
    .uploadToSignedUrl(slot.path, slot.token, file, { contentType: 'image/png' })
  if (uploadError) throw new Error("L'envoi du fichier a échoué. Vérifiez la connexion puis réessayez.")

  const res = await fetch('/api/borne/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: slot.id, name, source }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Enregistrement impossible pour l'instant, réessayez.")
  return { template: body.template as BorneTemplate, warnings: (body.warnings as string[]) ?? [] }
}
