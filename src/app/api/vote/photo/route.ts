// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaVote : photos des candidats. Réservé au propriétaire de la session.
// Déposées par le serveur (client service_role) dans photos/vote-photos/<session>/ :
// les règles d'accès du stockage partagé ne sont pas modifiées.
// POST (multipart : sessionId, file) : photo déjà compressée par le navigateur,
//   type vérifié sur les premiers octets, nom unique (jamais d'écrasement,
//   donc pas de cache CDN périmé).
// DELETE ({ sessionId, url }) : retire une photo remplacée, seulement si plus
//   aucun scrutin ni le brouillon ne l'utilisent.

import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { VOTE_PHOTO_BUCKET, VOTE_PHOTO_FOLDER, VOTE_PHOTO_MAX_BYTES } from '@/lib/vote/constants'
import { getVoteAdmin, requireSessionOwner, votePhotoBase } from '@/lib/vote/server'
import { isUuid, isVotePhotoUrl, votePhotoPrefix } from '@/lib/vote/validation'

/** Type réel d'après la signature du fichier (le type annoncé par le navigateur n'est pas cru). */
function sniffImage(bytes: Uint8Array): { ext: 'jpg' | 'png' | 'webp'; type: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', type: 'image/png' }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    return { ext: 'webp', type: 'image/webp' }
  }
  return null
}

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  const sessionId = form.get('sessionId')
  const file = form.get('file')
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session invalide.' }, { status: 400 })
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Aucune photo reçue.' }, { status: 400 })
  if (file.size === 0 || file.size > VOTE_PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: 'Photo trop lourde (2 Mo au maximum).' }, { status: 413 })
  }

  if (!(await requireSessionOwner(sessionId))) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = sniffImage(bytes)
  if (!kind) return NextResponse.json({ error: 'Format non accepté (JPEG, PNG ou WebP).' }, { status: 415 })

  const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${kind.ext}`
  const path = `${VOTE_PHOTO_FOLDER}/${sessionId}/${name}`
  const { error } = await getVoteAdmin()
    .storage.from(VOTE_PHOTO_BUCKET)
    .upload(path, bytes, { contentType: kind.type, cacheControl: '31536000', upsert: false })
  if (error) {
    console.error('[AnimaVote] photo :', error.message)
    return NextResponse.json({ error: 'Envoi de la photo impossible, réessayez.' }, { status: 500 })
  }

  return NextResponse.json({ url: `${votePhotoPrefix(votePhotoBase(), sessionId)}${name}` })
}

export async function DELETE(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  const { sessionId, url } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (!isUuid(sessionId) || typeof url !== 'string' || !isVotePhotoUrl(url, votePhotoBase(), sessionId)) {
    return NextResponse.json({ error: 'Photo invalide.' }, { status: 400 })
  }
  if (!(await requireSessionOwner(sessionId))) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const admin = getVoteAdmin()
  const [used, draft] = await Promise.all([
    admin.from('vote_candidates').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('image_url', url),
    admin.from('vote_drafts').select('data').eq('session_id', sessionId).maybeSingle(),
  ])
  if (used.error || draft.error) return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503 })
  const inDraft = JSON.stringify(draft.data?.data ?? null).includes(url)
  // Encore affichée quelque part : on la garde (sans erreur, l'éditeur n'a rien à faire).
  if ((used.count ?? 0) > 0 || inDraft) return NextResponse.json({ ok: true, kept: true })

  const path = url.slice(`${votePhotoBase()}/`.length)
  const { error } = await admin.storage.from(VOTE_PHOTO_BUCKET).remove([path])
  if (error) {
    console.error('[AnimaVote] suppression photo :', error.message)
    return NextResponse.json({ error: 'Suppression impossible.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, kept: false })
}
