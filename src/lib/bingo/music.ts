// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo — loto musical : titres, playlists et cartons.
// Sans dépendance serveur : utilisable par la régie, l'écran, le téléphone et
// les tests.
//
// Un carton musical garde la forme d'un carton numéros (27 cases, 0 = case
// vide) : chaque ligne porte 5 titres, repérés par leur rang dans la
// playlist figée (1 à N). Tirage, demandes de quine et vérification restent
// donc exactement ceux du loto numéros.

import { cryptoRandom } from './cards'
import type { BingoCardDraft, Cells } from './types'

export const MUSIC_MIN_TRACKS = 30
export const MUSIC_MAX_TRACKS = 90
export const MUSIC_TITLE_MAX = 60
export const MUSIC_ARTIST_MAX = 40
export const MUSIC_PLAYLIST_NAME_MAX = 80
/** Taille maximale d'un morceau envoyé. */
export const MUSIC_AUDIO_MAX_BYTES = 15 * 1024 * 1024
/** Durée d'un extrait (secondes). */
export const MUSIC_EXTRACT_MIN_S = 3
export const MUSIC_EXTRACT_MAX_S = 120
/** Stockage : photos/bingo-music/<compte>/<horodatage>-<aléa>.<ext> */
export const MUSIC_BUCKET = 'photos'
export const MUSIC_FOLDER = 'bingo-music'

/** Un titre de la bibliothèque (saved_bingo_playlists.tracks). */
export interface MusicTrack {
  id: string
  title: string
  artist: string
  path: string
  /** Début et fin de l'extrait, en secondes. */
  start: number
  end: number
}

/** Ce que voient l'écran et les téléphones : jamais le fichier. */
export interface PublicTitle { t: string; a: string }

/** settings.music d'une partie musicale (recopié dans l'état public). */
export interface MusicInfo { sig: string; n: number }

export const publicTitles = (tracks: readonly Pick<MusicTrack, 'title' | 'artist'>[]): PublicTitle[] =>
  tracks.map((x) => ({ t: x.title, a: x.artist }))

/** Titre du morceau de rang `n` (1 à N). */
export const titleAt = (titles: readonly PublicTitle[] | null | undefined, n: number): PublicTitle | null =>
  (titles && n >= 1 && n <= titles.length ? titles[n - 1] : null)

const ID_RE = /^[0-9a-f-]{36}$/i

export const isMusicPath = (x: unknown, userId: string): x is string =>
  typeof x === 'string' && x.length <= 200 && new RegExp(`^${MUSIC_FOLDER}/${userId}/\\d{10,16}-[0-9a-f]{12}\\.(mp3|m4a|aac|wav|ogg|flac)$`).test(x)

const clean = (x: unknown, max: number): string =>
  typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Titre et artiste devinés d'après le nom du fichier (« Artiste - Titre.mp3 »). */
export function guessFromFilename(name: string): { title: string; artist: string } {
  const base = name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_]+/g, ' ').replace(/^\d{1,3}[\s.-]+/, '')
  const parts = base.split(/\s+-\s+/)
  if (parts.length >= 2) return { artist: clean(parts[0], MUSIC_ARTIST_MAX), title: clean(parts.slice(1).join(' - '), MUSIC_TITLE_MAX) }
  return { title: clean(base, MUSIC_TITLE_MAX), artist: '' }
}

/** Un titre validé, ou null. `userId` : seuls ses propres fichiers sont acceptés. */
export function parseTrack(x: unknown, userId: string): MusicTrack | null {
  if (typeof x !== 'object' || x === null) return null
  const o = x as Record<string, unknown>
  const title = clean(o.title, MUSIC_TITLE_MAX)
  const artist = clean(o.artist, MUSIC_ARTIST_MAX)
  const start = Number(o.start)
  const end = Number(o.end)
  if (typeof o.id !== 'string' || !ID_RE.test(o.id) || !title || !isMusicPath(o.path, userId)) return null
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0) return null
  const len = end - start
  if (len < MUSIC_EXTRACT_MIN_S || len > MUSIC_EXTRACT_MAX_S) return null
  return { id: o.id.toLowerCase(), title, artist, path: o.path, start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 }
}

