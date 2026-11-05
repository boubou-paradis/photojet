// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Export et import d'un quiz complet, entièrement dans le navigateur : les médias
// vont directement vers Supabase, sans passer par une fonction Vercel.
// Calqué sur mystery-transfer/transfer.ts, dont les fonctions génériques sont
// importées sans modification.

import type { createClient } from '@/lib/supabase'
import { compressAudio, needsAudioCompression } from '@/lib/audio-utils'
import { compressImage } from '@/lib/image-utils'
import { isImageType, localDate, normalizeName, sha256Hex, sniffMediaType } from '@/lib/games/mystery-transfer/format'
import { stripMetadata, verifyDecodable, type ImageSize } from '@/lib/games/mystery-transfer/media'
import type { QuizQuestion } from '@/types/database'
import { buildQuizArchive, openQuizArchive, tooBigMessage, type ArchiveFile } from './archive'
import {
  CSV_FILE,
  MO,
  QUIZ_FORMAT_ID,
  QUIZ_FORMAT_VERSION,
  QUIZ_INVALID_MESSAGE,
  QUIZ_LIMITS,
  PENALTIES,
  TransferError,
  buildQuizCsv,
  checkCsvMatchesManifest,
  checkExportableQuestion,
  fromTransferQuestion,
  parseQuizCsv,
  parseQuizManifest,
  photoStem,
  questionAudioStem,
  revealAudioStem,
  toTransferQuestion,
  type MediaRef,
  type MediaType,
  type QuizManifest,
  type TransferQuestion,
} from './format'

type Supabase = ReturnType<typeof createClient>
type Bytes = Uint8Array<ArrayBuffer>
export type TransferProgress = (done: number, total: number) => void

const BUCKET = 'photos'
const HEAD_CONCURRENCY = 6
const DOWNLOAD_CONCURRENCY = 4
const UPLOAD_CONCURRENCY = 3
// Marge pour les en-têtes du .zip, le manifeste et le CSV.
const ZIP_OVERHEAD_BYTES = 512 * 1024

// Photos : mêmes seuils que l'import Photo Mystère, réglages de l'envoi d'une photo du Quiz.
const COMPRESS_ABOVE_BYTES = 2 * MO
const COMPRESS_ABOVE_SIDE = 1920
const IMAGE_COMPRESSION = { maxSizeMB: 1, maxWidthOrHeight: 1920, initialQuality: 0.85 }

export const QUIZ_EXPORT_NOTICE = 'Partagez uniquement des photos et des musiques dont vous avez les droits.'
export const QUIZ_IMPORT_FAILED_MESSAGE = "L'import a échoué. Votre quiz n'a pas été modifié."
export const QUIZ_RUNNING_MESSAGE = "Une partie est en cours. Quittez-la avant d'importer."

export type StoredQuestion = QuizQuestion & { audioFileName?: string | null }

export interface QuizSnapshot {
  questions: StoredQuestion[]
  /** Lobby ouvert ou quiz lancé. */
  running: boolean
}

function parseStoredQuestions(raw: unknown): StoredQuestion[] {
  if (typeof raw !== 'string' || raw === '') return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((q): q is StoredQuestion => typeof q === 'object' && q !== null)
  } catch {
    return []
  }
}

