// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Types d'AnimaVote. Les formes publiques sont celles que renvoie la
// fonction SQL vote_public_state (diffusée sur les canaux privés).

export type VoteDisplayMode = 'photo' | 'card' | 'text'
export type VoteResultsMode = 'live' | 'hidden'
export type VoteRevealMode = 'winner' | 'podium' | 'full'

/**
 * lobby : scrutin prêt, QR affiché, vote pas encore ouvert
 * open : vote ouvert (closesAt non nul = compte à rebours de fermeture en cours)
 * closed : plus aucun bulletin accepté, résultats pas encore révélés
 * revealed : révélation en cours ou terminée (revealStep)
 */
export type VoteStatus = 'lobby' | 'open' | 'closed' | 'revealed'

export interface VoteCandidate {
  id: string
  label: string
  number: string | null
  description: string | null
  imageUrl: string | null
  emoji: string | null
  color: string | null
  sortOrder: number
}

export interface VoteEvent {
  id: string
  roundNo: number
  parentId: string | null
  title: string
  subtitle: string | null
  intro: string | null
  thanks: string | null
  displayMode: VoteDisplayMode
  resultsMode: VoteResultsMode
  allowBlank: boolean
  shuffle: boolean
  countdownS: number
  revealMode: VoteRevealMode
  status: VoteStatus
  /** Heure de fin (serveur) pendant le compte à rebours, sinon null. */
  closesAt: string | null
  revealStep: number
  candidates: VoteCandidate[]
}

/** Totaux : nombre de bulletins par candidat. Jamais qui a voté pour qui. */
export interface VoteResults {
  blank: number
  counts: { id: string; votes: number }[]
}

export interface VoteActiveState {
  active: true
  /** Version : +1 à chaque changement d'étape. Les bulletins ne la changent pas (voir isNewer). */
  v: number
  event: VoteEvent | null
  participants: number
  /** Nombre total de bulletins (blancs compris). */
  total: number
  /** null tant que les résultats doivent rester cachés (et toujours pour les téléphones). */
  results: VoteResults | null
  serverNow: string
}

export interface VoteInactiveState {
  active: false
  serverNow: string
}

export type VoteState = VoteActiveState | VoteInactiveState

export type CastRejectReason = 'invalid' | 'no_game' | 'unknown_participant' | 'closed'

/** Réponse de vote_cast (appelée directement par le téléphone). */
export type CastResult =
  | { ok: true; already: boolean; candidateId: string | null; blank: boolean }
  | { ok: false; reason: CastRejectReason }

/** Candidat tel que saisi dans l'éditeur (avant enregistrement). */
export interface VoteCandidateInput {
  label: string
  number: string | null
  description: string | null
  imageUrl: string | null
  emoji: string | null
  color: string | null
}

/** Contenu de l'éditeur : un scrutin complet, prêt à lancer. */
export interface VoteDraft {
  title: string
  subtitle: string | null
  intro: string | null
  thanks: string | null
  displayMode: VoteDisplayMode
  resultsMode: VoteResultsMode
  allowBlank: boolean
  shuffle: boolean
  countdownS: number
  revealMode: VoteRevealMode
  candidates: VoteCandidateInput[]
}

/** Mon bulletin pour le scrutin affiché (route /api/vote/me). */
export interface VoteMyBallot {
  eventId: string
  candidateId: string | null
  blank: boolean
}

export interface VoteMe {
  myBallot: VoteMyBallot | null
  state: VoteState
}
