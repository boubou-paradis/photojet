// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — envoi des médias des manches préparées (extrait audio, image
// de révélation). Réservé au propriétaire de la session.
// Les fichiers vont directement du navigateur au stockage par une adresse
// d'envoi SIGNÉE (un extrait peut dépasser la limite de 4,5 Mo d'une route
// Vercel) : les règles d'accès du stockage partagé ne sont pas modifiées.
//
// POST { action: 'sign', sessionId, contentType, size }
//   → type et taille annoncés vérifiés ; le serveur IMPOSE le chemin :
//     photos/buzzer-media/<compte>/<session>/<horodatage>-<aléa>.<ext>
//     (nom unique : jamais d'écrasement, donc pas de cache CDN périmé).
// POST { action: 'confirm', sessionId, path, kind }
//   → après l'envoi : taille réelle relue dans le stockage, type RÉEL lu sur
//     les premiers octets. Fichier non conforme : effacé aussitôt.
// Un fichier envoyé mais jamais utilisé est effacé par purge-buzzer.

import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { ACCEPTED_MEDIA, maxBytesFor, sniffMedia } from '@/lib/buzzer/media'
import { BUZZER_MEDIA_BUCKET, BUZZER_MEDIA_FOLDER, PREP_LIMITS, isBuzzerMediaPath, type BuzzerMediaKind } from '@/lib/buzzer/prep'
import { readMediaHead } from '@/lib/buzzer/prep-server'
import { getBuzzerAdmin, requireSessionOwner } from '@/lib/buzzer/server'
import { isUuid } from '@/lib/buzzer/validation'

const tooBig = (kind: BuzzerMediaKind) =>
  kind === 'audio'
    ? `Extrait trop lourd (${PREP_LIMITS.audioMaxBytes / 1024 / 1024} Mo au maximum).`
    : `Image trop lourde (${PREP_LIMITS.imageMaxBytes / 1024 / 1024} Mo au maximum).`

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  const { action, sessionId, contentType, size, path, kind } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session invalide.' }, { status: 400 })
  if (action !== 'sign' && action !== 'confirm') return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })

  const userId = await requireSessionOwner(sessionId)
  if (!userId) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  const storage = getBuzzerAdmin().storage.from(BUZZER_MEDIA_BUCKET)

  if (action === 'sign') {
    const type = typeof contentType === 'string' ? ACCEPTED_MEDIA[contentType.toLowerCase()] : undefined
    if (!type) return NextResponse.json({ error: 'Format non accepté (MP3, M4A, WAV, OGG ou FLAC ; images JPEG, PNG ou WebP).' }, { status: 415 })
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return NextResponse.json({ error: 'Fichier vide.' }, { status: 400 })
    if (size > maxBytesFor(type.kind, PREP_LIMITS)) return NextResponse.json({ error: tooBig(type.kind) }, { status: 413 })

    const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${type.ext}`
    const target = `${BUZZER_MEDIA_FOLDER}/${userId}/${sessionId}/${name}`
    const { data, error } = await storage.createSignedUploadUrl(target)
    if (error || !data) {
      console.error('[AnimaBuzz] adresse d’envoi :', error?.message)
      return NextResponse.json({ error: 'Envoi impossible, réessayez.' }, { status: 500 })
    }
    return NextResponse.json({ path: target, token: data.token, kind: type.kind, contentType: type.contentType })
  }

  // confirm
  if (kind !== 'audio' && kind !== 'image') return NextResponse.json({ error: 'Type de média invalide.' }, { status: 400 })
  if (!isBuzzerMediaPath(path, userId, kind) || path.split('/')[2] !== sessionId) {
    return NextResponse.json({ error: 'Fichier invalide.' }, { status: 400 })
  }
  const reject = async (message: string, status: number) => {
    const { error } = await storage.remove([path])
    if (error) console.error('[AnimaBuzz] effacement d’un média refusé :', error.message)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: info, error: infoError } = await storage.info(path)
  if (infoError || !info) return NextResponse.json({ error: 'Fichier introuvable, renvoyez-le.' }, { status: 404 })
  const realSize = typeof info.size === 'number' ? info.size : Number(info.size)
  if (!Number.isFinite(realSize) || realSize <= 0) return reject('Fichier vide.', 400)
  if (realSize > maxBytesFor(kind, PREP_LIMITS)) return reject(tooBig(kind), 413)

  const head = await readMediaHead(path).catch(() => null)
  if (!head) return NextResponse.json({ error: 'Vérification du fichier impossible, réessayez.' }, { status: 503 })
  const real = sniffMedia(head)
  if (!real || real.kind !== kind) {
    return reject(kind === 'audio' ? 'Ce fichier n’est pas un audio lisible (MP3, M4A, WAV, OGG ou FLAC).' : 'Cette image n’est pas au format JPEG, PNG ou WebP.', 415)
  }
  return NextResponse.json({ ok: true, path, size: realSize })
}
