// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — manches préparées : types, limites et validation (sans
// dépendance navigateur ni serveur, testable seul). Rien n'est cru sur
// parole : chaque liste passe par parsePrepDraft avant d'être enregistrée,
// et la base revérifie (contraintes, fonctions SQL).
// Tout est facultatif dans une manche : une manche vide se joue comme en
// mode libre.

import { cleanText, type Validated } from '@/lib/affinity/validation'

export const PREP_LIMITS = {
  maxRounds: 100,
  nameMaxLength: 80,
  questionMaxLength: 160,
  answerMaxLength: 120,
  voteQuestionMaxLength: 120,
  choiceMaxLength: 40,
  minChoices: 2,
  maxChoices: 4,
  audioNameMaxLength: 120,
  /** Extrait audio AVANT compression (la compression du Quiz le réduit ensuite). */
  audioMaxBytes: 20 * 1024 * 1024,
  /** Image de révélation (compressée par le navigateur, ~1 Mo en pratique). */
  imageMaxBytes: 10 * 1024 * 1024,
  /** Durée maximale d'un fichier audio prise en compte pour la découpe (s). */
  audioMaxSeconds: 60 * 60,
} as const

/** Dossier des médias dans le bucket photos : buzzer-media/<compte>/<session>/<fichier>. */
export const BUZZER_MEDIA_BUCKET = 'photos'
export const BUZZER_MEDIA_FOLDER = 'buzzer-media'

export type BuzzerMediaKind = 'audio' | 'image'

export interface PrepVote {
  question: string
  choices: string[]
  /** Index de la bonne réponse, ou null s'il n'y en a pas. */
  correct: number | null
}

export interface PrepRound {
  id: string
  question: string | null
  answer: string | null
  imagePath: string | null
  audioPath: string | null
  /** Nom du fichier d'origine, affiché à l'animateur seulement. */
  audioName: string | null
  audioStart: number | null
  audioEnd: number | null
  vote: PrepVote | null
}

export interface PrepSettings {
  /** Après une bonne réponse, la musique reprend jusqu'à la fin de l'extrait. */
  resumeAfterRight: boolean
}

/** Liste en préparation d'une session (table buzzer_prep_sets). */
export interface PrepDraft {
  /** Manches préparées choisies (sinon : mode libre). */
  enabled: boolean
  name: string
  rounds: PrepRound[]
  settings: PrepSettings
}

/** Entrée de la bibliothèque (table saved_buzzer_sets, RLS propriétaire). */
export interface SavedBuzzerSet {
  id: string
  user_id: string
  name: string
  rounds: PrepRound[]
  settings: PrepSettings
  created_at: string
  updated_at: string
}

export const DEFAULT_PREP_SETTINGS: PrepSettings = { resumeAfterRight: true }

export function emptyDraft(): PrepDraft {
  return { enabled: false, name: '', rounds: [], settings: { ...DEFAULT_PREP_SETTINGS } }
}

const ROUND_ID_RE = /^[A-Za-z0-9_-]{1,40}$/
const MEDIA_FILE_RE = /^[0-9]{10,16}-[0-9a-f]{12}\.(mp3|m4a|aac|wav|ogg|flac|jpg|png|webp)$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AUDIO_EXT = new Set(['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac'])
const IMAGE_EXT = new Set(['jpg', 'png', 'webp'])

export function newRoundId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function emptyRound(): PrepRound {
  return { id: newRoundId(), question: null, answer: null, imagePath: null, audioPath: null, audioName: null, audioStart: null, audioEnd: null, vote: null }
}

/** Préfixe des médias d'un compte (tout chemin hors de ce préfixe est refusé). */
export function mediaUserPrefix(userId: string): string {
  return `${BUZZER_MEDIA_FOLDER}/${userId}/`
}

/**
 * Chemin de média valide pour ce compte et du type attendu :
 * buzzer-media/<compte>/<session>/<horodatage>-<aléa>.<ext>. Le serveur
 * impose ce format à l'envoi ; ici on refuse tout le reste.
 */
