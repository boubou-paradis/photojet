// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo, loto musical — côté navigateur de l'animateur : bibliothèque de
// playlists (/api/bingo/playlists) et envoi des morceaux (/api/bingo/media).
// Même chemin qu'AnimaBuzz : compression (brique du Quiz, sans modification),
// adresse signée, envoi direct au stockage, confirmation par le serveur.

import { compressAudio, needsAudioCompression } from '@/lib/audio-utils'
import { createClient } from '@/lib/supabase'
import { MUSIC_AUDIO_MAX_BYTES, MUSIC_BUCKET, MUSIC_EXTRACT_MIN_S, type MusicTrack } from './music'

export type UploadStage = 'compressing' | 'uploading' | 'checking'
export class MusicError extends Error {}

/** Titre tel que renvoyé par la bibliothèque (avec son adresse de lecture). */
export type LibraryTrack = MusicTrack & { url: string }
export interface LibraryPlaylist {
  id: string
  name: string
  tracks: LibraryTrack[]
  updatedAt: string
  problem: string | null
}

async function post(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
  } catch {
    throw new MusicError('Connexion impossible, réessayez.')
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new MusicError(typeof json.error === 'string' ? json.error : 'Action impossible, réessayez.')
  return json
}

export async function fetchPlaylists(): Promise<LibraryPlaylist[]> {
  let res: Response
  try {
    res = await fetch('/api/bingo/playlists', { cache: 'no-store' })
  } catch {
    throw new MusicError('Connexion impossible, réessayez.')
  }
  const json = (await res.json().catch(() => ({}))) as { playlists?: LibraryPlaylist[]; error?: string }
  if (!res.ok || !json.playlists) throw new MusicError(json.error ?? 'Lecture des playlists impossible.')
  return json.playlists
}

export async function savePlaylist(p: { id?: string; name: string; tracks: MusicTrack[] }): Promise<LibraryPlaylist> {
  const json = await post('/api/bingo/playlists', { action: 'save', ...p })
  return json.playlist as LibraryPlaylist
}

export async function deletePlaylist(id: string): Promise<void> {
  await post('/api/bingo/playlists', { action: 'delete', id })
}

/** Morceau envoyé puis abandonné : effacé s'il n'est cité nulle part (sans erreur bloquante). */
export function discardMusic(path: string): void {
  void post('/api/bingo/media', { action: 'discard', path }).catch(() => undefined)
}

const TYPE_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
}
const typeOf = (f: File) => f.type || TYPE_BY_EXT[f.name.split('.').pop()?.toLowerCase() ?? ''] || ''

/** Durée d'un audio (s), ou null si illisible. */
export function audioDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const a = new Audio()
    const done = (v: number | null) => {
      clearTimeout(t)
      a.removeAttribute('src')
      resolve(v)
    }
    const t = setTimeout(() => done(null), 20_000)
    a.preload = 'metadata'
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : null)
    a.onerror = () => done(null)
    a.src = url
  })
}

/** Envoie un morceau ; renvoie son chemin, son adresse de lecture et un extrait par défaut. */
export async function uploadMusic(original: File, onStage?: (s: UploadStage) => void): Promise<{ path: string; url: string; start: number; end: number }> {
  if (original.size > MUSIC_AUDIO_MAX_BYTES) throw new MusicError(`« ${original.name} » est trop lourd (${MUSIC_AUDIO_MAX_BYTES / 1024 / 1024} Mo au maximum).`)
  onStage?.('compressing')
  let file = original
  if (needsAudioCompression(original)) file = await compressAudio(original)
  onStage?.('uploading')
  const signed = await post('/api/bingo/media', { action: 'sign', contentType: typeOf(file), size: file.size })
  const path = signed.path as string
  const { error } = await createClient()
    .storage.from(MUSIC_BUCKET)
    .uploadToSignedUrl(path, signed.token as string, file, { contentType: signed.contentType as string, cacheControl: '31536000' })
  if (error) throw new MusicError('Envoi interrompu, réessayez.')
  onStage?.('checking')
  const ok = await post('/api/bingo/media', { action: 'confirm', path })
  const url = ok.url as string
  const duration = await audioDuration(url)
  if (duration !== null && duration < MUSIC_EXTRACT_MIN_S) {
    discardMusic(path)
    throw new MusicError(`« ${original.name} » dure moins de ${MUSIC_EXTRACT_MIN_S} secondes.`)
  }
  // Extrait par défaut : les 30 premières secondes (à ajuster au découpeur).
  const end = duration === null ? 30 : Math.min(30, Math.floor(duration * 100) / 100)
  return { path, url, start: 0, end }
}
