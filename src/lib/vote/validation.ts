// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Validation des entrées d'AnimaVote. Rien n'est cru sur parole : chaque
// route passe par ces fonctions, puis la base revérifie (contraintes et
// fonctions SQL). Nettoyage des textes et formats d'identifiants : ceux de
// Matching, réutilisés sans les modifier.

import { cleanText, isPlayerToken, isSessionCode, isUuid, type Validated } from '@/lib/affinity/validation'
import { VOTE_COUNTDOWNS_S, VOTE_LIMITS, VOTE_PHOTO_FOLDER } from './constants'
import type { VoteCandidateInput, VoteDisplayMode, VoteDraft, VoteResultsMode, VoteRevealMode } from './types'

export { isSessionCode, isUuid }
export type { Validated }

const COLOR_RE = /^#[0-9a-f]{6}$/i
const PHOTO_NAME_RE = /^[A-Za-z0-9_-]{1,80}\.(?:jpg|png|webp)$/

const length = (text: string) => [...text].length

/** Texte facultatif : nettoyé ; vide → null ; trop long → erreur. */
function optionalText(value: unknown, max: number, label: string): Validated<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, error: `${label} invalide.` }
  const text = cleanText(value)
  if (!text) return { ok: true, value: null }
  if (length(text) > max) return { ok: false, error: `${label} : ${max} caractères au maximum.` }
  return { ok: true, value: text }
}

/** Adresse publique attendue d'une photo de candidat de cette session. */
export function votePhotoPrefix(publicBase: string, sessionId: string): string {
  return `${publicBase.replace(/\/+$/, '')}/${VOTE_PHOTO_FOLDER}/${sessionId}/`
}

/** Photo acceptée seulement si elle a été déposée par AnimaVote pour cette session. */
export function isVotePhotoUrl(value: string, publicBase: string, sessionId: string): boolean {
  const prefix = votePhotoPrefix(publicBase, sessionId)
  return value.startsWith(prefix) && PHOTO_NAME_RE.test(value.slice(prefix.length))
}

export interface DraftContext {
  sessionId: string
  /** `${SUPABASE_URL}/storage/v1/object/public/photos` */
  photoBase: string
  /** Brouillon en cours d'édition : titre et nombre minimal de candidats pas encore exigés. */
  partial?: boolean
}

function parseCandidate(raw: unknown, index: number, ctx: DraftContext): Validated<VoteCandidateInput> {
  const where = `Choix n°${index + 1}`
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: `${where} invalide.` }
  const c = raw as Record<string, unknown>

  const label = optionalText(c.label, VOTE_LIMITS.labelMaxLength, `${where}, nom`)
  if (!label.ok) return label
  if (!label.value && !ctx.partial) return { ok: false, error: `${where} : le nom est obligatoire.` }

  const number = optionalText(c.number, VOTE_LIMITS.numberMaxLength, `${where}, numéro`)
  if (!number.ok) return number
  const description = optionalText(c.description, VOTE_LIMITS.descriptionMaxLength, `${where}, description`)
  if (!description.ok) return description
  const emoji = optionalText(c.emoji, VOTE_LIMITS.emojiMaxLength, `${where}, emoji`)
  if (!emoji.ok) return emoji

  let color: string | null = null
  if (c.color !== undefined && c.color !== null && c.color !== '') {
    if (typeof c.color !== 'string' || !COLOR_RE.test(c.color)) return { ok: false, error: `${where} : couleur invalide.` }
    color = c.color.toLowerCase()
  }

  let imageUrl: string | null = null
  if (c.imageUrl !== undefined && c.imageUrl !== null && c.imageUrl !== '') {
    if (typeof c.imageUrl !== 'string' || !isVotePhotoUrl(c.imageUrl, ctx.photoBase, ctx.sessionId)) {
      return { ok: false, error: `${where} : photo invalide, déposez-la à nouveau.` }
    }
    imageUrl = c.imageUrl
  }

  return { ok: true, value: { label: label.value ?? '', number: number.value, description: description.value, imageUrl, emoji: emoji.value, color } }
}

function isOneOf<T extends string>(value: unknown, list: readonly T[]): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

const DISPLAY_MODES: readonly VoteDisplayMode[] = ['photo', 'card', 'text']
const RESULTS_MODES: readonly VoteResultsMode[] = ['live', 'hidden']
const REVEAL_MODES: readonly VoteRevealMode[] = ['winner', 'podium', 'full']

