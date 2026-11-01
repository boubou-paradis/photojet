// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Format du fichier d'échange Photo Mystère. Logique pure : le fichier vient
// d'un inconnu, rien de ce qu'il contient n'est cru sans contrôle.

import type { MysteryPhotoGrid, MysteryPhotoSpeed } from '@/types/database'

export const MO = 1024 * 1024

export const LIMITS = {
  zipBytes: 250 * MO,
  photos: 20,
  audios: 21,
  photoBytes: 8 * MO,
  photoSide: 6000,
  audioBytes: 25 * MO,
  entries: 45,
  manifestBytes: 64 * 1024,
  nameLength: 80,
} as const

export const MANIFEST_FILE = 'manifest.json'
export const FORMAT_ID = 'animajet-photo-mystere'
export const FORMAT_VERSION = 1

export const GRIDS: readonly MysteryPhotoGrid[] = ['6x4', '8x6', '10x8', '12x8', '15x10', '20x12']
export const SPEEDS: readonly MysteryPhotoSpeed[] = ['slow', 'medium', 'fast']

export const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const
export const AUDIO_EXTENSIONS = { 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg' } as const

export type ImageType = keyof typeof IMAGE_EXTENSIONS
export type AudioType = keyof typeof AUDIO_EXTENSIONS
export type MediaType = ImageType | AudioType

export interface MediaRef {
  file: string
  type: MediaType
  size: number
  sha256: string
}

export interface ManifestPhoto {
  image: MediaRef
  audio: MediaRef | null
}

export interface Manifest {
  format: typeof FORMAT_ID
  formatVersion: typeof FORMAT_VERSION
  exportedOn: string
  name: string
  settings: { grid: MysteryPhotoGrid; speed: MysteryPhotoSpeed }
  revealAudio: MediaRef | null
  photos: ManifestPhoto[]
}

/** Erreur dont le message est destiné à l'animateur. */
export class TransferError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransferError'
  }
}

export const INVALID_FILE_MESSAGE = "Ce fichier n'est pas une partie Photo Mystère valide."
export const DAMAGED_FILE_MESSAGE = 'Ce fichier est abîmé. Demandez à la personne de vous le renvoyer.'
export const NEWER_VERSION_MESSAGE =
  "Ce fichier a été créé avec une version plus récente d'AnimaJet. Rechargez la page et réessayez."

function fail(): never {
  throw new TransferError(INVALID_FILE_MESSAGE)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Clés exactes, sans clé en trop : couvre aussi `__proto__`, que JSON.parse
// crée comme une vraie clé.
function expectKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const found = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (found.length !== expected.length || found.some((key, i) => key !== expected[i])) fail()
}

function extensionOf(type: MediaType): string {
  return (IMAGE_EXTENSIONS as Record<string, string>)[type] ?? (AUDIO_EXTENSIONS as Record<string, string>)[type]
}

function parseMedia(
  value: unknown,
  extensions: Record<string, string>,
  folderAndStem: string,
  maxBytes: number
): MediaRef {
  if (!isRecord(value)) fail()
  expectKeys(value, ['file', 'type', 'size', 'sha256'])
  const { file, type, size, sha256 } = value
  if (typeof type !== 'string' || !Object.hasOwn(extensions, type)) fail()
  if (file !== `${folderAndStem}.${extensions[type]}`) fail()
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0) fail()
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) fail()
  if (size > maxBytes) {
    throw new TransferError(
      `Un fichier de cette partie dépasse la taille autorisée (${Math.round(maxBytes / MO)} Mo).`
    )
  }
  return { file, type: type as MediaType, size, sha256 }
}

export function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (name.length === 0 || name.length > LIMITS.nameLength) return null
  // Caractères de contrôle, y compris les retours à la ligne.
  if (/[\u0000-\u001f\u007f-\u009f]/.test(name)) return null
  return name
}

export function photoStem(index: number): string {
  return String(index + 1).padStart(2, '0')
}

