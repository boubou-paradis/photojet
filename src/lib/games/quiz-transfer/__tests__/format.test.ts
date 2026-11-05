// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it, vi } from 'vitest'
import { parseLegacyQuizCsv } from '@/lib/quiz/csv-legacy'
import {
  CSV_COLUMNS,
  QUIZ_INVALID_MESSAGE,
  QUIZ_LIMITS,
  QUIZ_NEWER_VERSION_MESSAGE,
  MO,
  buildQuizCsv,
  checkCsvMatchesManifest,
  checkExportableQuestion,
  cleanAudioName,
  fromTransferQuestion,
  parseQuizCsv,
  parseQuizManifest,
  splitCsvRecords,
  toTransferQuestion,
} from '../format'
import { AUDIO, mediaRef, question, validCsv, validManifest, validQuestions } from './fixtures'

const HEADER = CSV_COLUMNS.join(';')

describe('quiz.csv : aller-retour', () => {
  it('relit exactement ce qui a été écrit, médias et découpes compris', () => {
    expect(parseQuizCsv(validCsv())).toEqual(validQuestions())
  })

  it('garde les retours à la ligne, guillemets et points-virgules d’une question', () => {
    const [first] = parseQuizCsv(validCsv())
    expect(first.question).toBe('Qui chante « My Heart Will Go On » ;\nindice : "Titanic"')
    expect(first.answers).toEqual(['Céline Dion', 'Adele ; Lara', ' espace ', '=1+1'])
  })

  it('ne modifie pas une formule Excel', () => {
    expect(validCsv()).toContain(';=1+1;')
  })

  it('commence par le BOM et utilise ; et CRLF, avec les 9 colonnes historiques en tête', () => {
    const csv = validCsv()
    expect(csv.startsWith('﻿' + 'question;reponse1;reponse2;reponse3;reponse4;bonne_reponse;temps;points;fichier_audio;')).toBe(true)
    expect(csv.split('\r\n')[0]).toBe('﻿' + HEADER)
  })

  it('accepte un CSV sans BOM et avec fins de ligne LF', () => {
    const csv = validCsv().slice(1).replace(/\r\n/g, '\n')
    expect(parseQuizCsv(csv)).toEqual(validQuestions())
  })

  it('accepte une virgule décimale dans une découpe', () => {
    const csv = validCsv().replace(';32.5;', ';32,5;')
    expect(parseQuizCsv(csv)[0].revealAudioEnd).toBe(32.5)
  })

  it('accepte un en-tête réduit aux 9 colonnes historiques', () => {
    const csv = `${CSV_COLUMNS.slice(0, 9).join(';')}\r\nQ ?;A;B;C;D;2;20;10;\r\n`
    expect(parseQuizCsv(csv)).toEqual([question({ question: 'Q ?', answers: ['A', 'B', 'C', 'D'], timeLimit: 20, points: 10 })])
  })
})

describe('quiz.csv : compatibilité avec l’ancien import', () => {
  it('l’ancien lecteur relit les questions du quiz.csv exporté', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1)
    const questions = [question(), question({ question: 'Couleur du ciel ?', answers: ['Bleu', 'Vert', 'Rouge', 'Noir'], correctAnswer: 0 })]
    const legacy = parseLegacyQuizCsv(buildQuizCsv(questions).slice(1))
    expect(legacy.errors).toEqual([])
    expect(legacy.questions.map((q) => [q.question, q.answers, q.correctAnswer, q.timeLimit, q.points])).toEqual(
      questions.map((q) => [q.question, q.answers, q.correctAnswer, q.timeLimit, q.points])
    )
    vi.restoreAllMocks()
  })
})