export type PlaylistInput = { name: string; tracks: MusicTrack[] }

/** Playlist validée (0 à 90 titres en préparation ; 30 minimum pour jouer). */
export function parsePlaylist(x: unknown, userId: string): { ok: true; value: PlaylistInput } | { ok: false; error: string } {
  if (typeof x !== 'object' || x === null) return { ok: false, error: 'Playlist invalide.' }
  const o = x as Record<string, unknown>
  const name = clean(o.name, MUSIC_PLAYLIST_NAME_MAX)
  if (!name) return { ok: false, error: 'Donnez un nom à la playlist.' }
  if (!Array.isArray(o.tracks)) return { ok: false, error: 'Playlist invalide.' }
  if (o.tracks.length > MUSIC_MAX_TRACKS) return { ok: false, error: `${MUSIC_MAX_TRACKS} titres au maximum.` }
  const tracks: MusicTrack[] = []
  const ids = new Set<string>()
  for (const t of o.tracks) {
    const v = parseTrack(t, userId)
    if (!v) return { ok: false, error: 'Un titre est incomplet (titre ou extrait manquant).' }
    if (ids.has(v.id)) return { ok: false, error: 'Titre en double.' }
    ids.add(v.id)
    tracks.push(v)
  }
  return { ok: true, value: { name, tracks } }
}

/** Raison pour laquelle une playlist ne peut pas encore servir (null = prête). */
export function playlistProblem(tracks: readonly MusicTrack[]): string | null {
  if (tracks.length < MUSIC_MIN_TRACKS) return `Il faut au moins ${MUSIC_MIN_TRACKS} titres (${tracks.length} pour l’instant).`
  const seen = new Set<string>()
  for (const t of tracks) {
    const k = `${t.title}|${t.artist}`.toLowerCase()
    if (seen.has(k)) return `« ${t.title} » figure deux fois : les joueurs ne pourraient pas les distinguer.`
    seen.add(k)
  }
  return null
}

function shuffle<T>(a: T[], rand: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const signatureOf = (cells: Cells): string => cells.filter(Boolean).sort((a, b) => a - b).join('.')

/**
 * n cartons musicaux tous différents. Les cartons d'un même joueur ne
 * partagent aucun titre tant que la playlist le permet (3 cartons au plus
 * avec 45 titres, etc.).
 */
export function makeMusicCards(n: number, pool: number, rand: () => number = cryptoRandom, exclude: ReadonlySet<string> = new Set()): BingoCardDraft[] {
  const seen = new Set(exclude)
  const out: BingoCardDraft[] = []
  let deck: number[] = []
  for (let guard = 0; out.length < n; guard++) {
    if (guard > n * 50 + 200) throw new Error('cartons musicaux impossibles')
    if (deck.length < 15) deck = shuffle(Array.from({ length: pool }, (_, i) => i + 1), rand)
    const picks = deck.splice(0, 15)
    const cells: Cells = Array(27).fill(0)
    for (let row = 0; row < 3; row++) for (let c = 0; c < 5; c++) cells[row * 9 + c] = picks[row * 5 + c]
    const signature = signatureOf(cells)
    if (seen.has(signature)) continue
    seen.add(signature)
    out.push({ cells, signature })
  }
  return out
}

/** Contrôle d'un carton musical. Liste vide = conforme. */
export function checkMusicCard(cells: Cells, pool: number): string[] {
  if (cells.length !== 27) return ['27 cases attendues']
  const errors: string[] = []
  const all = cells.filter(Boolean)
  for (let row = 0; row < 3; row++) {
    const k = cells.slice(row * 9, row * 9 + 9).filter(Boolean).length
    if (k !== 5) errors.push(`ligne ${row + 1} : ${k} titres`)
  }
  if (new Set(all).size !== all.length) errors.push('titre en double')
  if (all.some((n) => !Number.isInteger(n) || n < 1 || n > pool)) errors.push('titre hors de la playlist')
  return errors
}
