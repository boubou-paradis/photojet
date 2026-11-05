// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Format du fichier d'échange Quiz : un .zip avec quiz.csv (lisible dans Excel),
// manifest.json et les médias. Logique pure : le fichier vient d'un inconnu,
// rien de ce qu'il contient n'est cru sans contrôle.
//
// Les fonctions génériques (empreinte, type réel, nom, date) viennent du module
// Photo Mystère, importées sans modification.

import {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  MO,
  TransferError,
  mediaFileName,
  normalizeName,
  type MediaRef,
  type MediaType,
} from '@/lib/games/mystery-transfer/format'
import type { QuizQuestion } from '@/types/database'

export { MO, TransferError, type MediaRef, type MediaType }

export const QUIZ_LIMITS = {
  zipBytes: 400 * MO,
  questions: 100,
  photoBytes: 5 * MO,
  audioBytes: 20 * MO,
  // manifeste + quiz.csv + 2 dossiers + 3 médias par question
  entries: 305,
  manifestBytes: 256 * 1024,
  csvBytes: 2 * MO,
  nameLength: 80,
  questionLength: 300,
  answerLength: 120,
  audioNameLength: 120,
  // 24 h : borne haute d'une découpe, au-delà le nombre est absurde.
  trimSeconds: 86400,
  minTime: 5,
  maxTime: 120,
  maxPoints: 1000,
} as const

export const MANIFEST_FILE = 'manifest.json'
export const CSV_FILE = 'quiz.csv'
export const QUIZ_FORMAT_ID = 'animajet-quiz'
export const QUIZ_FORMAT_VERSION = 1

export const PENALTIES = [0, 1, 2, 5, 10] as const
export const REVEAL_DURATIONS = [5, 10, 15, 20, -1] as const

export const QUIZ_INVALID_MESSAGE = "Ce fichier n'est pas un quiz AnimaJet valide."
export const QUIZ_DAMAGED_MESSAGE = 'Ce fichier est abîmé. Demandez à la personne de vous le renvoyer.'
export const QUIZ_NEWER_VERSION_MESSAGE =
  "Ce fichier a été créé avec une version plus récente d'AnimaJet. Rechargez la page et réessayez."

// Colonnes de quiz.csv. Les 9 premières sont celles de l'export historique, dans
// le même ordre : un quiz.csv extrait du .zip reste lisible par l'ancien import.
export const CSV_COLUMNS = [
  'question',
  'reponse1',
  'reponse2',
  'reponse3',
  'reponse4',
  'bonne_reponse',
  'temps',
  'points',
  'fichier_audio',
  'nom_audio',
  'audio_debut',
  'audio_fin',
  'audio_question',
  'nom_audio_question',
  'audio_question_debut',
  'audio_question_fin',
  'photo',
  'duree_revelation',
] as const

export interface CsvRef {
  file: typeof CSV_FILE
  size: number
  sha256: string
}

export interface QuizManifest {
  format: typeof QUIZ_FORMAT_ID
  formatVersion: typeof QUIZ_FORMAT_VERSION
  exportedOn: string
  name: string
  settings: { penaltyPoints: number }
  csv: CsvRef
  media: MediaRef[]
}

/** Une question telle qu'elle voyage dans le fichier : les médias sont des noms de fichiers du .zip. */
export interface TransferQuestion {
  question: string
  answers: [string, string, string, string]
  correctAnswer: number
  timeLimit: number
  points: number
  revealAudio: string | null
  revealAudioName: string | null
  revealAudioStart: number | null
  revealAudioEnd: number | null
  questionAudio: string | null
  questionAudioName: string | null
  questionAudioStart: number | null
  questionAudioEnd: number | null
  photo: string | null
  revealDuration: number | null
}

function fail(): never {
  throw new TransferError(QUIZ_INVALID_MESSAGE)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Clés exactes, sans clé en trop : couvre aussi `__proto__`, que JSON.parse crée comme une vraie clé.
function expectKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const found = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (found.length !== expected.length || found.some((key, i) => key !== expected[i])) fail()
}

export function questionStem(index: number): string {
  return String(index + 1).padStart(3, '0')
}

export function revealAudioStem(index: number): string {
  return `audio/${questionStem(index)}-revelation`
}

export function questionAudioStem(index: number): string {
  return `audio/${questionStem(index)}-question`
}

