// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — médias des manches préparées : types acceptés et
// reconnaissance du type RÉEL d'un fichier d'après ses premiers octets (le
// type annoncé par le navigateur n'est jamais cru). Sans dépendance : testable seul.

import type { BuzzerMediaKind } from './prep'

export interface MediaType {
  kind: BuzzerMediaKind
  ext: string
  contentType: string
}

/** Types annoncés acceptés à la demande d'envoi, et l'extension imposée. */
export const ACCEPTED_MEDIA: Record<string, MediaType> = {
  'audio/mpeg': { kind: 'audio', ext: 'mp3', contentType: 'audio/mpeg' },
  'audio/mp3': { kind: 'audio', ext: 'mp3', contentType: 'audio/mpeg' },
  'audio/mp4': { kind: 'audio', ext: 'm4a', contentType: 'audio/mp4' },
  'audio/x-m4a': { kind: 'audio', ext: 'm4a', contentType: 'audio/mp4' },
  'audio/m4a': { kind: 'audio', ext: 'm4a', contentType: 'audio/mp4' },
  'audio/aac': { kind: 'audio', ext: 'aac', contentType: 'audio/aac' },
  'audio/wav': { kind: 'audio', ext: 'wav', contentType: 'audio/wav' },
  'audio/x-wav': { kind: 'audio', ext: 'wav', contentType: 'audio/wav' },
  'audio/wave': { kind: 'audio', ext: 'wav', contentType: 'audio/wav' },
  'audio/ogg': { kind: 'audio', ext: 'ogg', contentType: 'audio/ogg' },
  'audio/flac': { kind: 'audio', ext: 'flac', contentType: 'audio/flac' },
  'audio/x-flac': { kind: 'audio', ext: 'flac', contentType: 'audio/flac' },
  'image/jpeg': { kind: 'image', ext: 'jpg', contentType: 'image/jpeg' },
  'image/png': { kind: 'image', ext: 'png', contentType: 'image/png' },
  'image/webp': { kind: 'image', ext: 'webp', contentType: 'image/webp' },
}

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to))

/** Type réel d'après la signature (32 premiers octets suffisent). null = refusé. */
export function sniffMedia(b: Uint8Array): { kind: BuzzerMediaKind; ext: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'image', ext: 'jpg' }
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return { kind: 'image', ext: 'png' }
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { kind: 'image', ext: 'webp' }
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE') return { kind: 'audio', ext: 'wav' }
  if (b.length >= 3 && ascii(b, 0, 3) === 'ID3') return { kind: 'audio', ext: 'mp3' }
  if (b.length >= 4 && ascii(b, 0, 4) === 'OggS') return { kind: 'audio', ext: 'ogg' }
  if (b.length >= 4 && ascii(b, 0, 4) === 'fLaC') return { kind: 'audio', ext: 'flac' }
  if (b.length >= 12 && ascii(b, 4, 8) === 'ftyp') {
    // Conteneur MP4 : on n'accepte que les variantes audio (M4A, AAC).
    const brand = ascii(b, 8, 12)
    if (['M4A ', 'M4B ', 'mp42', 'isom', 'dash', 'iso2'].includes(brand)) return { kind: 'audio', ext: 'm4a' }
    return null
  }
  // Trame MPEG brute : 11 bits de synchronisation. Couche III = MP3, couche 0 (ADTS) = AAC.
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) {
    const layer = (b[1] >> 1) & 0x03
    if (layer === 0x01) return { kind: 'audio', ext: 'mp3' }
    if (layer === 0x00) return { kind: 'audio', ext: 'aac' }
  }
  return null
}

/** Taille maximale d'un média selon son type. */
export function maxBytesFor(kind: BuzzerMediaKind, limits: { audioMaxBytes: number; imageMaxBytes: number }): number {
  return kind === 'audio' ? limits.audioMaxBytes : limits.imageMaxBytes
}
