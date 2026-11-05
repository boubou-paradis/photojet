// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import JSZip from 'jszip'
import { AUDIO, PHOTO, mediaRef, textBytes } from '@/lib/games/mystery-transfer/__tests__/fixtures'
import {
  CSV_FILE,
  QUIZ_FORMAT_ID,
  QUIZ_FORMAT_VERSION,
  buildQuizCsv,
  type QuizManifest,
  type TransferQuestion,
} from '../format'

export { AUDIO, PHOTO, mediaRef, textBytes }

export function question(overrides: Partial<TransferQuestion> = {}): TransferQuestion {
  return {
    question: 'Capitale de l’Australie ?',
    answers: ['Sydney', 'Canberra', 'Melbourne', 'Perth'],
    correctAnswer: 1,
    timeLimit: 15,
    points: 5,
    revealAudio: null,
    revealAudioName: null,
    revealAudioStart: null,
    revealAudioEnd: null,
    questionAudio: null,
    questionAudioName: null,
    questionAudioStart: null,
    questionAudioEnd: null,
    photo: null,
    revealDuration: null,
    ...overrides,
  }
}

/** Question 1 complète (3 médias, découpes, texte piégeux), question 2 sans média. */
export function validQuestions(): TransferQuestion[] {
  return [
    question({
      question: 'Qui chante « My Heart Will Go On » ;\nindice : "Titanic"',
      answers: ['Céline Dion', 'Adele ; Lara', ' espace ', '=1+1'],
      correctAnswer: 0,
      timeLimit: 20,
      points: 10,
      revealAudio: 'audio/001-revelation.mp3',
      revealAudioName: 'My Heart Will Go On',
      revealAudioStart: 0,
      revealAudioEnd: 32.5,
      questionAudio: 'audio/001-question.mp3',
      questionAudioName: 'Extrait intro',
      questionAudioStart: 12,
      questionAudioEnd: 27.125,
      photo: 'photos/001.jpg',
      revealDuration: -1,
    }),
    question({ revealDuration: 5 }),
  ]
}

export function validCsv(questions = validQuestions()): string {
  return buildQuizCsv(questions)
}

export function validEntries(): Record<string, Uint8Array> {
  return { 'audio/001-question.mp3': AUDIO, 'audio/001-revelation.mp3': AUDIO, 'photos/001.jpg': PHOTO }
}

export function validManifest(csv = validCsv(), overrides: Partial<QuizManifest> = {}): QuizManifest {
  const csvBytes = textBytes(csv)
  const ref = mediaRef(CSV_FILE, 'audio/mpeg', csvBytes)
  return {
    format: QUIZ_FORMAT_ID,
    formatVersion: QUIZ_FORMAT_VERSION,
    exportedOn: '2026-11-05',
    name: 'Blind test mariage',
    settings: { penaltyPoints: 2 },
    csv: { file: CSV_FILE, size: ref.size, sha256: ref.sha256 },
    media: [
      mediaRef('audio/001-question.mp3', 'audio/mpeg', AUDIO),
      mediaRef('audio/001-revelation.mp3', 'audio/mpeg', AUDIO),
      mediaRef('photos/001.jpg', 'image/jpeg', PHOTO),
    ],
    ...overrides,
  }
}

export async function quizZipOf(
  manifest: unknown,
  entries: Record<string, Uint8Array | string> = validEntries(),
  options: { csv?: string | Uint8Array | null; compression?: 'STORE' | 'DEFLATE' } = {}
): Promise<Blob> {
  const zip = new JSZip()
  zip.file('manifest.json', typeof manifest === 'string' ? manifest : JSON.stringify(manifest), { createFolders: false })
  const csv = options.csv === undefined ? validCsv() : options.csv
  if (csv !== null) zip.file(CSV_FILE, typeof csv === 'string' ? textBytes(csv) : csv, { createFolders: false })
  for (const [name, bytes] of Object.entries(entries)) zip.file(name, bytes, { createFolders: false })
  const output = await zip.generateAsync({ type: 'uint8array', compression: options.compression ?? 'STORE' })
  return new Blob([new Uint8Array(output)])
}