/** Le quiz tel qu'il est en base, jamais l'état local de la page. */
export async function readQuizSnapshot(supabase: Supabase, sessionId: string): Promise<QuizSnapshot> {
  const { data, error } = await supabase
    .from('sessions')
    .select('quiz_questions, quiz_active, quiz_lobby_visible')
    .eq('id', sessionId)
    .single()
  if (error || !data) throw new TransferError('Impossible de relire le quiz. Réessayez.')
  return {
    questions: parseStoredQuestions(data.quiz_questions),
    running: data.quiz_active === true || data.quiz_lobby_visible === true,
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

type MediaKind = 'questionAudio' | 'revealAudio' | 'photo'

interface ExportItem {
  url: string
  label: string
  stem: string
  kind: MediaKind
}

const KIND_LABELS: Record<MediaKind, string> = {
  questionAudio: "l'audio de la question",
  revealAudio: "l'audio de la réponse",
  photo: 'la photo',
}

function publicPrefix(supabase: Supabase): string {
  return supabase.storage.from(BUCKET).getPublicUrl('x').data.publicUrl.slice(0, -1)
}

export function exportItems(questions: StoredQuestion[], prefix: string): ExportItem[] {
  const items: ExportItem[] = []
  questions.forEach((q, index) => {
    const entries: [MediaKind, unknown, string][] = [
      ['questionAudio', q.questionAudioUrl, questionAudioStem(index)],
      ['revealAudio', q.audioUrl, revealAudioStem(index)],
      ['photo', q.photoUrl, photoStem(index)],
    ]
    for (const [kind, url, stem] of entries) {
      if (url === null || url === undefined || url === '') continue
      const label = `Question ${index + 1} : ${KIND_LABELS[kind]}`
      if (typeof url !== 'string' || url.startsWith('blob:')) {
        throw new TransferError(`${label} n'a pas été enregistré(e) sur le serveur. Remplacez-le(la) avant d'exporter.`)
      }
      // Seuls les fichiers du stockage AnimaJet sont téléchargés.
      if (!url.startsWith(prefix) || url.length === prefix.length) {
        throw new TransferError(`${label} : fichier inconnu. Remplacez-le(la) avant d'exporter.`)
      }
      items.push({ url, label, stem, kind })
    }
  })
  return items
}

export function exportFileName(name: string, date: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '')
  return `Quiz-${slug || 'quiz'}-${date}.zip`
}

/** Taille annoncée par le serveur, sans télécharger. Null si inconnue. */
async function remoteSize(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (!response.ok) return null
    const length = Number(response.headers.get('content-length'))
    return Number.isSafeInteger(length) && length > 0 ? length : null
  } catch {
    return null
  }
}

async function convertForExport(original: Bytes, item: ExportItem): Promise<{ bytes: Bytes; type: MediaType }> {
  const sniffed = sniffMediaType(original)
  const wantImage = item.kind === 'photo'
  if (sniffed && isImageType(sniffed) === wantImage) return { bytes: original, type: sniffed }

  // Format non accepté dans le .zip (m4a, gif…) : conversion par les fonctions
  // existantes, uniquement dans ce cas. Leur résultat est revérifié.
  const file = new File([original], 'media', { type: '' })
  const converted = wantImage
    ? await compressImage(file, undefined, IMAGE_COMPRESSION)
    : await compressAudio(file)
  const bytes = new Uint8Array(await converted.arrayBuffer())
  const type = sniffMediaType(bytes)
  if (!type || isImageType(type) !== wantImage) {
    throw new TransferError(`${item.label} : format non pris en charge, remplacez le fichier avant d'exporter.`)
  }
  return { bytes, type }
}

async function prepareExportItem(item: ExportItem, budget: { used: number }): Promise<ArchiveFile & { media: MediaRef }> {
  let response: Response
  try {
    response = await fetch(item.url)
  } catch {
    throw new TransferError(`${item.label} : téléchargement impossible. Vérifiez votre connexion.`)
  }
  if (!response.ok) throw new TransferError(`${item.label} : fichier introuvable, remplacez-le avant d'exporter.`)

  const original = new Uint8Array(await response.arrayBuffer())
  budget.used += original.length
  if (budget.used > QUIZ_LIMITS.zipBytes) throw new TransferError(tooBigMessage(budget.used))

  const { bytes: raw, type } = await convertForExport(original, item)
  const bytes = stripMetadata(raw, type, item.label)
  const maxBytes = item.kind === 'photo' ? QUIZ_LIMITS.photoBytes : QUIZ_LIMITS.audioBytes
  if (bytes.length > maxBytes) {
    throw new TransferError(`${item.label} : fichier trop volumineux (${maxBytes / MO} Mo maximum).`)
  }

  // Le fichier produit doit être accepté par l'import : même contrôle des deux côtés.
  await verifyDecodable(new Blob([bytes], { type }), type, `${item.label} : fichier illisible.`)

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg' }[type]
  const file = `${item.stem}.${ext}`
  return { file, bytes, media: { file, type, size: bytes.length, sha256: await sha256Hex(bytes) } }
}

