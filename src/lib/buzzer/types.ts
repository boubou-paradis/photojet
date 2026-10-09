// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Types d'AnimaBuzz. Les formes publiques sont celles que renvoie la
// fonction SQL buzzer_public_state (diffusée sur le canal privé).

export type BuzzerMode = 'solo' | 'team'

/**
 * lobby : partie lancée, inscriptions, buzzers fermés
 * test : test des buzzers (chaque téléphone appuie une fois)
 * waiting : manche prête, buzzers fermés
 * open : buzzers ouverts
 * buzzed : quelqu'un a buzzé (fenêtre puis main au prioritaire)
 * closed : manche terminée (gagnée, sans réponse ou annulée)
 */
export type BuzzerPhase = 'lobby' | 'test' | 'waiting' | 'open' | 'buzzed' | 'closed'

export type BuzzerOutcome = 'won' | 'no_answer' | 'cancelled'

export type BuzzStatus = 'queued' | 'priority' | 'blocked' | 'won'

export interface BuzzerQueueEntry {
  rank: number
  /** « p:<joueur> » ou « t:<équipe> » */
  unit: string
  label: string
  status: BuzzStatus
  gapMs: number
}

export interface BuzzerActiveState {
  active: true
  /** Version : +1 à chaque changement. Un état plus ancien que celui affiché est ignoré. */
  v: number
  phase: BuzzerPhase
  mode: BuzzerMode
  teams: string[]
  windowMs: number
  timerS: number | null
  roundNo: number
  attempt: number
  openedAt: string | null
  deadlineAt: string | null
  firstBuzzAt: string | null
  priority: { unit: string; label: string } | null
  queue: BuzzerQueueEntry[]
  blocked: string[]
  outcome: BuzzerOutcome | null
  winner: string | null
  paused: boolean
  serverNow: string
}

export interface BuzzerInactiveState {
  active: false
  serverNow: string
}

export type BuzzerState = BuzzerActiveState | BuzzerInactiveState

export type BuzzRejectReason =
  | 'invalid'
  | 'no_game'
  | 'unknown_player'
  | 'removed'
  | 'paused'
  | 'closed'
  | 'too_late'
  | 'blocked'

/** Réponse de buzzer_buzz (appelée directement par le téléphone). */
export type BuzzResult =
  | { ok: true; kind: 'buzz'; rank: number; gapMs: number; first: boolean; already?: boolean }
  | { ok: true; kind: 'test' }
  | { ok: false; reason: BuzzRejectReason }

/** Joueur tel que le voit l'animateur (jamais envoyé aux téléphones). */
export interface BuzzerAdminPlayer {
  id: string
  label: string
  team: string | null
  online: boolean
  rttMs: number | null
  tested: boolean
}

export interface BuzzerRoundSummary {
  roundNo: number
  outcome: BuzzerOutcome | null
  winner: string | null
}

/** Mon état dans la manche en cours (route /api/buzzer/me). */
export interface BuzzerMyRound {
  rank: number
  gapMs: number
  status: BuzzStatus
  attempt: number
}

export interface BuzzerMe {
  nickname: string | null
  team: string | null
  unit: string
  tested: boolean
  myRound: BuzzerMyRound | null
  state: BuzzerState
}