export function isBuzzerMediaPath(value: unknown, userId: string, kind?: BuzzerMediaKind): value is string {
  if (typeof value !== 'string' || !UUID_RE.test(userId)) return false
  const parts = value.split('/')
  if (parts.length !== 4 || parts[0] !== BUZZER_MEDIA_FOLDER || parts[1] !== userId) return false
  if (!UUID_RE.test(parts[2]) || !MEDIA_FILE_RE.test(parts[3])) return false
  if (!kind) return true
  const ext = parts[3].split('.').pop()!
  return kind === 'audio' ? AUDIO_EXT.has(ext) : IMAGE_EXT.has(ext)
}

/** Tous les chemins de médias cités dans un contenu (liste, bibliothèque, partie en cours). */
export function collectMediaPaths(value: unknown): string[] {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null)
  return text.match(/buzzer-media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9]{10,16}-[0-9a-f]{12}\.[a-z0-9]{3,4}/gi) ?? []
}

function optionalText(value: unknown, max: number, label: string): Validated<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, error: `${label} invalide.` }
  const text = cleanText(value)
  if (!text) return { ok: true, value: null }
  if ([...text].length > max) return { ok: false, error: `${label} : ${max} caractères au maximum.` }
  return { ok: true, value: text }
}

function optionalSeconds(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > PREP_LIMITS.audioMaxSeconds) return undefined
  return Math.round(value * 1000) / 1000
}

/**
 * Vote d'une manche. Brouillon (strict = false) : on garde ce qui est en
 * cours de saisie (question ou choix encore vides). Lancement (strict) :
 * question obligatoire, 2 à 4 choix distincts.
 */
function parseVote(raw: unknown, n: number, strict: boolean): Validated<PrepVote | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null }
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: `Manche ${n} : vote invalide.` }
  const { question, choices, correct } = raw as Record<string, unknown>
  const q = optionalText(question, PREP_LIMITS.voteQuestionMaxLength, `Manche ${n} : question du vote`)
  if (!q.ok) return q
  if (strict && !q.value) return { ok: false, error: `Manche ${n} : écrivez la question du vote.` }
  if (!Array.isArray(choices) || choices.length > PREP_LIMITS.maxChoices) return { ok: false, error: `Manche ${n} : choix du vote invalides.` }
  const list: string[] = []
  for (const c of choices) {
    const t = optionalText(c, PREP_LIMITS.choiceMaxLength, `Manche ${n} : choix du vote`)
    if (!t.ok) return t
    // Au lancement, un choix vide est refusé (et non retiré : l'index de la bonne réponse resterait faux).
    if (strict && !t.value) return { ok: false, error: `Manche ${n} : un choix du vote est vide.` }
    list.push(t.value ?? '')
  }
  if (strict) {
    if (list.length < PREP_LIMITS.minChoices) {
      return { ok: false, error: `Manche ${n} : le vote doit avoir de ${PREP_LIMITS.minChoices} à ${PREP_LIMITS.maxChoices} choix.` }
    }
    const keys = new Set(list.map((c) => c.toLocaleLowerCase('fr')))
    if (keys.size !== list.length) return { ok: false, error: `Manche ${n} : deux choix du vote sont identiques.` }
  }
  let good: number | null = null
  if (correct !== undefined && correct !== null) {
    if (typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0 || correct >= list.length) {
      if (strict) return { ok: false, error: `Manche ${n} : bonne réponse du vote invalide.` }
    } else {
      good = correct
    }
  }
  return { ok: true, value: { question: q.value ?? '', choices: list, correct: good } }
}

