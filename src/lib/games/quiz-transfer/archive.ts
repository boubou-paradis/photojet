// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Écriture et lecture du .zip d'un quiz. JSZip est chargé au clic uniquement.
// Copie adaptée de mystery-transfer/archive.ts (liste d'entrées, limites et
// manifeste propres au Quiz), dont les comportements de JSZip 3.10 ont été
// vérifiés par essai : `../../x` est renommé `x` sans erreur, deux entrées de
// même nom s'écrasent, un octet abîmé passe, et `loadAsync` ne décompresse rien
// (le coût d'une bombe zip n'apparaît qu'à la lecture, plafonnée ici).

import type JSZip from 'jszip'
import { sha256Hex, sniffMediaType } from '@/lib/games/mystery-transfer/format'
import {
  ALLOWED_FOLDERS,
  CSV_FILE,
  MANIFEST_FILE,
  MEDIA_ENTRY,
  MO,
  QUIZ_DAMAGED_MESSAGE,
  QUIZ_INVALID_MESSAGE,
  QUIZ_LIMITS,
  TransferError,
  parseQuizManifest,
  type MediaRef,
  type QuizManifest,
} from './format'

const EOCD_SIZE = 22
const EOCD_SIGNATURE = 0x06054b50

async function loadJSZip(): Promise<typeof JSZip> {
  return (await import('jszip')).default
}

export interface ArchiveFile {
  file: string
  bytes: Uint8Array<ArrayBuffer>
}

export async function buildQuizArchive(
  manifest: QuizManifest,
  csvBytes: Uint8Array<ArrayBuffer>,
  files: ArchiveFile[]
): Promise<Uint8Array<ArrayBuffer>> {
  const Zip = await loadJSZip()
  const zip = new Zip()
  const date = new Date(`${manifest.exportedOn}T12:00:00Z`)
  zip.file(MANIFEST_FILE, JSON.stringify(manifest, null, 2), { date, createFolders: false })
  zip.file(CSV_FILE, csvBytes, { date, createFolders: false })
  for (const { file, bytes } of files) {
    zip.file(file, bytes, { date, createFolders: false })
  }
  // STORE : MP3, JPEG et WebP sont déjà compressés, DEFLATE ne gagnerait rien.
  const output = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
  return new Uint8Array(output)
}

export function tooBigMessage(bytes: number): string {
  return (
    `Ce quiz pèse ${Math.ceil(bytes / MO)} Mo, au-delà de la limite de ${QUIZ_LIMITS.zipBytes / MO} Mo. ` +
    'Divisez-le en plusieurs quiz plus courts et exportez-les séparément.'
  )
}

/** Contrôles avant ouverture. Renvoie le nombre d'entrées annoncé par le zip. */
export async function precheckQuizArchive(file: Blob): Promise<number> {
  if (file.size > QUIZ_LIMITS.zipBytes) {
    throw new TransferError(`Ce fichier est trop volumineux (${QUIZ_LIMITS.zipBytes / MO} Mo maximum).`)
  }
  if (file.size < EOCD_SIZE) throw new TransferError(QUIZ_INVALID_MESSAGE)

  // Sans commentaire de zip, le répertoire final occupe exactement les 22 derniers
  // octets. L'exigence évite de chercher sa signature dans un fichier inconnu.
  const tail = new DataView(await file.slice(file.size - EOCD_SIZE).arrayBuffer())
  if (tail.getUint32(0, true) !== EOCD_SIGNATURE) throw new TransferError(QUIZ_INVALID_MESSAGE)

  const entriesOnDisk = tail.getUint16(8, true)
  const entries = tail.getUint16(10, true)
  const directorySize = tail.getUint32(12, true)
  const directoryOffset = tail.getUint32(16, true)

  if (entries > QUIZ_LIMITS.entries) throw new TransferError(QUIZ_INVALID_MESSAGE)
  if (entries === 0 || entriesOnDisk !== entries) throw new TransferError(QUIZ_INVALID_MESSAGE)
  if (directoryOffset + directorySize + EOCD_SIZE !== file.size) {
    throw new TransferError(QUIZ_DAMAGED_MESSAGE)
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
        reject(new TransferError(QUIZ_DAMAGED_MESSAGE))
        return
      }
      chunks.push(chunk)
    })
    stream.on('error', () => reject(new TransferError(QUIZ_DAMAGED_MESSAGE)))
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

