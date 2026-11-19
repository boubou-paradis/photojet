// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import type { BINGO_PHASES } from './constants'

export type Phase = (typeof BINGO_PHASES)[number]
export type BingoStatus = 'lobby' | 'running' | 'checking' | 'celebrating' | 'finished'
export type AutoMode = 'manual' | 'auto' | 'paused'

/** Réglages de la partie (bingo_runtime.settings). `public` est lisible par l'écran et les téléphones. */
export interface BingoSettings {
  cardsPerPlayer: 1 | 2 | 3 | 4
  /** Une demande de quine met la partie en vérification et le tirage auto en pause. */
  pauseOnClaim: boolean
  voice: 'off' | 'tts' | 'recordings'
  /** Fin d'une étape (dernier lot gagné) : bouton de l'animateur (défaut) ou passage tout seul après 8 s. */
  advance: 'manual' | 'auto'
  /** Plusieurs gagnants sur la même boule : un seul lot partagé (défaut) ou un lot chacun. */
  tie: 'shared' | 'each'
  /** Étape à plusieurs lots : un même carton peut regagner avec de nouvelles lignes (défaut : non). */
  repeatCard: boolean
  /** Formule choisie en préparation (affichage seulement, la base ne lit que étapes et lots). */
  formula: 'classic' | 'plein' | 'suivie' | 'custom'
  public: {
    /** Dernier numéro affiché sur les téléphones. */
    showLast: boolean
    /** Prénom du gagnant à l'écran (sinon numéro de carton). */
    showName: boolean
    /** Grand écran : la machine et la boule, ou le tableau des 90 (touche B). */
    screen: 'machine' | 'board'
  }
}

/** Un carton : 27 cases lues ligne par ligne, 0 = case vide. */
export type Cells = number[]

export interface BingoCardDraft {
  cells: Cells
  signature: string
}

export interface BingoWinner {
  phase: Phase
  serial: number
  kind: 'phone' | 'paper'
  name: string | null
  lines: number
  drawCount: number
  /** Lot gagné dans l'étape (1, 2…) ; ex aequo d'une même boule = même lot (réglage par défaut). */
  lot?: number
}

/** Forme exacte renvoyée par bingo_public_state. */
export type BingoPublicState =
  | { active: false; serverNow: string; held?: boolean; gameId?: string | null; v?: undefined }
  | {
      active: true
      v: number
      gameId: string
      round: number
      status: BingoStatus
      phases: Phase[]
      phaseIndex: number
      drawn: number[]
      count: number
      last: number | null
      lastDrawAt: string | null
      revealAt: string | null
      /** Loto musical : le dernier titre tiré est encore caché (pas dans `drawn`, ni `count`). */
      hidden?: boolean
      /** Loto musical : empreinte et nombre de titres de la playlist figée (absent = numéros). */
      music?: { sig: string; n: number } | null
      autoMode: AutoMode
      autoMs: number
      display: Partial<BingoSettings['public']>
      players: number
      pending: number
      winners: BingoWinner[]
      /** Nombre de lots de chaque étape (même ordre que phases). Absent : 1 partout. */
      lots?: number[]
      /** Lots déjà gagnés dans l'étape en cours. */
      lotsUsed?: number
      /** Tous les lots de l'étape en cours sont gagnés : on passe à la suite. */
      phaseDone?: boolean
      advance?: 'manual' | 'auto'
      /** Dernier gagnant validé de l'étape en cours (heure serveur). */
      lastWinAt?: string | null
      /** Régie silencieuse depuis plus de 90 s (PC planté, coupure) : rien n'est perdu. */
      paused: boolean
      /** Présent quand un lancement a repris une partie existante. */
      resumedGame?: boolean
      serverNow: string
    }

export interface LineCheck {
  nums: number[]
  missing: number[]
  complete: boolean
}

export interface ClaimCheck {
  valid: boolean
  completeLines: number
  lines: LineCheck[]
  /** Cases cochées dont le numéro n'est pas sorti. */
  markedNotDrawn: number[]
  /** Numéros sortis non cochés (sans effet sur le verdict). */
  drawnNotMarked: number[]
  /** Rang (1 = 1re boule) de la boule qui a complété le nombre de lignes requis, null si jamais. */
  completedAt: number | null
}