/** Contenu de l'éditeur. `partial` : brouillon (sauvegarde automatique), sinon scrutin prêt à lancer. */
export function parseDraft(input: unknown, ctx: DraftContext): Validated<VoteDraft> {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'Vote invalide.' }
  const d = input as Record<string, unknown>

  const title = optionalText(d.title, VOTE_LIMITS.titleMaxLength, 'Titre')
  if (!title.ok) return title
  if (!title.value && !ctx.partial) return { ok: false, error: 'Donnez un titre au vote.' }
  const subtitle = optionalText(d.subtitle, VOTE_LIMITS.subtitleMaxLength, 'Sous-titre')
  if (!subtitle.ok) return subtitle
  const intro = optionalText(d.intro, VOTE_LIMITS.introMaxLength, 'Texte d’introduction')
  if (!intro.ok) return intro
  const thanks = optionalText(d.thanks, VOTE_LIMITS.thanksMaxLength, 'Message après le vote')
  if (!thanks.ok) return thanks

  if (!isOneOf(d.displayMode, DISPLAY_MODES)) return { ok: false, error: 'Présentation invalide.' }
  if (!isOneOf(d.resultsMode, RESULTS_MODES)) return { ok: false, error: 'Mode des résultats invalide.' }
  if (!isOneOf(d.revealMode, REVEAL_MODES)) return { ok: false, error: 'Mode de révélation invalide.' }
  if (typeof d.allowBlank !== 'boolean' || typeof d.shuffle !== 'boolean') return { ok: false, error: 'Options invalides.' }
  if (!(VOTE_COUNTDOWNS_S as readonly unknown[]).includes(d.countdownS)) return { ok: false, error: 'Compte à rebours invalide.' }

  if (!Array.isArray(d.candidates)) return { ok: false, error: 'Liste des choix invalide.' }
  if (d.candidates.length > VOTE_LIMITS.maxCandidates) {
    return { ok: false, error: `${VOTE_LIMITS.maxCandidates} choix au maximum.` }
  }
  if (!ctx.partial && d.candidates.length < VOTE_LIMITS.minCandidates) {
    return { ok: false, error: `Ajoutez au moins ${VOTE_LIMITS.minCandidates} choix.` }
  }
  const candidates: VoteCandidateInput[] = []
  for (let i = 0; i < d.candidates.length; i++) {
    const parsed = parseCandidate(d.candidates[i], i, ctx)
    if (!parsed.ok) return parsed
    candidates.push(parsed.value)
  }

  return {
    ok: true,
    value: {
      title: title.value ?? '',
      subtitle: subtitle.value,
      intro: intro.value,
      thanks: thanks.value,
      displayMode: d.displayMode,
      resultsMode: d.resultsMode,
      allowBlank: d.allowBlank,
      shuffle: d.shuffle,
      countdownS: d.countdownS as number,
      revealMode: d.revealMode,
      candidates,
    },
  }
}

export interface ParticipantAuth {
  sessionId: string
  participantId: string
  token: string
}

export function parseParticipantAuth(body: unknown): Validated<ParticipantAuth> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Requête invalide.' }
  const { sessionId, participantId, token } = body as Record<string, unknown>
  if (!isUuid(sessionId) || !isUuid(participantId) || !isPlayerToken(token)) {
    return { ok: false, error: 'Identification du téléphone invalide.' }
  }
  return { ok: true, value: { sessionId, participantId, token } }
}

export interface JoinRequest {
  code: string
  /** Identité déjà connue de ce téléphone (rechargement) : réutilisée si elle est encore valable. */
  previous: { participantId: string; token: string } | null
}

export function parseJoinRequest(body: unknown): Validated<JoinRequest> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Requête invalide.' }
  const { code, participantId, token } = body as Record<string, unknown>
  if (!isSessionCode(code)) return { ok: false, error: 'Code de session invalide.' }
  const previous = isUuid(participantId) && isPlayerToken(token) ? { participantId, token } : null
  return { ok: true, value: { code, previous } }
}

/** Actions traitées par la fonction SQL vote_admin. */
export const SQL_ADMIN_ACTIONS = [
  'launch', 'exit', 'heartbeat', 'edit', 'open', 'close', 'cancel_close', 'settle',
  'reveal', 'reveal_next', 'second_round', 'new_vote',
] as const
/** `snapshot` (lecture seule) et `save_draft` (brouillon de l'éditeur) : traitées par la route. */
export const ADMIN_ACTIONS = [...SQL_ADMIN_ACTIONS, 'snapshot', 'save_draft'] as const
export type VoteAdminAction = (typeof ADMIN_ACTIONS)[number]

type DraftAction = 'launch' | 'edit' | 'new_vote' | 'save_draft'
const DRAFT_ACTIONS: readonly string[] = ['launch', 'edit', 'new_vote', 'save_draft'] satisfies DraftAction[]

export type AdminRequest =
  | { sessionId: string; action: DraftAction; args: VoteDraft }
  | { sessionId: string; action: 'reveal_next'; args: { from: number } }
  | { sessionId: string; action: 'second_round'; args: { candidateIds: string[] } }
  | { sessionId: string; action: Exclude<VoteAdminAction, DraftAction | 'reveal_next' | 'second_round'>; args: Record<string, never> }

export function parseAdminRequest(body: unknown, photoBase: string): Validated<AdminRequest> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Requête invalide.' }
  const { sessionId, action, args } = body as Record<string, unknown>
  if (!isUuid(sessionId)) return { ok: false, error: 'Session invalide.' }
  if (typeof action !== 'string' || !(ADMIN_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: 'Action inconnue.' }
  }
  const a = action as VoteAdminAction

  if (DRAFT_ACTIONS.includes(a)) {
    const parsed = parseDraft(args, { sessionId, photoBase, partial: a === 'save_draft' })
    return parsed.ok ? { ok: true, value: { sessionId, action: a as DraftAction, args: parsed.value } } : parsed
  }

  const raw = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}

  if (a === 'reveal_next') {
    if (typeof raw.from !== 'number' || !Number.isInteger(raw.from) || raw.from < 0 || raw.from > 9) {
      return { ok: false, error: 'Étape invalide.' }
    }
    return { ok: true, value: { sessionId, action: a, args: { from: raw.from } } }
  }

  if (a === 'second_round') {
    const ids = raw.candidateIds
    if (!Array.isArray(ids) || !ids.every(isUuid)) return { ok: false, error: 'Finalistes invalides.' }
    const unique = [...new Set(ids)]
    if (unique.length < 2) return { ok: false, error: 'Choisissez au moins 2 finalistes.' }
    if (unique.length > VOTE_LIMITS.maxCandidates) return { ok: false, error: 'Trop de finalistes.' }
    return { ok: true, value: { sessionId, action: a, args: { candidateIds: unique } } }
  }

  return { ok: true, value: { sessionId, action: a as Exclude<VoteAdminAction, DraftAction | 'reveal_next' | 'second_round'>, args: {} } }
}
