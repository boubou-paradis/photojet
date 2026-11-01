// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Écriture et lecture du .zip. JSZip est chargé au clic uniquement.
//
// Comportements de JSZip 3.10 vérifiés par essai, d'où les contrôles ci-dessous :
// il ne lève aucune erreur sur `../../x` (renommé `x`), sur deux entrées de même
// nom (l'une écrase l'autre) ni sur un octet abîmé. `loadAsync` ne décompresse
// rien : le coût d'une bombe zip n'apparaît qu'à la lecture, plafonnée ici.

import type JSZip from 'jszip'
import {
  DAMAGED_FILE_MESSAGE,
  INVALID_FILE_MESSAGE,
  LIMITS,
  MANIFEST_FILE,
  MO,
  TransferError,
  manifestMedia,
  parseManifest,
  sha256Hex,
  sniffMediaType,
  type Manifest,
  type MediaRef,
} from './format'

const EOCD_SIZE = 22
const EOCD_SIGNATURE = 0x06054b50

// Seules entrées admises : tout le reste (fichier caché, __MACOSX, ../) est refusé.
const ALLOWED_ENTRY = /^(?:photos\/\d{2}\.(?:jpg|png|webp)|audio\/(?:\d{2}|reveal)\.(?:mp3|wav|ogg))$/
const ALLOWED_FOLDERS = new Set(['photos/', 'audio/'])

async function loadJSZip(): Promise<typeof JSZip> {
  return (await import('jszip')).default
}

export interface ArchiveFile {
  media: MediaRef
  bytes: Uint8Array<ArrayBuffer>
}

export async function buildArchive(
  manifest: Manifest,
  files: ArchiveFile[]
): Promise<Uint8Array<ArrayBuffer>> {
  const Zip = await loadJSZip()
  const zip = new Zip()
  const date = new Date(`${manifest.exportedOn}T12:00:00Z`)
  zip.file(MANIFEST_FILE, JSON.stringify(manifest, null, 2), { date, createFolders: false })
  for (const { media, bytes } of files) {
    zip.file(media.file, bytes, { date, createFolders: false })
  }
  // STORE : JPEG et MP3 sont déjà compressés, DEFLATE ne gagnerait rien.
  const output = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
  return new Uint8Array(output)
}

function refuseTooBig(): never {
  throw new TransferError(`Ce fichier est trop volumineux (${LIMITS.zipBytes / MO} Mo maximum).`)
}

/** Contrôles avant ouverture. Renvoie le nombre d'entrées annoncé par le zip. */
export async function precheckArchive(file: Blob): Promise<number> {
  if (file.size > LIMITS.zipBytes) refuseTooBig()
  if (file.size < EOCD_SIZE) throw new TransferError(INVALID_FILE_MESSAGE)

  // Sans commentaire de zip, le répertoire final occupe exactement les 22 derniers
  // octets. L'exigence évite de chercher sa signature dans un fichier inconnu.
  const tail = new DataView(await file.slice(file.size - EOCD_SIZE).arrayBuffer())
  if (tail.getUint32(0, true) !== EOCD_SIGNATURE) throw new TransferError(INVALID_FILE_MESSAGE)

  const entriesOnDisk = tail.getUint16(8, true)
  const entries = tail.getUint16(10, true)
  const directorySize = tail.getUint32(12, true)
  const directoryOffset = tail.getUint32(16, true)

  if (entries > LIMITS.entries) throw new TransferError(INVALID_FILE_MESSAGE)
  if (entries === 0 || entriesOnDisk !== entries) throw new TransferError(INVALID_FILE_MESSAGE)
  if (directoryOffset + directorySize + EOCD_SIZE !== file.size) {
    throw new TransferError(DAMAGED_FILE_MESSAGE)
  }
  return entries
}

// Méthode documentée par JSZip, absente de ses types.
interface ByteStream {
  on(event: 'data', listener: (chunk: Uint8Array) => void): ByteStream
  on(event: 'error' | 'end', listener: () => void): ByteStream
  pause(): ByteStream
  resume(): ByteStream
}
type StreamableEntry = JSZip.JSZipObject & { internalStream(type: 'uint8array'): ByteStream }

/** Lit une entrée et coupe dès le dépassement de la taille annoncée : parade à la bombe zip. */
function readCapped(entry: JSZip.JSZipObject, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let total = 0
    const stream = (entry as StreamableEntry).internalStream('uint8array')
    stream.on('data', (chunk) => {
      total += chunk.length
      if (total > maxBytes) {
        stream.pause()
        reject(new TransferError(DAMAGED_FILE_MESSAGE))
        return
      }
      chunks.push(chunk)
    })
    stream.on('error', () => reject(new TransferError(DAMAGED_FILE_MESSAGE)))
    stream.on('end', () => {
      const bytes = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      resolve(bytes)
    })
    stream.resume()
  })
}

export interface OpenedArchive {
  manifest: Manifest
  /** Lit un média, contrôle sa taille, son empreinte et son type réel. */
  readMedia(media: MediaRef): Promise<Uint8Array<ArrayBuffer>>
}

export async function openArchive(file: Blob): Promise<OpenedArchive> {
  const announcedEntries = await precheckArchive(file)

  const Zip = await loadJSZip()
  let zip: JSZip
  try {
    zip = await Zip.loadAsync(await file.arrayBuffer(), { createFolders: false })
  } catch {
    throw new TransferError(DAMAGED_FILE_MESSAGE)
  }

  // Moins d'entrées lues qu'annoncées : un doublon en a écrasé une.
  const names = Object.keys(zip.files)
  if (names.length !== announcedEntries) throw new TransferError(INVALID_FILE_MESSAGE)

  const fileEntries = new Set<string>()
  for (const name of names) {
    const entry = zip.files[name]
    if (entry.unsafeOriginalName !== undefined && entry.unsafeOriginalName !== name) {
      throw new TransferError(INVALID_FILE_MESSAGE)
    }
    if (entry.dir) {
      if (!ALLOWED_FOLDERS.has(name)) throw new TransferError(INVALID_FILE_MESSAGE)
      continue
    }
    if (name !== MANIFEST_FILE && !ALLOWED_ENTRY.test(name)) throw new TransferError(INVALID_FILE_MESSAGE)
    fileEntries.add(name)
  }

  const manifestEntry = zip.files[MANIFEST_FILE]
  if (!manifestEntry || manifestEntry.dir) throw new TransferError(INVALID_FILE_MESSAGE)

  let rawManifest: unknown
  try {
    const bytes = await readCapped(manifestEntry, LIMITS.manifestBytes)
    rawManifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new TransferError(INVALID_FILE_MESSAGE)
  }
  const manifest = parseManifest(rawManifest)

  // Liste exacte : chaque média annoncé existe, et rien d'autre n'accompagne le manifeste.
  const announced = new Set(manifestMedia(manifest).map((media) => media.file))
  fileEntries.delete(MANIFEST_FILE)
  if (announced.size !== fileEntries.size || [...announced].some((name) => !fileEntries.has(name))) {
    throw new TransferError(INVALID_FILE_MESSAGE)
  }

  return {
    manifest,
    async readMedia(media) {
      const bytes = await readCapped(zip.files[media.file], media.size)
      if (bytes.length !== media.size || (await sha256Hex(bytes)) !== media.sha256) {
        throw new TransferError(DAMAGED_FILE_MESSAGE)
      }
      if (sniffMediaType(bytes) !== media.type) throw new TransferError(INVALID_FILE_MESSAGE)
      return bytes
    },
  }
}
