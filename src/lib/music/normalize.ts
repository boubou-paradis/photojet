// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Demandes de musique : nettoyage des champs et clé de regroupement.
// Sans dépendance : utilisable côté téléphone, serveur et tests.

export const MUSIC_TITLE_MAX = 80
export const MUSIC_ARTIST_MAX = 60
const KEY_MAX = 160

/**
 * Texte affichable : caractères de contrôle et retours à la ligne remplacés
 * par des espaces, espaces réduits, bords retirés. Ne coupe rien : la longueur
 * est contrôlée à part (refus si trop long).
 */
export function cleanMusicField(value: unknown): string {
  if (typeof value !== 'string') return ''
  // \s couvre aussi les séparateurs de ligne Unicode (U+2028, U+2029).
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Minuscules, sans accents, ponctuation ni espaces en trop. */
export function normalizeMusicPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Clé de regroupement « titre|artiste ». Un titre fait uniquement de
 * ponctuation (« ??? ») garde son texte en minuscules pour ne pas être
 * mélangé à un autre.
 */
export function musicKey(title: string, artist: string | null | undefined): string {
  const t = normalizeMusicPart(title) || title.toLowerCase().trim()
  const a = artist ? normalizeMusicPart(artist) || artist.toLowerCase().trim() : ''
  return `${t}|${a}`.slice(0, KEY_MAX)
}

export type MusicInput =
  | { ok: true; title: string; artist: string | null; key: string }
  | { ok: false; error: 'title_required' | 'title_too_long' | 'artist_too_long' }

/** Contrôle d'un envoi du formulaire (titre obligatoire, longueurs maximales). */
export function parseMusicInput(rawTitle: unknown, rawArtist: unknown): MusicInput {
  const title = cleanMusicField(rawTitle)
  const artist = cleanMusicField(rawArtist)
  if (!title) return { ok: false, error: 'title_required' }
  if (title.length > MUSIC_TITLE_MAX) return { ok: false, error: 'title_too_long' }
  if (artist.length > MUSIC_ARTIST_MAX) return { ok: false, error: 'artist_too_long' }
  return { ok: true, title, artist: artist || null, key: musicKey(title, artist) }
}