describe('quiz.csv : refus', () => {
  const bad = (row: string) => `${HEADER}\r\n${row}\r\n`
  const okRow = 'Q ?;A;B;C;D;1;20;10;;;;;;;;;;'

  it('accepte la ligne de référence', () => {
    expect(parseQuizCsv(bad(okRow))).toHaveLength(1)
  })

  it.each([
    ['en-tête inconnu', 'quest;reponse1\r\nQ;A'],
    ['pas de question', HEADER],
    ['colonne en trop', bad(okRow + ';x')],
    ['colonne manquante', bad(okRow.slice(0, -1))],
    ['bonne réponse 5', bad('Q ?;A;B;C;D;5;20;10;;;;;;;;;;')],
    ['bonne réponse texte', bad('Q ?;A;B;C;D;un;20;10;;;;;;;;;;')],
    ['temps hors plage', bad('Q ?;A;B;C;D;1;999;10;;;;;;;;;;')],
    ['points nuls', bad('Q ?;A;B;C;D;1;20;0;;;;;;;;;;')],
    ['réponse vide', bad('Q ?;A;;C;D;1;20;10;;;;;;;;;;')],
    ['question vide', bad(' ;A;B;C;D;1;20;10;;;;;;;;;;')],
    ['caractère de contrôle', bad('Q\u0007 ?;A;B;C;D;1;20;10;;;;;;;;;;')],
    ['audio d’une autre question', bad('Q ?;A;B;C;D;1;20;10;audio/002-revelation.mp3;;;;;;;;;')],
    ['audio de question à la place de la révélation', bad('Q ?;A;B;C;D;1;20;10;audio/001-question.mp3;;;;;;;;;')],
    ['photo en .exe', bad('Q ?;A;B;C;D;1;20;10;;;;;;;;;photos/001.exe;')],
    ['remontée de dossier', bad('Q ?;A;B;C;D;1;20;10;;;;;;;;;../photos/001.jpg;')],
    ['découpe sans audio', bad('Q ?;A;B;C;D;1;20;10;;;3;8;;;;;;')],
    ['nom sans audio', bad('Q ?;A;B;C;D;1;20;10;;Titre;;;;;;;;')],
    ['découpe inversée', bad('Q ?;A;B;C;D;1;20;10;audio/001-revelation.mp3;;9;3;;;;;;')],
    ['découpe négative', bad('Q ?;A;B;C;D;1;20;10;audio/001-revelation.mp3;;-1;3;;;;;;')],
    ['durée inconnue', bad('Q ?;A;B;C;D;1;20;10;;;;;;;;;;7')],
    ['guillemet non fermé', bad('"Q ?;A;B;C;D;1;20;10;;;;;;;;;;')],
    ['texte après guillemet fermant', bad('"Q" ?;A;B;C;D;1;20;10;;;;;;;;;;')],
  ])('refuse : %s', (_, csv) => {
    expect(() => parseQuizCsv(csv)).toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse plus de 100 questions avec un message clair', () => {
    const rows = Array.from({ length: QUIZ_LIMITS.questions + 1 }, () => okRow)
    expect(() => parseQuizCsv(`${HEADER}\r\n${rows.join('\r\n')}`)).toThrow('100 questions')
  })

  it('refuse un texte trop long', () => {
    const long = 'x'.repeat(QUIZ_LIMITS.questionLength + 1)
    expect(() => parseQuizCsv(bad(`${long};A;B;C;D;1;20;10;;;;;;;;;;`))).toThrow(QUIZ_INVALID_MESSAGE)
  })
})

describe('splitCsvRecords', () => {
  it('normalise les retours à la ligne entre guillemets', () => {
    expect(splitCsvRecords('"a\r\nb";c\r\n')).toEqual([['a\nb', 'c']])
  })
})

