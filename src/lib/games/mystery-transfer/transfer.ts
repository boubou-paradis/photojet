// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Export et import d'une partie Photo Mystère, entièrement dans le navigateur :
// les médias vont directement vers Supabase, sans passer par une fonction Vercel.

import type { createClient } from '@/lib/supabase'
import { compressAudio } from '@/lib/audio-utils'
import { compressImage } from '@/lib/image-utils'
import type { MysteryPhotoGrid, MysteryPhotoSpeed } from '@/types/database'
import { buildArchive, openArchive, type ArchiveFile } from './archive'
import {
  FORMAT_ID,
  FORMAT_VERSION,
  GRIDS,
  INVALID_FILE_MESSAGE,
  LIMITS,
  MO,
  SPEEDS,
  TransferError,
  exportFileName,
  isImageType,
  localDate,
  manifestMedia,
  mediaFileName,
  normalizeName,
  parseManifest,
  photoStem,
  sha256Hex,
  sniffMediaType,
  type Manifest,
  type ManifestPhoto,
  type MediaRef,
  type MediaType,
} from './format'
import { stripMetadata, verifyDecodable, type ImageSize } from './media'

type Supabase = ReturnType<typeof createClient>
type Bytes = Uint8Array<ArrayBuffer>
export type TransferProgress = (done: number, total: number) => void

const BUCKET = 'photos'
const DOWNLOAD_CONCURRENCY = 4
const UPLOAD_CONCURRENCY = 3

// Au-dessus de ces seuils seulement, pour ne pas dégrader un fichier déjà prêt.
const COMPRESS_ABOVE_BYTES = 2 * MO
const COMPRESS_ABOVE_SIDE = 1920
// Mêmes réglages que l'envoi d'une photo recadrée dans l'admin.
const IMAGE_COMPRESSION = { maxSizeMB: 0.6, maxWidthOrHeight: 1280, initialQuality: 0.85 }

export const EXPORT_NOTICE =
  'Partagez uniquement des photos et des musiques dont vous avez les droits, et avec l’accord des personnes photographiées.'
export const IMPORT_FAILED_MESSAGE = "L'import a échoué. Votre partie n'a pas été modifiée."
const GAME_RUNNING_MESSAGE = "Une partie est en cours. Quittez-la avant d'importer."

export interface GamePhoto {
  url: string
  audioUrl: string | null
}

export interface GameSnapshot {
  photos: GamePhoto[]
  revealAudio: string | null
  grid: MysteryPhotoGrid
  speed: MysteryPhotoSpeed
  active: boolean
}

function parseStoredPhotos(raw: string | null): GamePhoto[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((p): p is { url: string; audioUrl?: string | null } => typeof p?.url === 'string' && p.url !== '')
      .map((p) => ({ url: p.url, audioUrl: p.audioUrl || null }))
  } catch {
    return []
  }
}

export function isValidGrid(value: unknown): value is MysteryPhotoGrid {
  return GRIDS.some((grid) => grid === value)
}

export function isValidSpeed(value: unknown): value is MysteryPhotoSpeed {
  return SPEEDS.some((speed) => speed === value)
}

/** La partie telle qu'elle est en base, jamais l'état local de la page. */
export async function readGameSnapshot(supabase: Supabase, sessionId: string): Promise<GameSnapshot> {
  const { data, error } = await supabase
    .from('sessions')
    .select('mystery_photos, mystery_reveal_audio, mystery_photo_grid, mystery_photo_speed, mystery_photo_active')
    .eq('id', sessionId)
    .single()
  if (error || !data) throw new TransferError('Impossible de relire la partie. Réessayez.')
  return {
    photos: parseStoredPhotos(data.mystery_photos),
    revealAudio: data.mystery_reveal_audio || null,
    grid: isValidGrid(data.mystery_photo_grid) ? data.mystery_photo_grid : '12x8',
    speed: isValidSpeed(data.mystery_photo_speed) ? data.mystery_photo_speed : 'medium',
    active: data.mystery_photo_active ?? false,
  }
}