export interface ExportResult {
  blob: Blob
  fileName: string
}

export async function exportQuiz(options: {
  supabase: Supabase
  sessionId: string
  name: string
  penaltyPoints: number
  now?: Date
  onProgress?: TransferProgress
}): Promise<ExportResult> {
  const { supabase, sessionId, onProgress } = options
  const name = normalizeName(options.name)
  if (name === null) {
    throw new TransferError(`Donnez un nom à votre quiz (${QUIZ_LIMITS.nameLength} caractères maximum).`)
  }
  const penaltyPoints = PENALTIES.find((p) => p === options.penaltyPoints) ?? 0

  const { questions } = await readQuizSnapshot(supabase, sessionId)
  if (questions.length === 0) throw new TransferError('Ajoutez au moins une question avant d’exporter.')
  if (questions.length > QUIZ_LIMITS.questions) {
    throw new TransferError(
      `Ce quiz compte ${questions.length} questions, au-delà de la limite de ${QUIZ_LIMITS.questions}. Divisez-le en plusieurs quiz et exportez-les séparément.`
    )
  }

  // Contrôles rapides avant tout téléchargement.
  const items = exportItems(questions, publicPrefix(supabase))
  const noFiles = { revealAudio: null, questionAudio: null, photo: null }
  questions.forEach((q, index) => checkExportableQuestion(toTransferQuestion(q, noFiles), index))

  // Taille totale annoncée par le serveur : un quiz trop gros est refusé avant
  // d'être téléchargé, jamais après un plantage du navigateur.
  const sizes: (number | null)[] = new Array(items.length).fill(null)
  await forEachLimit(items, HEAD_CONCURRENCY, async (item, index) => {
    sizes[index] = await remoteSize(item.url)
  })
  const announced = sizes.reduce<number>((sum, size) => sum + (size ?? 0), 0)
  if (announced + ZIP_OVERHEAD_BYTES > QUIZ_LIMITS.zipBytes) throw new TransferError(tooBigMessage(announced))

  const prepared: (ArchiveFile & { media: MediaRef })[] = new Array(items.length)
  const budget = { used: 0 }
  let done = 0
  onProgress?.(0, items.length)
  await forEachLimit(items, DOWNLOAD_CONCURRENCY, async (item, index) => {
    prepared[index] = await prepareExportItem(item, budget)
    onProgress?.(++done, items.length)
  })

  const fileOf = new Map(items.map((item, index) => [`${item.stem}`, prepared[index].file]))
  const transferQuestions: TransferQuestion[] = questions.map((q, index) =>
    toTransferQuestion(q, {
      questionAudio: fileOf.get(questionAudioStem(index)) ?? null,
      revealAudio: fileOf.get(revealAudioStem(index)) ?? null,
      photo: fileOf.get(photoStem(index)) ?? null,
    })
  )
  transferQuestions.forEach(checkExportableQuestion)

  const csvText = buildQuizCsv(transferQuestions)
  const csvBytes = new TextEncoder().encode(csvText) as Bytes
  const date = localDate(options.now ?? new Date())
  const manifest: QuizManifest = parseQuizManifest({
    format: QUIZ_FORMAT_ID,
    formatVersion: QUIZ_FORMAT_VERSION,
    exportedOn: date,
    name,
    settings: { penaltyPoints },
    csv: { file: CSV_FILE, size: csvBytes.length, sha256: await sha256Hex(csvBytes) },
    media: prepared.map((p) => p.media),
  } satisfies QuizManifest)

  // Le fichier produit doit se relire : même lecture que l'import.
  checkCsvMatchesManifest(parseQuizCsv(csvText), manifest)

  const total = prepared.reduce((sum, p) => sum + p.bytes.length, csvBytes.length)
  if (total + ZIP_OVERHEAD_BYTES > QUIZ_LIMITS.zipBytes) throw new TransferError(tooBigMessage(total))

  const archive = await buildQuizArchive(manifest, csvBytes, prepared)
  if (archive.length > QUIZ_LIMITS.zipBytes) throw new TransferError(tooBigMessage(archive.length))
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

export interface PreparedQuizImport {
  manifest: QuizManifest
  questions: TransferQuestion[]
  media: Map<string, PreparedMedia>
  totalBytes: number
  audioCount: number
  photoCount: number
}

/** Contrôle tout le fichier, sans rien écrire. Le quiz en cours n'est pas touché. */
export async function prepareQuizImport(file: File, onProgress?: TransferProgress): Promise<PreparedQuizImport> {
  const archive = await openQuizArchive(file)
  const questions = parseQuizCsv(archive.csvText)
  checkCsvMatchesManifest(questions, archive.manifest)

  const list = archive.manifest.media
  const media = new Map<string, PreparedMedia>()
  onProgress?.(0, list.length)
  for (const [index, ref] of list.entries()) {
    const bytes = await archive.readMedia(ref)
    const size = await verifyDecodable(new Blob([bytes], { type: ref.type }), ref.type, QUIZ_INVALID_MESSAGE)
    media.set(ref.file, { media: ref, bytes, size })
    onProgress?.(index + 1, list.length)
  }

  return {
    manifest: archive.manifest,
    questions,
    media,
    totalBytes: file.size,
    audioCount: list.filter((m) => m.file.startsWith('audio/')).length,
    photoCount: list.filter((m) => m.file.startsWith('photos/')).length,
  }
}

interface ReadyFile {
  file: File
  type: MediaType
}

// compressImage et compressAudio rendent le fichier d'origine en cas d'échec :
// le type du résultat est revérifié, jamais supposé.
async function checkCompressed(result: File, original: File, originalType: MediaType): Promise<ReadyFile> {
  const head = new Uint8Array(await result.slice(0, 16).arrayBuffer())
  const type = sniffMediaType(head)
  if (!type || isImageType(type) !== isImageType(originalType)) return { file: original, type: originalType }
  return { file: new File([result], result.name, { type }), type }
}

/** Compression uniquement si nécessaire, avec les mêmes fonctions que l'éditeur du Quiz. */
async function finalizeMedia({ media, bytes, size }: PreparedMedia): Promise<ReadyFile> {
  const original = new File([bytes], media.file.split('/').pop()!, { type: media.type })
  if (size) {
    if (bytes.length <= COMPRESS_ABOVE_BYTES && Math.max(size.width, size.height) <= COMPRESS_ABOVE_SIDE) {
      return { file: original, type: media.type }
    }
    return checkCompressed(await compressImage(original, undefined, IMAGE_COMPRESSION), original, media.type)
  }
  if (media.type === 'audio/mpeg' || !needsAudioCompression(original)) return { file: original, type: media.type }
  return checkCompressed(await compressAudio(original), original, media.type)
}

const EXTENSIONS: Record<MediaType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
}