/** Une manche : textes nettoyés, médias du compte uniquement, découpe cohérente. */
export function parseRound(raw: unknown, n: number, userId: string, strict = false): Validated<PrepRound> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: `Manche ${n} invalide.` }
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' && ROUND_ID_RE.test(r.id) ? r.id : newRoundId()

  const question = optionalText(r.question, PREP_LIMITS.questionMaxLength, `Manche ${n} : question`)
  if (!question.ok) return question
  const answer = optionalText(r.answer, PREP_LIMITS.answerMaxLength, `Manche ${n} : réponse`)
  if (!answer.ok) return answer
  const audioName = optionalText(r.audioName, PREP_LIMITS.audioNameMaxLength, `Manche ${n} : nom du fichier`)
  if (!audioName.ok) return audioName

  if (r.imagePath !== undefined && r.imagePath !== null && !isBuzzerMediaPath(r.imagePath, userId, 'image')) {
    return { ok: false, error: `Manche ${n} : image invalide.` }
  }
  if (r.audioPath !== undefined && r.audioPath !== null && !isBuzzerMediaPath(r.audioPath, userId, 'audio')) {
    return { ok: false, error: `Manche ${n} : extrait audio invalide.` }
  }
  const audioPath = (r.audioPath as string | null | undefined) ?? null

  let audioStart = optionalSeconds(r.audioStart)
  let audioEnd = optionalSeconds(r.audioEnd)
  if (audioStart === undefined || audioEnd === undefined) return { ok: false, error: `Manche ${n} : découpe audio invalide.` }
  if (!audioPath) {
    audioStart = null
    audioEnd = null
  } else if (audioStart !== null && audioEnd !== null && audioEnd <= audioStart) {
    return { ok: false, error: `Manche ${n} : la fin de l'extrait doit être après le début.` }
  }

  const vote = parseVote(r.vote, n, strict)
  if (!vote.ok) return vote

  return {
    ok: true,
    value: {
      id,
      question: question.value,
      answer: answer.value,
      imagePath: (r.imagePath as string | null | undefined) ?? null,
      audioPath,
      audioName: audioPath ? audioName.value : null,
      audioStart,
      audioEnd,
      vote: vote.value,
    },
  }
}

export function parseRounds(raw: unknown, userId: string, strict = false): Validated<PrepRound[]> {
  if (!Array.isArray(raw)) return { ok: false, error: 'Liste de manches invalide.' }
  if (raw.length > PREP_LIMITS.maxRounds) return { ok: false, error: `${PREP_LIMITS.maxRounds} manches au maximum.` }
  const rounds: PrepRound[] = []
  const ids = new Set<string>()
  for (let i = 0; i < raw.length; i++) {
    const parsed = parseRound(raw[i], i + 1, userId, strict)
    if (!parsed.ok) return parsed
    // Identifiant en double (manche dupliquée à la main) : on en donne un neuf.
    if (ids.has(parsed.value.id)) parsed.value.id = newRoundId()
    ids.add(parsed.value.id)
    rounds.push(parsed.value)
  }
  return { ok: true, value: rounds }
}

export function parseSettings(raw: unknown): PrepSettings {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return { resumeAfterRight: typeof r.resumeAfterRight === 'boolean' ? r.resumeAfterRight : DEFAULT_PREP_SETTINGS.resumeAfterRight }
}

/** Liste en préparation : enregistrée même incomplète (votes en cours de saisie). */
export function parsePrepDraft(raw: unknown, userId: string): Validated<PrepDraft> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Liste invalide.' }
  const d = raw as Record<string, unknown>
  const name = optionalText(d.name, PREP_LIMITS.nameMaxLength, 'Nom de la liste')
  if (!name.ok) return name
  const rounds = parseRounds(d.rounds ?? [], userId)
  if (!rounds.ok) return rounds
  return { ok: true, value: { enabled: d.enabled === true, name: name.value ?? '', rounds: rounds.value, settings: parseSettings(d.settings) } }
}

/** Liste prête à jouer (au lancement) : 1 à 100 manches, votes complets. */
export function parseRoundsForLaunch(raw: unknown, userId: string): Validated<PrepRound[]> {
  const rounds = parseRounds(raw, userId, true)
  if (rounds.ok && rounds.value.length === 0) return { ok: false, error: 'Ajoutez au moins une manche.' }
  return rounds
}

/** Résumé court d'une manche pour la liste (« Audio 0:30 → 1:00 », etc.). */
export function formatSeconds(s: number): string {
  const total = Math.max(0, Math.floor(s))
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`
}

/** Une manche sans rien : elle se jouera comme en mode libre. */
export function isEmptyRound(r: PrepRound): boolean {
  return !r.question && !r.answer && !r.imagePath && !r.audioPath && !r.vote
}
