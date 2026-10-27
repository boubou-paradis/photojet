// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — envoi d'un média de manche depuis le navigateur de l'animateur.
// 1. compression avec les briques existantes (compressAudio du Quiz,
//    compressImage), importées sans modification ;
// 2. adresse d'envoi signée demandée au serveur (qui impose le chemin) ;
// 3. envoi direct au stockage ;
// 4. confirmation : le serveur relit taille et type réels.

import { compressAudio, needsAudioCompression } from '@/lib/audio-utils'
import { compressImage, getPublicUrl, needsCompression } from '@/lib/image-utils'
import { createClient } from '@/lib/supabase'
import { BUZZER_MEDIA_BUCKET, PREP_LIMITS, type BuzzerMediaKind } from './prep'

export type UploadStage = 'compressing' | 'uploading' | 'checking'

export class MediaUploadError extends Error {}

async function postMedia(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let res: Response
  try {
    res = await fetch('/api/buzzer/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new MediaUploadError('Connexion impossible, réessayez.')
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new MediaUploadError(typeof json.error === 'string' ? json.error : 'Envoi impossible, réessayez.')
  return json
}

// Certains navigateurs laissent le type vide (FLAC, M4A) : déduit de l'extension.
// Le serveur revérifie de toute façon le contenu réel.
const TYPE_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
}
function typeFromName(name: string): string {
  return TYPE_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? ''
}

/** Adresse publique (lecture) d'un média enregistré. */
export function buzzerMediaUrl(path: string): string {
  return getPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, ''), path)
}

/** Envoie un fichier et renvoie son chemin définitif (buzzer-media/…). */
export async function uploadBuzzerMedia(
  sessionId: string,
  original: File,
  kind: BuzzerMediaKind,
  onStage?: (stage: UploadStage) => void,
): Promise<string> {
  // Limite de l'audio vérifiée AVANT compression (règle annoncée à l'animateur).
  if (kind === 'audio' && original.size > PREP_LIMITS.audioMaxBytes) {
    throw new MediaUploadError(`Extrait trop lourd (${PREP_LIMITS.audioMaxBytes / 1024 / 1024} Mo au maximum).`)
  }
  onStage?.('compressing')
  let file = original
  if (kind === 'audio' && needsAudioCompression(original)) file = await compressAudio(original)
  if (kind === 'image' && needsCompression(original)) file = await compressImage(original)
  if (kind === 'image' && file.size > PREP_LIMITS.imageMaxBytes) {
    throw new MediaUploadError(`Image trop lourde (${PREP_LIMITS.imageMaxBytes / 1024 / 1024} Mo au maximum).`)
  }

  onStage?.('uploading')
  const signed = await postMedia({ action: 'sign', sessionId, contentType: file.type || typeFromName(file.name), size: file.size })
  const path = signed.path as string
  const { error } = await createClient()
    .storage.from(BUZZER_MEDIA_BUCKET)
    .uploadToSignedUrl(path, signed.token as string, file, { contentType: signed.contentType as string, cacheControl: '31536000' })
  if (error) throw new MediaUploadError('Envoi interrompu, réessayez.')

  onStage?.('checking')
  await postMedia({ action: 'confirm', sessionId, path, kind })
  return path
}