/** Mêmes dossiers et même forme de nom que l'envoi d'un média depuis l'éditeur. */
export function storagePath(sessionId: string, file: string, questionId: string, type: MediaType, stamp: number): string {
  const folder = file.startsWith('photos/')
    ? 'quiz-photos'
    : file.endsWith(`-question.${file.split('.').pop()}`)
      ? 'quiz-question-audio'
      : 'quiz-audio'
  return `${folder}/${sessionId}_${questionId}_${stamp}.${EXTENSIONS[type]}`
}

async function removeUploaded(supabase: Supabase, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) console.error('Quiz import rollback error:', error)
}

export interface QuizImportResult {
  questions: QuizQuestion[]
  penaltyPoints: number
}

/**
 * Tout ou rien : le quiz en cours ne change qu'à la dernière écriture, une seule
 * mise à jour de `sessions.quiz_questions`. Avant elle, chaque échec retire les
 * fichiers envoyés. Les fichiers de l'ancien quiz ne sont jamais supprimés : ils
 * peuvent servir à un quiz de la bibliothèque.
 */
export async function applyQuizImport(options: {
  supabase: Supabase
  sessionId: string
  prepared: PreparedQuizImport
  onProgress?: TransferProgress
  now?: () => number
}): Promise<QuizImportResult> {
  const { supabase, sessionId, prepared, onProgress } = options
  const before = await readQuizSnapshot(supabase, sessionId)
  if (before.running) throw new TransferError(QUIZ_RUNNING_MESSAGE)

  const stamp = (options.now ?? Date.now)()
  const questionIds = prepared.questions.map((_, index) => `${stamp}_${index}`)
  const ownerIndex = new Map<string, number>()
  prepared.questions.forEach((q, index) => {
    for (const file of [q.questionAudio, q.revealAudio, q.photo]) if (file) ownerIndex.set(file, index)
  })

  const refs = prepared.manifest.media
  const urls = new Map<string, string>()
  const uploaded: string[] = []
  let done = 0
  onProgress?.(0, refs.length)

  try {
    await forEachLimit(refs, UPLOAD_CONCURRENCY, async (ref) => {
      const { file, type } = await finalizeMedia(prepared.media.get(ref.file)!)
      const path = storagePath(sessionId, ref.file, questionIds[ownerIndex.get(ref.file)!], type, stamp)
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: type })
      if (error) throw error
      uploaded.push(path)
      urls.set(ref.file, supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl)
      onProgress?.(++done, refs.length)
    })
  } catch (error) {
    console.error('Quiz import upload error:', error)
    await removeUploaded(supabase, uploaded)
    throw new TransferError(QUIZ_IMPORT_FAILED_MESSAGE)
  }

  const questions = prepared.questions.map((q, index) =>
    fromTransferQuestion(q, questionIds[index], (file) => urls.get(file)!)
  )
  const questionsJson = JSON.stringify(questions)

  const { data: updated, error: updateError } = await supabase
    .from('sessions')
    .update({ quiz_questions: questionsJson })
    .eq('id', sessionId)
    // Une partie lancée depuis un autre onglet entre-temps n'est jamais écrasée.
    .not('quiz_active', 'is', true)
    .not('quiz_lobby_visible', 'is', true)
    .select('id')

  if (updateError) {
    // Réponse perdue : l'écriture a pu passer. Retirer les fichiers casserait alors le
    // quiz importé, donc on ne les retire que si la base confirme l'échec.
    const { data: current } = await supabase
      .from('sessions')
      .select('quiz_questions')
      .eq('id', sessionId)
      .single()
    const written = current?.quiz_questions === questionsJson
    if (current && !written) await removeUploaded(supabase, uploaded)
    if (!written) throw new TransferError(QUIZ_IMPORT_FAILED_MESSAGE)
  } else if (!updated || updated.length === 0) {
    await removeUploaded(supabase, uploaded)
    throw new TransferError(QUIZ_RUNNING_MESSAGE)
  }

  return { questions, penaltyPoints: prepared.manifest.settings.penaltyPoints }
}

export interface ExportAccess {
  blocked: boolean
  message?: string
}

/** En cas d'erreur de vérification : pas de blocage. */
export async function checkQuizExportAccess(): Promise<ExportAccess> {
  try {
    const response = await fetch('/api/quiz/export-access')
    if (!response.ok) return { blocked: false }
    const data: ExportAccess = await response.json()
    return data.blocked === true ? data : { blocked: false }
  } catch {
    return { blocked: false }
  }
}
