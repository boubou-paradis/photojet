// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Validation de toutes les entrées venant du navigateur. Rien n'est cru sur
// parole : chaque route API passe par ces fonctions avant de toucher la base.

import { AFFINITY_LIMITS, AFFINITY_TIME_LIMITS } from './constants'
import type { AffinityQuestion, AffinityTimeLimit } from './types'

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const QUESTION_ID_RE = /^[A-Za-z0-9_-]+$/
const SESSION_CODE_RE = /^[A-Za-z0-9]{3,12}$/
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/
// Caractères de contrôle et invisibles (zéro largeur, direction) retirés des textes saisis.
const INVISIBLE_RE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isSessionCode(value: unknown): value is string {
  return typeof value === 'string' && SESSION_CODE_RE.test(value)
}

export function isPlayerToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_RE.test(value)
}

/** Texte saisi : normalisé, sans caractères invisibles, espaces regroupés. */
export function cleanText(value: string): string {
  return value.normalize('NFC').replace(INVISIBLE_RE, '').replace(/\s+/g, ' ').trim()
}

/** Pseudo affiché : nettoyé, 1 à 24 caractères. */
export function normalizeNickname(value: unknown): Validated<string> {
  if (typeof value !== 'string') return { ok: false, error: 'Choisis un pseudo.' }
  const nickname = cleanText(value)
  if (!nickname) return { ok: false, error: 'Choisis un pseudo.' }
  if ([...nickname].length > AFFINITY_LIMITS.nicknameMaxLength) {
    return { ok: false, error: `Ton pseudo doit faire ${AFFINITY_LIMITS.nicknameMaxLength} caractères au maximum.` }
  }
  return { ok: true, value: nickname }
}

/** Clé de comparaison des pseudos : insensible à la casse et aux espaces. */
export function nicknameKey(nickname: string): string {
  return cleanText(nickname).toLocaleLowerCase('fr').replace(/\s+/g, '')
}

/** Suggestion libre pour un pseudo déjà pris : Luna → Luna2, Luna3… */
export function suggestNickname(nickname: string, takenKeys: ReadonlySet<string>): string | null {
  for (let n = 2; n < 1000; n++) {
    const suffix = String(n)
    const base = [...nickname].slice(0, AFFINITY_LIMITS.nicknameMaxLength - suffix.length).join('').trimEnd()
    const candidate = `${base}${suffix}`
    if (!takenKeys.has(nicknameKey(candidate))) return candidate
  }
  return null
}

/** Table : facultative, 1 à 12 caractères. */
export function normalizeTable(value: unknown): Validated<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, error: 'Numéro de table invalide.' }
  const table = cleanText(value)
  if (!table) return { ok: true, value: null }
  if ([...table].length > AFFINITY_LIMITS.tableMaxLength) {
    return { ok: false, error: `Le numéro de table doit faire ${AFFINITY_LIMITS.tableMaxLength} caractères au maximum.` }
  }
  return { ok: true, value: table }
}

function isTimeLimit(value: unknown): value is AffinityTimeLimit {
  return (AFFINITY_TIME_LIMITS as readonly unknown[]).includes(value)
}

/**
 * Configuration de partie (éditeur animateur). Vérifiée au lancement côté
 * serveur : 5 à 20 questions, 2 à 4 réponses distinctes, chrono autorisé.
 */