async function forEachLimit<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0
  let failure: { error: unknown } | null = null
  const worker = async () => {
    while (!failure) {
      const index = cursor++
      if (index >= items.length) return
      try {
        await task(items[index], index)
      } catch (error) {
        failure = failure ?? { error }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  if (failure) throw (failure as { error: unknown }).error
}

// ---------- Export ----------

interface ExportItem {
  path: string
  label: string
  stem: string
  kind: 'image' | 'audio'
}

function exportItems(snapshot: GameSnapshot): ExportItem[] {
  const items: ExportItem[] = []
  snapshot.photos.forEach((photo, index) => {
    const stem = photoStem(index)
    items.push({ path: photo.url, label: `Photo ${index + 1}`, stem: `photos/${stem}`, kind: 'image' })
    if (photo.audioUrl) {
      items.push({
        path: photo.audioUrl,
        label: `Audio de la photo ${index + 1}`,
        stem: `audio/${stem}`,
        kind: 'audio',
      })
    }
  })
  if (snapshot.revealAudio) {
    items.push({
      path: snapshot.revealAudio,
      label: 'Musique de dévoilement',
      stem: 'audio/reveal',
      kind: 'audio',
    })
  }
  return items
}

async function prepareExportItem(supabase: Supabase, item: ExportItem): Promise<ArchiveFile> {
  const { publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(item.path).data
  let response: Response
  try {
    response = await fetch(publicUrl)
  } catch {
    throw new TransferError(`${item.label} : téléchargement impossible. Vérifiez votre connexion.`)
  }
  if (!response.ok) throw new TransferError(`${item.label} : fichier introuvable, replacez-le avant d'exporter.`)

  const original = new Uint8Array(await response.arrayBuffer())
  const type = sniffMediaType(original)
  if (!type || isImageType(type) !== (item.kind === 'image')) {
    throw new TransferError(`${item.label} : format non pris en charge.`)
  }

  const bytes = stripMetadata(original, type, item.label)
  const maxBytes = item.kind === 'image' ? LIMITS.photoBytes : LIMITS.audioBytes
  if (bytes.length > maxBytes) {
    throw new TransferError(`${item.label} : fichier trop volumineux (${maxBytes / MO} Mo maximum).`)
  }

  // Le fichier produit doit être accepté par l'import : même contrôle des deux côtés.
  await verifyDecodable(new Blob([bytes], { type }), type, `${item.label} : fichier illisible.`)

  return {
    bytes,
    media: {
      file: mediaFileName(item.stem, type),
      type,
      size: bytes.length,
      sha256: await sha256Hex(bytes),
    },
  }
}

export interface ExportResult {
  blob: Blob
  fileName: string
}

export async function exportGame(options: {
  supabase: Supabase
  sessionId: string
  name: string
  now?: Date
  onProgress?: TransferProgress
}): Promise<ExportResult> {
  const { supabase, sessionId, onProgress } = options
  const name = normalizeName(options.name)
  if (name === null) {
    throw new TransferError(`Donnez un nom à votre partie (${LIMITS.nameLength} caractères maximum).`)
  }

  const snapshot = await readGameSnapshot(supabase, sessionId)
  if (snapshot.photos.length === 0) throw new TransferError('Ajoutez au moins une photo avant d’exporter.')
  if (snapshot.photos.length > LIMITS.photos) {
    throw new TransferError(`Une partie ne peut pas dépasser ${LIMITS.photos} photos.`)
  }

  const items = exportItems(snapshot)
  const files: ArchiveFile[] = new Array(items.length)
  let done = 0
  onProgress?.(0, items.length)
  await forEachLimit(items, DOWNLOAD_CONCURRENCY, async (item, index) => {
    files[index] = await prepareExportItem(supabase, item)
    onProgress?.(++done, items.length)
  })

  const mediaOf = (item: ExportItem) => files[items.indexOf(item)].media
  const photos: ManifestPhoto[] = snapshot.photos.map((_, index) => {
    const stem = photoStem(index)
    const image = items.find((item) => item.stem === `photos/${stem}`)!
    const audio = items.find((item) => item.stem === `audio/${stem}`)
    return { image: mediaOf(image), audio: audio ? mediaOf(audio) : null }
  })
  const reveal = items.find((item) => item.stem === 'audio/reveal')

  const date = localDate(options.now ?? new Date())
  const manifest: Manifest = parseManifest({
    format: FORMAT_ID,
    formatVersion: FORMAT_VERSION,
    exportedOn: date,
    name,
    settings: { grid: snapshot.grid, speed: snapshot.speed },
    revealAudio: reveal ? mediaOf(reveal) : null,
    photos,
  } satisfies Manifest)

  const archive = await buildArchive(manifest, files)
  if (archive.length > LIMITS.zipBytes) {
    throw new TransferError(`Cette partie dépasse la taille autorisée (${LIMITS.zipBytes / MO} Mo).`)
  }
  return {
    blob: new Blob([archive], { type: 'application/zip' }),
    fileName: exportFileName(name, date),
  }
}

// ---------- Import ----------

interface PreparedMedia {
  media: MediaRef
  bytes: Bytes
  size: ImageSize | null
}

export interface PreparedImport {
  manifest: Manifest
  media: Map<string, PreparedMedia>
  totalBytes: number
  audioCount: number
}

/** Contrôle tout le fichier, sans rien écrire. La partie en cours n'est pas touchée. */
export async function prepareImport(file: File, onProgress?: TransferProgress): Promise<PreparedImport> {
  const archive = await openArchive(file)
  const list = manifestMedia(archive.manifest)
  const media = new Map<string, PreparedMedia>()

  onProgress?.(0, list.length)
  for (const [index, ref] of list.entries()) {
    const bytes = await archive.readMedia(ref)
    const size = await verifyDecodable(new Blob([bytes], { type: ref.type }), ref.type, INVALID_FILE_MESSAGE)
    media.set(ref.file, { media: ref, bytes, size })
    onProgress?.(index + 1, list.length)
  }

  return {
    manifest: archive.manifest,
    media,
    totalBytes: file.size,
    audioCount: archive.manifest.photos.filter((photo) => photo.audio).length,
  }
}

interface ReadyFile {
  file: File
  type: MediaType
}

async function finalizeMedia({ media, bytes, size }: PreparedMedia): Promise<ReadyFile> {
  const original = new File([bytes], media.file.split('/').pop()!, { type: media.type })

  if (size) {
    if (bytes.length <= COMPRESS_ABOVE_BYTES && Math.max(size.width, size.height) <= COMPRESS_ABOVE_SIDE) {
      return { file: original, type: media.type }
    }
    return checkCompressed(await compressImage(original, undefined, IMAGE_COMPRESSION), original, media.type)
  }

  if (media.type === 'audio/mpeg') return { file: original, type: media.type }
  return checkCompressed(await compressAudio(original), original, media.type)
}

// compressImage et compressAudio rendent le fichier d'origine en cas d'échec :
// le type du résultat est revérifié, jamais supposé.
async function checkCompressed(result: File, original: File, originalType: MediaType): Promise<ReadyFile> {
  const head = new Uint8Array(await result.slice(0, 16).arrayBuffer())
  const type = sniffMediaType(head)
  if (!type || isImageType(type) !== isImageType(originalType)) return { file: original, type: originalType }
  return { file: new File([result], result.name, { type }), type }
}

function storagePath(sessionId: string, ref: MediaRef, type: MediaType, stamp: number): string {
  const extension = mediaFileName('x', type).slice(2)
  const stem = ref.file.split('/').pop()!.split('.')[0]
  if (ref.file.startsWith('photos/')) {
    return `mystery-photos/mystery_${sessionId}_${Number(stem) - 1}_${stamp}.${extension}`
  }
  if (stem === 'reveal') return `mystery-audio/mystery_reveal_${sessionId}_${stamp}.${extension}`
  return `mystery-audio/mystery_audio_${sessionId}_${Number(stem) - 1}_${stamp}.${extension}`
}

function gamePaths(photos: GamePhoto[], revealAudio: string | null): string[] {
  const paths = photos.flatMap((photo) => (photo.audioUrl ? [photo.url, photo.audioUrl] : [photo.url]))
  return revealAudio ? [...paths, revealAudio] : paths
}

async function removeUploaded(supabase: Supabase, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) console.error('Mystery import rollback error:', error)
}

// Fichiers encore utilisés par une AUTRE session du compte : filterPathsSafeToDelete()
// ne regarde que la bibliothèque. En cas de doute, renvoie null : rien n'est supprimé.
async function pathsUsedByOtherSessions(
  supabase: Supabase,
  userId: string,
  sessionId: string
): Promise<Set<string> | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('mystery_photos, mystery_reveal_audio')
    .eq('user_id', userId)
    .neq('id', sessionId)
  if (error || !data) return null
  return new Set(
    data.flatMap((row) => gamePaths(parseStoredPhotos(row.mystery_photos), row.mystery_reveal_audio || null))
  )
}

async function removeReplacedFiles(options: {
  supabase: Supabase
  userId: string
  sessionId: string
  paths: string[]
  filterPathsSafeToDelete: (paths: string[]) => Promise<string[]>
}): Promise<void> {
  const { supabase, userId, sessionId, paths, filterPathsSafeToDelete } = options
  try {
    const usedElsewhere = await pathsUsedByOtherSessions(supabase, userId, sessionId)
    if (!usedElsewhere) return
    const safe = await filterPathsSafeToDelete(paths.filter((path) => !usedElsewhere.has(path)))
    if (safe.length === 0) return
    const { error } = await supabase.storage.from(BUCKET).remove(safe)
    if (error) console.error('Mystery import cleanup error:', error)
  } catch (error) {
    // L'import est déjà validé : au pire, d'anciens fichiers restent en stockage.
    console.error('Mystery import cleanup error:', error)
  }
}

export interface ImportResult {
  photos: GamePhoto[]
  revealAudio: string | null
  grid: MysteryPhotoGrid
  speed: MysteryPhotoSpeed
}

/**
 * Tout ou rien : la partie en cours ne change qu'à la dernière écriture, une seule
 * mise à jour de la ligne `sessions`. Avant elle, chaque échec retire les fichiers envoyés.
 */
export async function applyImport(options: {
  supabase: Supabase
  sessionId: string
  userId: string
  prepared: PreparedImport
  filterPathsSafeToDelete: (paths: string[]) => Promise<string[]>
  onProgress?: TransferProgress
  now?: () => number
}): Promise<ImportResult> {
  const { supabase, sessionId, userId, prepared, filterPathsSafeToDelete, onProgress } = options
  const before = await readGameSnapshot(supabase, sessionId)
  if (before.active) throw new TransferError(GAME_RUNNING_MESSAGE)

  const stamp = (options.now ?? Date.now)()
  const refs = manifestMedia(prepared.manifest)
  const paths = new Map<string, string>()
  const uploaded: string[] = []
  let done = 0
  onProgress?.(0, refs.length)

  try {
    await forEachLimit(refs, UPLOAD_CONCURRENCY, async (ref) => {
      const { file, type } = await finalizeMedia(prepared.media.get(ref.file)!)
      const path = storagePath(sessionId, ref, type, stamp)
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: type })
      if (error) throw error
      uploaded.push(path)
      paths.set(ref.file, path)
      onProgress?.(++done, refs.length)
    })
  } catch (error) {
    console.error('Mystery import upload error:', error)
    await removeUploaded(supabase, uploaded)
    throw new TransferError(IMPORT_FAILED_MESSAGE)
  }

  const photos: GamePhoto[] = prepared.manifest.photos.map((photo) => ({
    url: paths.get(photo.image.file)!,
    audioUrl: photo.audio ? paths.get(photo.audio.file)! : null,
  }))
  const revealAudio = prepared.manifest.revealAudio ? paths.get(prepared.manifest.revealAudio.file)! : null
  const { grid, speed } = prepared.manifest.settings
  const photosJson = JSON.stringify(photos)

  const { data: updated, error: updateError } = await supabase
    .from('sessions')
    .update({
      mystery_photos: photosJson,
      mystery_total_rounds: photos.length,
      mystery_photo_grid: grid,
      mystery_photo_speed: speed,
      mystery_reveal_audio: revealAudio,
      mystery_current_round: 1,
      mystery_revealed_tiles: [],
      mystery_is_playing: false,
    })
    .eq('id', sessionId)
    // Une partie lancée depuis un autre onglet entre-temps n'est jamais écrasée.
    .not('mystery_photo_active', 'is', true)
    .select('id')

  if (updateError) {
    // Réponse perdue : l'écriture a pu passer. Retirer les fichiers casserait alors la
    // partie importée, donc on ne les retire que si la base confirme l'échec.
    const { data: current } = await supabase
      .from('sessions')
      .select('mystery_photos')
      .eq('id', sessionId)
      .single()
    const written = current?.mystery_photos === photosJson
    if (current && !written) await removeUploaded(supabase, uploaded)
    if (!written) throw new TransferError(IMPORT_FAILED_MESSAGE)
  } else if (!updated || updated.length === 0) {
    await removeUploaded(supabase, uploaded)
    throw new TransferError(GAME_RUNNING_MESSAGE)
  }

  await removeReplacedFiles({
    supabase,
    userId,
    sessionId,
    paths: gamePaths(before.photos, before.revealAudio),
    filterPathsSafeToDelete,
  })

  return { photos, revealAudio, grid, speed }
}

export interface ExportAccess {
  blocked: boolean
  message?: string
}

/** En cas d'erreur de vérification : pas de blocage. */
export async function checkExportAccess(): Promise<ExportAccess> {
  try {
    const response = await fetch('/api/mystery/export-access')
    if (!response.ok) return { blocked: false }
    const data: ExportAccess = await response.json()
    return data.blocked === true ? data : { blocked: false }
  } catch {
    return { blocked: false }
  }
}