export interface OpenedQuizArchive {
  manifest: QuizManifest
  /** Texte de quiz.csv, après contrôle de sa taille et de son empreinte. */
  csvText: string
  /** Lit un média, contrôle sa taille, son empreinte et son type réel. */
  readMedia(media: MediaRef): Promise<Uint8Array<ArrayBuffer>>
}

export async function openQuizArchive(file: Blob): Promise<OpenedQuizArchive> {
  const announcedEntries = await precheckQuizArchive(file)

  const Zip = await loadJSZip()
  let zip: JSZip
  try {
    zip = await Zip.loadAsync(await file.arrayBuffer(), { createFolders: false })
  } catch {
    throw new TransferError(QUIZ_DAMAGED_MESSAGE)
  }

  // Moins d'entrées lues qu'annoncées : un doublon en a écrasé une.
  const names = Object.keys(zip.files)
  if (names.length !== announcedEntries) throw new TransferError(QUIZ_INVALID_MESSAGE)

  // Seules entrées admises : tout le reste (fichier caché, __MACOSX, ../) est refusé.
  const fileEntries = new Set<string>()
  for (const name of names) {
    const entry = zip.files[name]
    if (entry.unsafeOriginalName !== undefined && entry.unsafeOriginalName !== name) {
      throw new TransferError(QUIZ_INVALID_MESSAGE)
    }
    if (entry.dir) {
      if (!ALLOWED_FOLDERS.has(name)) throw new TransferError(QUIZ_INVALID_MESSAGE)
      continue
    }
    if (name !== MANIFEST_FILE && name !== CSV_FILE && !MEDIA_ENTRY.test(name)) {
      throw new TransferError(QUIZ_INVALID_MESSAGE)
    }
    fileEntries.add(name)
  }

  const manifestEntry = zip.files[MANIFEST_FILE]
  const csvEntry = zip.files[CSV_FILE]
  if (!manifestEntry || manifestEntry.dir || !csvEntry || csvEntry.dir) {
    throw new TransferError(QUIZ_INVALID_MESSAGE)
  }

  let rawManifest: unknown
  try {
    const bytes = await readCapped(manifestEntry, QUIZ_LIMITS.manifestBytes)
    rawManifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new TransferError(QUIZ_INVALID_MESSAGE)
  }
  const manifest = parseQuizManifest(rawManifest)

  // Liste exacte : chaque média annoncé existe, et rien d'autre n'accompagne le manifeste et le CSV.
  const announced = new Set(manifest.media.map((media) => media.file))
  fileEntries.delete(MANIFEST_FILE)
  fileEntries.delete(CSV_FILE)
  if (announced.size !== fileEntries.size || [...announced].some((name) => !fileEntries.has(name))) {
    throw new TransferError(QUIZ_INVALID_MESSAGE)
  }

  const csvBytes = await readCapped(csvEntry, manifest.csv.size)
  if (csvBytes.length !== manifest.csv.size || (await sha256Hex(csvBytes)) !== manifest.csv.sha256) {
    throw new TransferError(QUIZ_DAMAGED_MESSAGE)
  }
  let csvText: string
  try {
    csvText = new TextDecoder('utf-8', { fatal: true }).decode(csvBytes)
  } catch {
    throw new TransferError(QUIZ_INVALID_MESSAGE)
  }

  return {
    manifest,
    csvText,
    async readMedia(media) {
      const bytes = await readCapped(zip.files[media.file], media.size)
      if (bytes.length !== media.size || (await sha256Hex(bytes)) !== media.sha256) {
        throw new TransferError(QUIZ_DAMAGED_MESSAGE)
      }
      if (sniffMediaType(bytes) !== media.type) throw new TransferError(QUIZ_INVALID_MESSAGE)
      return bytes
    },
  }
}