export function validateQuestions(value: unknown): Validated<AffinityQuestion[]> {
  if (!Array.isArray(value)) return { ok: false, error: 'Aucune question.' }
  const { minQuestions, maxQuestions, minAnswers, maxAnswers, questionMaxLength, answerMaxLength, questionIdMaxLength } = AFFINITY_LIMITS
  if (value.length < minQuestions || value.length > maxQuestions) {
    return { ok: false, error: `Il faut entre ${minQuestions} et ${maxQuestions} questions (${value.length} actuellement).` }
  }

  const ids = new Set<string>()
  const questions: AffinityQuestion[] = []

  for (let i = 0; i < value.length; i++) {
    const raw: unknown = value[i]
    const label = `Question ${i + 1}`
    if (typeof raw !== 'object' || raw === null) return { ok: false, error: `${label} : format invalide.` }
    const { id, text, answers, timeLimit } = raw as Record<string, unknown>

    if (typeof id !== 'string' || !QUESTION_ID_RE.test(id) || id.length > questionIdMaxLength || ids.has(id)) {
      return { ok: false, error: `${label} : identifiant invalide.` }
    }
    ids.add(id)

    if (typeof text !== 'string' || !cleanText(text)) return { ok: false, error: `${label} : le texte est vide.` }
    const cleanQuestion = cleanText(text)
    if ([...cleanQuestion].length > questionMaxLength) {
      return { ok: false, error: `${label} : ${questionMaxLength} caractères au maximum.` }
    }

    if (!Array.isArray(answers) || answers.length < minAnswers || answers.length > maxAnswers) {
      return { ok: false, error: `${label} : il faut entre ${minAnswers} et ${maxAnswers} réponses.` }
    }
    const cleanAnswers: string[] = []
    const seen = new Set<string>()
    for (let j = 0; j < answers.length; j++) {
      const answer: unknown = answers[j]
      if (typeof answer !== 'string' || !cleanText(answer)) return { ok: false, error: `${label}, réponse ${j + 1} : vide.` }
      const cleanAnswer = cleanText(answer)
      if ([...cleanAnswer].length > answerMaxLength) {
        return { ok: false, error: `${label}, réponse ${j + 1} : ${answerMaxLength} caractères au maximum.` }
      }
      const key = cleanAnswer.toLocaleLowerCase('fr')
      if (seen.has(key)) return { ok: false, error: `${label} : deux réponses identiques.` }
      seen.add(key)
      cleanAnswers.push(cleanAnswer)
    }

    if (!isTimeLimit(timeLimit)) return { ok: false, error: `${label} : chrono invalide.` }

    questions.push({ id, text: cleanQuestion, answers: cleanAnswers, timeLimit })
  }

  return { ok: true, value: questions }
}

export interface JoinRequest {
  code: string
  nickname: string
  table: string | null
  consent: boolean
}

export function parseJoinRequest(body: unknown): Validated<JoinRequest> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Requête invalide.' }
  const { code, nickname, table, consent } = body as Record<string, unknown>
  if (!isSessionCode(code)) return { ok: false, error: 'Code de session invalide.' }
  const nick = normalizeNickname(nickname)
  if (!nick.ok) return nick
  const tab = normalizeTable(table)
  if (!tab.ok) return tab
  // Consentement : uniquement un vrai `true` coché par le joueur.
  return { ok: true, value: { code, nickname: nick.value, table: tab.value, consent: consent === true } }
}

export interface PlayerAuth {
  sessionId: string
  playerId: string
  token: string
}

export function parsePlayerAuth(body: unknown): Validated<PlayerAuth> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Requête invalide.' }
  const { sessionId, playerId, token } = body as Record<string, unknown>
  if (!isUuid(sessionId) || !isUuid(playerId) || !isPlayerToken(token)) {
    return { ok: false, error: 'Identification du joueur invalide.' }
  }
  return { ok: true, value: { sessionId, playerId, token } }
}

export interface AnswerRequest extends PlayerAuth {
  questionId: string
  answerIndex: number
}

export function parseAnswerRequest(body: unknown): Validated<AnswerRequest> {
  const auth = parsePlayerAuth(body)
  if (!auth.ok) return auth
  const { questionId, answerIndex } = body as Record<string, unknown>
  if (typeof questionId !== 'string' || !QUESTION_ID_RE.test(questionId) || questionId.length > AFFINITY_LIMITS.questionIdMaxLength) {
    return { ok: false, error: 'Question invalide.' }
  }
  if (typeof answerIndex !== 'number' || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= AFFINITY_LIMITS.maxAnswers) {
    return { ok: false, error: 'Réponse invalide.' }
  }
  return { ok: true, value: { ...auth.value, questionId, answerIndex } }
}

export const ADMIN_ACTIONS = ['launch', 'start', 'close', 'reveal', 'next', 'finish', 'exit', 'heartbeat'] as const
export type AdminAction = (typeof ADMIN_ACTIONS)[number]

export function parseAdminRequest(body: unknown): Validated<{ sessionId: string; action: AdminAction }> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Requête invalide.' }
  const { sessionId, action } = body as Record<string, unknown>
  if (!isUuid(sessionId)) return { ok: false, error: 'Session invalide.' }
  if (typeof action !== 'string' || !(ADMIN_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: 'Action inconnue.' }
  }
  return { ok: true, value: { sessionId, action: action as AdminAction } }
}
