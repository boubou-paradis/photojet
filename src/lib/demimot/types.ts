// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// À Demi-Mot — état complet de l'autorité (privé : contient les solutions et l'ordre des révélations).
// Seules les projections (project.ts) sortent de l'autorité.

import type { Cell } from './text'
import type { GameMode } from './view'

export const STATE_SCHEMA = 1

export type Difficulty = 'facile' | 'moyen' | 'difficile'

export interface Puzzle {
  id: string
  category: string
  solution: string
  /** Formulations également acceptées (aide animateur, jamais affichées au public). */
  variants: string[]
  difficulty: Difficulty
  /** null = valeur par défaut de la partie. */
  points: number | null
  active: boolean
}

export interface Settings {
  /** Énigmes de la partie principale (hors finale et départage). */
  puzzleCount: number
  /** Les N dernières énigmes de la partie principale se jouent en Tour de lettres (0 = toutes en Révélation). */
  lettersRounds: number
  pointsPerPuzzle: number
  revealIntervalMs: number
  answerMs: number
  finalWindowMs: number
  /** Retrait de points sur mauvaise réponse (0 = aucun, par défaut). */
  wrongPenalty: number
  turnMs: number
  finale: { enabled: boolean; puzzles: number; base: number; bonusPerHidden: number }
  /** Jeux d'énigmes utilisés pour le tirage (vide = toute la banque active). */
  setIds: string[]
  theme: { id: string; at: number } | null
}

export const DEFAULT_SETTINGS: Settings = {
  puzzleCount: 10,
  lettersRounds: 3,
  pointsPerPuzzle: 100,
  revealIntervalMs: 1200,
  answerMs: 8000,
  finalWindowMs: 5000,
  wrongPenalty: 0,
  turnMs: 20000,
  finale: { enabled: true, puzzles: 3, base: 100, bonusPerHidden: 10 },
  setIds: [],
  theme: null,
}

export interface Team {
  id: string
  name: string
  color: string
  score: number
}

export type RoundStatus = 'ready' | 'revealing' | 'final_window' | 'answering' | 'paused' | 'turn' | 'resolved'

export interface Round {
  key: string
  number: number
  total: number
  puzzle: Puzzle
  mode: GameMode
  isFinal: boolean
  isTiebreak: boolean
  /** Valeur de base de l'énigme (finale : base, le bonus est figé au buzz). */
  points: number
  cells: Cell[]
  revealed: boolean[]
  /** Permutation des positions de lettres, tirée une seule fois par énigme (Révélation). */
  order: number[]
  cursor: number
  status: RoundStatus
  /** Échéances absolues (ms, horloge de l'autorité). */
  nextRevealAt: number | null
  finalWindowEndsAt: number | null
  /** Fenêtre d'ouverture des buzzers : change à chaque ouverture ; un buzz d'une ancienne fenêtre est refusé. */
  windowId: number
  buzz: null | { teamId: string; windowId: number; at: number; deadline: number; totalMs: number; hiddenAtBuzz: number; resume: 'revealing' | 'final_window'; resumeMs: number }
  /** Équipes bloquées pour cette énigme (Révélation) ; équipes hors départage. */
  blocked: string[]
  paused: null | { from: Exclude<RoundStatus, 'paused' | 'resolved'>; remainingMs: number | null }
  /** Tour de lettres. */
  turnTeamId: string | null
  turnDeadline: number | null
  letters: { letter: string; hits: number; teamId: string }[]
  lastRevealed: number[]
  outcome: null | { kind: 'won'; teamId: string; points: number } | { kind: 'none'; reason: 'all_blocked' | 'time' | 'skipped' | 'revealed' }
  solutionShown: boolean
}

export type GamePhase = 'waiting' | 'round' | 'final_intro' | 'end_tie' | 'podium'

export interface LogEntry {
  at: number
  text: string
}

/** Instantané pour « Annuler le dernier arbitrage » (restauration atomique scores + manche). */
export interface UndoSnapshot {
  label: string
  teams: Team[]
  round: Round
}

export interface GameState {
  schema: number
  /** Version de l'état : +1 à chaque changement (protection contre les événements anciens). */
  v: number
  code: string
  phase: GamePhase
  display: 'board' | 'standings' | 'rules' | 'black'
  settings: Settings
  teams: Team[]
  /** Énigmes tirées pour la partie (copiées au tirage : une modification ultérieure de la banque ne change pas l'énigme active). */
  plan: { puzzles: Puzzle[]; finale: Puzzle[] }
  roundIndex: number
  /** 'main' | 'finale' | 'tiebreak' */
  stage: 'main' | 'finale' | 'tiebreak'
  round: Round | null
  usedPuzzleIds: string[]
  undo: UndoSnapshot[]
  log: LogEntry[]
  seed: number
  createdAt: number
  updatedAt: number
}