export function photoStem(index: number): string {
  return `photos/${questionStem(index)}`
}

/** Seules entrées admises dans le .zip, en plus du manifeste et de quiz.csv. */
export const MEDIA_ENTRY = /^(?:photos\/\d{3}\.(?:jpg|png|webp)|audio\/\d{3}-(?:question|revelation)\.(?:mp3|wav|ogg))$/
export const ALLOWED_FOLDERS: ReadonlySet<string> = new Set(['photos/', 'audio/'])

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

function isSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function parseMediaRef(value: unknown): MediaRef {
  if (!isRecord(value)) fail()
  expectKeys(value, ['file', 'type', 'size', 'sha256'])
  const { file, type, size, sha256 } = value
  if (typeof file !== 'string' || !MEDIA_ENTRY.test(file)) fail()
  const isPhoto = file.startsWith('photos/')
  const extensions: Record<string, string> = isPhoto ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS
  if (typeof type !== 'string' || !Object.hasOwn(extensions, type)) fail()
  if (file !== mediaFileName(file.slice(0, file.lastIndexOf('.')), type as MediaType)) fail()
  if (!isSize(size) || !isSha256(sha256)) fail()
  const maxBytes = isPhoto ? QUIZ_LIMITS.photoBytes : QUIZ_LIMITS.audioBytes
  if (size > maxBytes) {
    throw new TransferError(
      `Un fichier de ce quiz dépasse la taille autorisée (${Math.round(maxBytes / MO)} Mo).`
    )
  }
  return { file, type: type as MediaType, size, sha256 }
}

export function parseQuizManifest(value: unknown): QuizManifest {
  if (!isRecord(value)) fail()
  if (value.format !== QUIZ_FORMAT_ID) fail()
  const version = value.formatVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) fail()
  if (version > QUIZ_FORMAT_VERSION) throw new TransferError(QUIZ_NEWER_VERSION_MESSAGE)

  expectKeys(value, ['format', 'formatVersion', 'exportedOn', 'name', 'settings', 'csv', 'media'])
  const { exportedOn, settings, csv, media } = value
  if (typeof exportedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(exportedOn)) fail()
  const name = normalizeName(value.name)
  if (name === null) fail()

  if (!isRecord(settings)) fail()
  expectKeys(settings, ['penaltyPoints'])
  const penaltyPoints = PENALTIES.find((p) => p === settings.penaltyPoints)
  if (penaltyPoints === undefined) fail()

  if (!isRecord(csv)) fail()
  expectKeys(csv, ['file', 'size', 'sha256'])
  if (csv.file !== CSV_FILE || !isSize(csv.size) || !isSha256(csv.sha256)) fail()
  if (csv.size > QUIZ_LIMITS.csvBytes) fail()

  if (!Array.isArray(media) || media.length > QUIZ_LIMITS.questions * 3) fail()
  const parsedMedia = media.map(parseMediaRef)
  if (new Set(parsedMedia.map((m) => m.file)).size !== parsedMedia.length) fail()

  const total = parsedMedia.reduce((sum, m) => sum + m.size, csv.size)
  if (total > QUIZ_LIMITS.zipBytes) {
    throw new TransferError(`Ce quiz dépasse la taille autorisée (${QUIZ_LIMITS.zipBytes / MO} Mo).`)
  }

  return {
    format: QUIZ_FORMAT_ID,
    formatVersion: QUIZ_FORMAT_VERSION,
    exportedOn,
    name,
    settings: { penaltyPoints },
    csv: { file: CSV_FILE, size: csv.size, sha256: csv.sha256 },
    media: parsedMedia,
  }
}

// ---------- quiz.csv : écriture ----------