export function parseManifest(value: unknown): Manifest {
  if (!isRecord(value)) fail()
  if (value.format !== FORMAT_ID) fail()
  const version = value.formatVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) fail()
  if (version > FORMAT_VERSION) throw new TransferError(NEWER_VERSION_MESSAGE)

  expectKeys(value, ['format', 'formatVersion', 'exportedOn', 'name', 'settings', 'revealAudio', 'photos'])

  const { exportedOn, settings, revealAudio, photos } = value
  if (typeof exportedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(exportedOn)) fail()
  const name = normalizeName(value.name)
  if (name === null) fail()

  if (!isRecord(settings)) fail()
  expectKeys(settings, ['grid', 'speed'])
  const grid = GRIDS.find((g) => g === settings.grid)
  const speed = SPEEDS.find((s) => s === settings.speed)
  if (!grid || !speed) fail()

  if (!Array.isArray(photos) || photos.length === 0 || photos.length > LIMITS.photos) fail()

  const parsedPhotos = photos.map((photo: unknown, index): ManifestPhoto => {
    if (!isRecord(photo)) fail()
    expectKeys(photo, ['image', 'audio'])
    const stem = photoStem(index)
    return {
      image: parseMedia(photo.image, IMAGE_EXTENSIONS, `photos/${stem}`, LIMITS.photoBytes),
      audio:
        photo.audio === null
          ? null
          : parseMedia(photo.audio, AUDIO_EXTENSIONS, `audio/${stem}`, LIMITS.audioBytes),
    }
  })

  const parsedReveal =
    revealAudio === null ? null : parseMedia(revealAudio, AUDIO_EXTENSIONS, 'audio/reveal', LIMITS.audioBytes)

  const manifest: Manifest = {
    format: FORMAT_ID,
    formatVersion: FORMAT_VERSION,
    exportedOn,
    name,
    settings: { grid, speed },
    revealAudio: parsedReveal,
    photos: parsedPhotos,
  }

  if (manifestMedia(manifest).reduce((sum, media) => sum + media.size, 0) > LIMITS.zipBytes) {
    throw new TransferError(`Cette partie dépasse la taille autorisée (${LIMITS.zipBytes / MO} Mo).`)
  }
  return manifest
}

export function manifestMedia(manifest: Manifest): MediaRef[] {
  const media: MediaRef[] = []
  for (const photo of manifest.photos) {
    media.push(photo.image)
    if (photo.audio) media.push(photo.audio)
  }
  if (manifest.revealAudio) media.push(manifest.revealAudio)
  return media
}

export function mediaFileName(stemPath: string, type: MediaType): string {
  return `${stemPath}.${extensionOf(type)}`
}

/** PhotoMystere-<nom>-<date>.zip, en caractères sûrs pour tous les systèmes. */
export function exportFileName(name: string, date: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '')
  return `PhotoMystere-${slug || 'partie'}-${date}.zip`
}

/** Date locale de l'animateur, sans l'heure. */
export function localDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Type réel d'après le contenu, jamais d'après l'extension. Null si non autorisé. */
export function sniffMediaType(bytes: Uint8Array): MediaType | null {
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length))

  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (ascii(0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png'
  if (ascii(0, 4) === 'RIFF') {
    if (ascii(8, 4) === 'WEBP') return 'image/webp'
    if (ascii(8, 4) === 'WAVE') return 'audio/wav'
    return null
  }
  if (ascii(0, 4) === 'OggS') return 'audio/ogg'
  if (ascii(0, 3) === 'ID3') return 'audio/mpeg'
  return isMp3FrameHeader(bytes, 0) ? 'audio/mpeg' : null
}

export function isMp3FrameHeader(bytes: Uint8Array, offset: number): boolean {
  if (offset + 4 > bytes.length) return false
  const [a, b, c] = [bytes[offset], bytes[offset + 1], bytes[offset + 2]]
  if (a !== 0xff || (b & 0xe0) !== 0xe0) return false
  const version = (b >> 3) & 0x03
  const layer = (b >> 1) & 0x03
  const bitrate = (c >> 4) & 0x0f
  const sampleRate = (c >> 2) & 0x03
  return version !== 1 && layer !== 0 && bitrate !== 0x0f && sampleRate !== 3
}

export function isImageType(type: MediaType): type is ImageType {
  return Object.hasOwn(IMAGE_EXTENSIONS, type)
}