describe('manifeste', () => {
  it('accepte le manifeste de référence', () => {
    expect(parseQuizManifest(validManifest())).toEqual(validManifest())
  })

  it.each([
    ['format Photo Mystère', { format: 'animajet-photo-mystere' }],
    ['clé en trop', { extra: 1 }],
    ['pénalité inconnue', { settings: { penaltyPoints: 3 } }],
    ['nom vide', { name: '  ' }],
    ['nom trop long', { name: 'x'.repeat(81) }],
    ['date invalide', { exportedOn: '05/11/2026' }],
    ['CSV mal nommé', { csv: { file: 'autre.csv', size: 10, sha256: 'a'.repeat(64) } }],
    ['média en double', { media: [mediaRef('photos/001.jpg', 'image/jpeg', AUDIO), mediaRef('photos/001.jpg', 'image/jpeg', AUDIO)] }],
    ['type qui ne colle pas à l’extension', { media: [mediaRef('photos/001.jpg', 'image/png', AUDIO)] }],
    ['audio dans photos', { media: [mediaRef('photos/001.mp3', 'audio/mpeg', AUDIO)] }],
    ['fichier caché', { media: [mediaRef('audio/.001-question.mp3', 'audio/mpeg', AUDIO)] }],
  ])('refuse : %s', (_, overrides) => {
    expect(() => parseQuizManifest({ ...validManifest(), ...overrides })).toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('refuse le prototype pollué', () => {
    const raw = JSON.parse(JSON.stringify(validManifest()).replace('"name"', '"__proto__":{},"name"'))
    expect(() => parseQuizManifest(raw)).toThrow(QUIZ_INVALID_MESSAGE)
  })

  it('signale une version plus récente', () => {
    expect(() => parseQuizManifest({ ...validManifest(), formatVersion: 2 })).toThrow(QUIZ_NEWER_VERSION_MESSAGE)
  })

  it('refuse un média trop lourd avec la limite', () => {
    const big = { file: 'audio/001-question.mp3', type: 'audio/mpeg', size: QUIZ_LIMITS.audioBytes + 1, sha256: 'a'.repeat(64) }
    expect(() => parseQuizManifest({ ...validManifest(), media: [big] })).toThrow('20 Mo')
    const photo = { file: 'photos/001.jpg', type: 'image/jpeg', size: 5 * MO + 1, sha256: 'a'.repeat(64) }
    expect(() => parseQuizManifest({ ...validManifest(), media: [photo] })).toThrow('5 Mo')
  })

  it('refuse un total au-delà de 400 Mo', () => {
    const media = Array.from({ length: 21 }, (_, i) => ({
      file: `audio/${String(i + 1).padStart(3, '0')}-question.mp3`,
      type: 'audio/mpeg',
      size: 20 * MO,
      sha256: 'a'.repeat(64),
    }))
    expect(() => parseQuizManifest({ ...validManifest(), media })).toThrow('400 Mo')
  })

  it('le CSV et le manifeste citent les mêmes médias', () => {
    const manifest = validManifest()
    expect(() => checkCsvMatchesManifest(validQuestions(), manifest)).not.toThrow()
    expect(() => checkCsvMatchesManifest(validQuestions(), { ...manifest, media: manifest.media.slice(1) })).toThrow(
      QUIZ_INVALID_MESSAGE
    )
    expect(() => checkCsvMatchesManifest([question()], manifest)).toThrow(QUIZ_INVALID_MESSAGE)
  })
})

describe('conversion avec la structure du jeu', () => {
  const stored = {
    id: '1',
    question: 'Q ?',
    answers: ['A', 'B', 'C', 'D'],
    correctAnswer: 2,
    timeLimit: 30,
    points: 15,
    audioUrl: 'https://x/storage/v1/object/public/photos/quiz-audio/a.mp3',
    audioFileName: 'Titre\nsur deux lignes',
    audioStart: 1.5,
    audioEnd: 9,
    questionAudioUrl: 'https://x/storage/v1/object/public/photos/quiz-question-audio/b.mp3',
    questionAudioName: 'Intro',
    questionAudioStart: null,
    questionAudioEnd: 12,
    photoUrl: 'https://x/storage/v1/object/public/photos/quiz-photos/c.jpg',
    revealDuration: 15,
    // Champs parasites de l'ancien import CSV : jamais exportés.
    pendingAudioFile: 'x.mp3',
  }

  it('aller-retour fidèle, sans champ parasite ni identifiant d’origine', () => {
    const files = { revealAudio: 'audio/001-revelation.mp3', questionAudio: 'audio/001-question.mp3', photo: 'photos/001.jpg' }
    const t = toTransferQuestion(stored, files)
    expect(t.revealAudioName).toBe('Titre sur deux lignes')
    const back = fromTransferQuestion(parseQuizCsv(buildQuizCsv([t]))[0], 'nouvel-id', (f) => `URL:${f}`)
    expect(back).toEqual({
      id: 'nouvel-id',
      question: 'Q ?',
      answers: ['A', 'B', 'C', 'D'],
      correctAnswer: 2,
      timeLimit: 30,
      points: 15,
      audioUrl: 'URL:audio/001-revelation.mp3',
      audioFileName: 'Titre sur deux lignes',
      audioStart: 1.5,
      audioEnd: 9,
      questionAudioUrl: 'URL:audio/001-question.mp3',
      questionAudioName: 'Intro',
      questionAudioStart: null,
      questionAudioEnd: 12,
      photoUrl: 'URL:photos/001.jpg',
      revealDuration: 15,
    })
  })

  it('une question sans média ne garde aucun réglage de média', () => {
    const t = toTransferQuestion(stored, { revealAudio: null, questionAudio: null, photo: null })
    expect(fromTransferQuestion(t, 'id', () => '')).toEqual({
      id: 'id',
      question: 'Q ?',
      answers: ['A', 'B', 'C', 'D'],
      correctAnswer: 2,
      timeLimit: 30,
      points: 15,
      revealDuration: 15,
    })
  })

  it('nomme la question fautive à l’export', () => {
    expect(() => checkExportableQuestion(question({ question: 'x'.repeat(301) }), 3)).toThrow('Question 4')
    expect(() => checkExportableQuestion(question({ revealDuration: 7 }), 0)).toThrow('Question 1')
    expect(() =>
      checkExportableQuestion(question({ revealAudio: 'audio/001-revelation.mp3', revealAudioStart: 5, revealAudioEnd: 5 }), 0)
    ).toThrow('découpe')
  })

  it('cleanAudioName borne la longueur et retire les contrôles', () => {
    expect(cleanAudioName('a'.repeat(200))).toHaveLength(QUIZ_LIMITS.audioNameLength)
    expect(cleanAudioName('\u0000\n')).toBeNull()
    expect(cleanAudioName(42)).toBeNull()
  })
})