function escapeField(value: string): string {
  if (value === '') return ''
  // Entre guillemets dès qu'un caractère pourrait être mal relu : séparateur,
  // guillemet, retour à la ligne, ou espace en bord (Excel et l'ancien lecteur l'ôtent).
  if (/[;"\r\n]/.test(value) || value !== value.trim()) return `"${value.replace(/"/g, '""')}"`
  return value
}

function formatSeconds(value: number | null): string {
  if (value === null) return ''
  return String(Math.round(value * 1000) / 1000)
}

/** quiz.csv en UTF-8 avec BOM (pour Excel), séparateur `;`, lignes CRLF. */
export function buildQuizCsv(questions: TransferQuestion[]): string {
  const lines = [CSV_COLUMNS.join(';')]
  for (const q of questions) {
    const cells = [
      q.question,
      ...q.answers,
      String(q.correctAnswer + 1),
      String(q.timeLimit),
      String(q.points),
      q.revealAudio ?? '',
      q.revealAudio ? (q.revealAudioName ?? '') : '',
      q.revealAudio ? formatSeconds(q.revealAudioStart) : '',
      q.revealAudio ? formatSeconds(q.revealAudioEnd) : '',
      q.questionAudio ?? '',
      q.questionAudio ? (q.questionAudioName ?? '') : '',
      q.questionAudio ? formatSeconds(q.questionAudioStart) : '',
      q.questionAudio ? formatSeconds(q.questionAudioEnd) : '',
      q.photo ?? '',
      q.revealDuration === null ? '' : String(q.revealDuration),
    ]
    lines.push(cells.map(escapeField).join(';'))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}

// ---------- quiz.csv : lecture ----------

/**
 * Découpe un CSV `;` en enregistrements, guillemets RFC 4180 compris : un retour
 * à la ligne entre guillemets reste dans le champ (l'ancien lecteur le perdait).
 */
export function splitCsvRecords(text: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let inQuotes = false
  let quotedField = false
  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += char
      i++
      continue
    }
    if (char === '"') {
      // Un guillemet n'ouvre un champ qu'en tout début de champ.
      if (field !== '' || quotedField) fail()
      inQuotes = true
      quotedField = true
      i++
      continue
    }
    if (char === ';') {
      record.push(field)
      field = ''
      quotedField = false
      i++
      continue
    }
    if (char === '\r' || char === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
      quotedField = false
      i += char === '\r' && text[i + 1] === '\n' ? 2 : 1
      continue
    }
    // Rien n'est admis après le guillemet fermant, sauf séparateur ou fin de ligne.
    if (quotedField) fail()
    field += char
    i++
  }
  if (inQuotes) fail()
  if (field !== '' || record.length > 0) {
    record.push(field)
    records.push(record)
  }
  // Retours à la ligne entre guillemets normalisés.
  return records.map((r) => r.map((value) => value.replace(/\r\n?/g, '\n')))
}

// Caractères de contrôle refusés, sauf tabulation et retour à la ligne si admis.
function hasControl(value: string, allowNewline: boolean): boolean {
  const pattern = allowNewline ? /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/ : /[\u0000-\u0008\u000a-\u001f\u007f-\u009f]/
  return pattern.test(value)
}

export function checkText(value: string, maxLength: number, allowNewline: boolean): boolean {
  return value.trim() !== '' && value.length <= maxLength && !hasControl(value, allowNewline)
}

function parseInteger(value: string, min: number, max: number): number {
  if (!/^-?\d{1,6}$/.test(value)) fail()
  const n = Number(value)
  if (n < min || n > max) fail()
  return n
}

function parseSeconds(value: string): number | null {
  if (value === '') return null
  if (!/^\d{1,5}(?:[.,]\d{1,3})?$/.test(value)) fail()
  const n = Number(value.replace(',', '.'))
  if (n > QUIZ_LIMITS.trimSeconds) fail()
  return n
}

function parseTrim(start: string, end: string): [number | null, number | null] {
  const s = parseSeconds(start)
  const e = parseSeconds(end)
  if (s !== null && e !== null && s >= e) fail()
  return [s, e]
}

function parseMediaCell(value: string, stem: string, images: boolean): string | null {
  if (value === '') return null
  const extensions = images ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS
  if (!Object.values(extensions).some((ext) => value === `${stem}.${ext}`)) fail()
  return value
}

function parseAudioName(value: string): string | null {
  if (value === '') return null
  if (!checkText(value, QUIZ_LIMITS.audioNameLength, false)) fail()
  return value
}

/** Lit quiz.csv (déjà vérifié par son empreinte). Toute valeur hors règle refuse le fichier. */
export function parseQuizCsv(text: string): TransferQuestion[] {
  const records = splitCsvRecords(text.startsWith('﻿') ? text.slice(1) : text)
  // Lignes entièrement vides ignorées (Excel en ajoute parfois à la fin).
  const rows = records.filter((r) => !(r.length === 1 && r[0] === ''))
  if (rows.length < 2) fail()

  const header = rows[0]
  if (header.length < 9 || header.length > CSV_COLUMNS.length) fail()
  if (header.some((name, i) => name !== CSV_COLUMNS[i])) fail()

  const body = rows.slice(1)
  if (body.length > QUIZ_LIMITS.questions) {
    throw new TransferError(`Un quiz ne peut pas dépasser ${QUIZ_LIMITS.questions} questions.`)
  }

  return body.map((row, index) => {
    if (row.length !== header.length) fail()
    const cell = (name: (typeof CSV_COLUMNS)[number]) => {
      const i = header.indexOf(name)
      return i < 0 ? '' : row[i]
    }

    const question = cell('question')
    if (!checkText(question, QUIZ_LIMITS.questionLength, true)) fail()
    const answers = [cell('reponse1'), cell('reponse2'), cell('reponse3'), cell('reponse4')] as [
      string,
      string,
      string,
      string,
    ]
    if (answers.some((a) => !checkText(a, QUIZ_LIMITS.answerLength, true))) fail()

    const correctAnswer = parseInteger(cell('bonne_reponse'), 1, 4) - 1
    const timeLimit = parseInteger(cell('temps'), QUIZ_LIMITS.minTime, QUIZ_LIMITS.maxTime)
    const points = parseInteger(cell('points'), 1, QUIZ_LIMITS.maxPoints)

    const revealAudio = parseMediaCell(cell('fichier_audio'), revealAudioStem(index), false)
    const revealAudioName = parseAudioName(cell('nom_audio'))
    const [revealAudioStart, revealAudioEnd] = parseTrim(cell('audio_debut'), cell('audio_fin'))
    if (!revealAudio && (revealAudioName || revealAudioStart !== null || revealAudioEnd !== null)) fail()

    const questionAudio = parseMediaCell(cell('audio_question'), questionAudioStem(index), false)
    const questionAudioName = parseAudioName(cell('nom_audio_question'))
    const [questionAudioStart, questionAudioEnd] = parseTrim(
      cell('audio_question_debut'),
      cell('audio_question_fin')
    )
    if (!questionAudio && (questionAudioName || questionAudioStart !== null || questionAudioEnd !== null)) fail()

    const photo = parseMediaCell(cell('photo'), photoStem(index), true)

    const durationCell = cell('duree_revelation')
    let revealDuration: number | null = null
    if (durationCell !== '') {
      revealDuration = parseInteger(durationCell, -1, 20)
      if (!REVEAL_DURATIONS.some((d) => d === revealDuration)) fail()
    }

    return {
      question,
      answers,
      correctAnswer,
      timeLimit,
      points,
      revealAudio,
      revealAudioName,
      revealAudioStart,
      revealAudioEnd,
      questionAudio,
      questionAudioName,
      questionAudioStart,
      questionAudioEnd,
      photo,
      revealDuration,
    }
  })
}

/** Fichiers médias cités par le CSV, dans l'ordre. */
export function csvMediaFiles(questions: TransferQuestion[]): string[] {
  return questions.flatMap((q) => [q.questionAudio, q.revealAudio, q.photo].filter((f): f is string => f !== null))
}

/** Le CSV et le manifeste citent exactement les mêmes médias, et rien d'autre. */
export function checkCsvMatchesManifest(questions: TransferQuestion[], manifest: QuizManifest): void {
  const cited = csvMediaFiles(questions)
  const announced = new Set(manifest.media.map((m) => m.file))
  if (cited.length !== announced.size || cited.some((file) => !announced.has(file))) fail()
}

// ---------- Conversion avec la structure du jeu ----------

type StoredQuestion = QuizQuestion & { audioFileName?: string | null }

function trimValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** Nom affiché d'une piste (souvent un nom de fichier) : une ligne, longueur bornée. */
export function cleanAudioName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .trim()
    .slice(0, QUIZ_LIMITS.audioNameLength)
    .trim()
  return name === '' ? null : name
}

/**
 * Question du jeu → question du fichier. `media` donne le nom de fichier retenu
 * pour chaque adresse (null si la question n'a pas ce média).
 */
export function toTransferQuestion(
  q: StoredQuestion,
  files: { revealAudio: string | null; questionAudio: string | null; photo: string | null }
): TransferQuestion {
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  const answers = [0, 1, 2, 3].map((i) => text(q.answers?.[i])) as [string, string, string, string]
  return {
    question: text(q.question),
    answers,
    correctAnswer: q.correctAnswer,
    timeLimit: q.timeLimit,
    points: q.points,
    revealAudio: files.revealAudio,
    revealAudioName: files.revealAudio ? cleanAudioName(q.audioFileName) : null,
    revealAudioStart: files.revealAudio ? trimValue(q.audioStart) : null,
    revealAudioEnd: files.revealAudio ? trimValue(q.audioEnd) : null,
    questionAudio: files.questionAudio,
    questionAudioName: files.questionAudio ? cleanAudioName(q.questionAudioName) : null,
    questionAudioStart: files.questionAudio ? trimValue(q.questionAudioStart) : null,
    questionAudioEnd: files.questionAudio ? trimValue(q.questionAudioEnd) : null,
    photo: files.photo,
    revealDuration: typeof q.revealDuration === 'number' ? q.revealDuration : null,
  }
}

/** Question du fichier → question du jeu, avec les adresses des médias envoyés. */
export function fromTransferQuestion(
  q: TransferQuestion,
  id: string,
  urlOf: (file: string) => string
): StoredQuestion {
  const stored: StoredQuestion = {
    id,
    question: q.question,
    answers: [...q.answers],
    correctAnswer: q.correctAnswer,
    timeLimit: q.timeLimit,
    points: q.points,
  }
  if (q.revealAudio) {
    stored.audioUrl = urlOf(q.revealAudio)
    if (q.revealAudioName) stored.audioFileName = q.revealAudioName
    stored.audioStart = q.revealAudioStart
    stored.audioEnd = q.revealAudioEnd
  }
  if (q.questionAudio) {
    stored.questionAudioUrl = urlOf(q.questionAudio)
    stored.questionAudioName = q.questionAudioName
    stored.questionAudioStart = q.questionAudioStart
    stored.questionAudioEnd = q.questionAudioEnd
  }
  if (q.photo) stored.photoUrl = urlOf(q.photo)
  if (q.revealDuration !== null) stored.revealDuration = q.revealDuration
  return stored
}

/** Contrôle à l'export, question par question, avec un message qui la nomme. */
export function checkExportableQuestion(q: TransferQuestion, index: number): void {
  const label = `Question ${index + 1}`
  if (!checkText(q.question, QUIZ_LIMITS.questionLength, true)) {
    throw new TransferError(
      q.question.trim() === ''
        ? `${label} : le texte est vide.`
        : `${label} : texte trop long ou caractère non pris en charge (${QUIZ_LIMITS.questionLength} caractères maximum).`
    )
  }
  if (q.answers.some((a) => !checkText(a, QUIZ_LIMITS.answerLength, true))) {
    throw new TransferError(
      `${label} : une réponse est vide ou trop longue (${QUIZ_LIMITS.answerLength} caractères maximum).`
    )
  }
  if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer > 3) {
    throw new TransferError(`${label} : bonne réponse invalide.`)
  }
  if (!Number.isInteger(q.timeLimit) || q.timeLimit < QUIZ_LIMITS.minTime || q.timeLimit > QUIZ_LIMITS.maxTime) {
    throw new TransferError(`${label} : temps invalide.`)
  }
  if (!Number.isInteger(q.points) || q.points < 1 || q.points > QUIZ_LIMITS.maxPoints) {
    throw new TransferError(`${label} : points invalides.`)
  }
  if (q.revealDuration !== null && !REVEAL_DURATIONS.some((d) => d === q.revealDuration)) {
    throw new TransferError(`${label} : durée d'affichage de la réponse invalide.`)
  }
  const badTrim = (start: number | null, end: number | null) =>
    [start, end].some((v) => v !== null && v > QUIZ_LIMITS.trimSeconds) ||
    (start !== null && end !== null && Math.round(start * 1000) >= Math.round(end * 1000))
  if (badTrim(q.revealAudioStart, q.revealAudioEnd)) {
    throw new TransferError(`${label} : découpe de l'audio de la réponse invalide, refaites-la.`)
  }
  if (badTrim(q.questionAudioStart, q.questionAudioEnd)) {
    throw new TransferError(`${label} : découpe de l'audio de la question invalide, refaites-la.`)
  }
}
