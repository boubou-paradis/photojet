// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo, loto musical : envoi des morceaux de la bibliothèque du compte.
// Même principe qu'AnimaBuzz : le fichier va directement du navigateur au
// stockage par une adresse d'envoi SIGNÉE (un morceau dépasse la limite de
// 4,5 Mo d'une route Vercel) ; les règles d'accès du stockage ne changent pas.
//
// POST { action: 'sign', contentType, size }
//   → type et taille annoncés vérifiés ; le serveur IMPOSE le chemin :
//     photos/bingo-music/<compte>/<horodatage>-<aléa>.<ext>
// POST { action: 'confirm', path }
//   → taille réelle relue dans le stockage, type RÉEL lu sur les premiers
//     octets. Fichier non conforme : effacé aussitôt.
// POST { action: 'discard', path }
//   → morceau envoyé puis abandonné (jamais enregistré dans une playlist) :
//     effacé s'il n'est cité nulle part.
// Un envoi jamais enregistré est aussi effacé par purge-bingo après 24 h.

import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { ACCEPTED_MEDIA, sniffMedia } from '@/lib/buzzer/media'
import { getBingoAdmin } from '@/lib/bingo/server'
import { currentUserId, musicUrl, removeUnused } from '@/lib/bingo/library'
import { MUSIC_AUDIO_MAX_BYTES, MUSIC_BUCKET, MUSIC_FOLDER, isMusicPath } from '@/lib/bingo/music'

const NO_STORE = { 'Cache-Control': 'no-store' }
const TOO_BIG = `Morceau trop lourd (${MUSIC_AUDIO_MAX_BYTES / 1024 / 1024} Mo au maximum).`
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

async function readHead(path: string): Promise<Uint8Array | null> {
  const res = await fetch(musicUrl(path), { headers: { Range: 'bytes=0-31' }, cache: 'no-store' })
  if (!res.ok) return null
  return new Uint8Array(await res.arrayBuffer()).subarray(0, 32)
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Requête invalide.' }, 400)
  }
  const { action, contentType, size, path } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const userId = await currentUserId()
  if (!userId) return json({ error: 'Connectez-vous pour gérer vos playlists.' }, 401)
  const admin = getBingoAdmin()
  const storage = admin.storage.from(MUSIC_BUCKET)

  if (action === 'sign') {
    const type = typeof contentType === 'string' ? ACCEPTED_MEDIA[contentType.toLowerCase()] : undefined
    if (!type || type.kind !== 'audio') return json({ error: 'Format non accepté (MP3, M4A, WAV, OGG ou FLAC).' }, 415)
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return json({ error: 'Fichier vide.' }, 400)
    if (size > MUSIC_AUDIO_MAX_BYTES) return json({ error: TOO_BIG }, 413)
    const target = `${MUSIC_FOLDER}/${userId}/${Date.now()}-${randomBytes(6).toString('hex')}.${type.ext}`
    const { data, error } = await storage.createSignedUploadUrl(target)
    if (error || !data) {
      console.error('[AnimaBingo] adresse d’envoi :', error?.message)
      return json({ error: 'Envoi impossible, réessayez.' }, 500)
    }
    return json({ path: target, token: data.token, contentType: type.contentType })
  }

  if (!isMusicPath(path, userId)) return json({ error: 'Fichier invalide.' }, 400)

  if (action === 'discard') {
    await removeUnused(admin, userId, [path])
    return json({ ok: true })
  }

  if (action !== 'confirm') return json({ error: 'Action inconnue.' }, 400)
  const reject = async (message: string, status: number) => {
    const { error } = await storage.remove([path])
    if (error) console.error('[AnimaBingo] effacement d’un morceau refusé :', error.message)
    return json({ error: message }, status)
  }
  const { data: info, error: infoError } = await storage.info(path)
  if (infoError || !info) return json({ error: 'Fichier introuvable, renvoyez-le.' }, 404)
  const realSize = typeof info.size === 'number' ? info.size : Number(info.size)
  if (!Number.isFinite(realSize) || realSize <= 0) return reject('Fichier vide.', 400)
  if (realSize > MUSIC_AUDIO_MAX_BYTES) return reject(TOO_BIG, 413)
  const head = await readHead(path).catch(() => null)
  if (!head) return json({ error: 'Vérification du fichier impossible, réessayez.' }, 503)
  const real = sniffMedia(head)
  if (!real || real.kind !== 'audio') return reject('Ce fichier n’est pas un audio lisible (MP3, M4A, WAV, OGG ou FLAC).', 415)
  return json({ ok: true, path, url: musicUrl(path), size: realSize })
}
