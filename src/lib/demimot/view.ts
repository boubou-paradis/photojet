// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// À Demi-Mot — ce que voient l'écran public et les téléphones.
// La vue publique ne contient JAMAIS la solution entière (sauf une fois dévoilée),
// ni l'ordre futur des révélations, ni la banque d'énigmes.

import type { Settings } from './types'

export type PublicPhase =
  | 'waiting' // accueil, équipes qui rejoignent
  | 'ready' // énigme prête, structure affichée
  | 'revealing' // dévoilement en cours, buzzers ouverts
  | 'final_window' // toutes les lettres révélées, derniers instants
  | 'answering' // une équipe a la main
  | 'paused'
  | 'turn' // Tour de lettres : une équipe propose
  | 'resolved'
  | 'final_intro' // présentation de la Finale Déclic
  | 'podium'

export type GameMode = 'reveal' | 'letters'

export interface PublicTeam {
  id: string
  name: string
  color: string
  score: number
  /** Capitaine connecté (téléphone actif). */
  connected: boolean
  /** Bloquée pour l'énigme en cours. */
  blocked: boolean
}

export interface PublicCell {
  kind: 'letter' | 'punct' | 'space'
  /** null = lettre encore masquée. */
  ch: string | null
}

export interface PublicView {
  v: number
  serverNow: number
  phase: PublicPhase
  /** Couche d'affichage indépendante de la partie : rien n'est perdu au noir. */
  display: 'board' | 'standings' | 'rules' | 'black'
  code: string
  joinUrl: string
  /** Point d'intégration (futur serveur) : couleur du plateau choisie pour la session, horodatée.
   *  Absent dans la maquette : la préférence locale s'applique. Voir shared/prefs.ts → pickTheme. */
  theme?: { id: string; at: number } | null
  teams: PublicTeam[]
  round: null | {
    /** Identifiant d'énigme (change à chaque énigme : reconstruit le plateau). */
    key: string
    number: number
    total: number
    category: string
    mode: GameMode
    isFinal: boolean
    isTiebreak: boolean
    points: number
    cells: PublicCell[]
    hiddenCount: number
    /** Dernières positions révélées (pour l'animation seulement). */
    lastRevealed: number[]
    buzz: null | { teamId: string; deadline: number; totalMs: number }
    turn: null | { teamId: string; deadline: number | null; totalMs: number }
    finalWindowMs: number
    finalWindowEndsAt: number | null
    pausedFrom: null | 'revealing' | 'final_window' | 'answering' | 'turn' | 'ready'
    letters: { letter: string; hits: number; teamId: string }[]
    outcome: null | { kind: 'won'; teamId: string; points: number } | { kind: 'none'; reason: 'all_blocked' | 'time' | 'skipped' | 'revealed' }
    solutionShown: boolean
  }
  finale: null | { base: number; bonusPerHidden: number; puzzles: number }
  tie: null | { teamIds: string[] }
}

export type PhoneStatus =
  | 'connecting'
  | 'reconnecting'
  | 'choose_team'
  | 'waiting' // connecté, rien à faire
  | 'open' // buzzer ouvert
  | 'sent' // buzz envoyé, en attente de l'autorité
  | 'accepted' // l'équipe a la main
  | 'too_late' // une autre équipe a été plus rapide
  | 'blocked' // équipe bloquée pour cette énigme
  | 'letters_turn' // Tour de lettres : à vous de proposer (oralement)
  | 'revoked' // téléphone remplacé par l'animateur

/**
 * 20 couleurs d'équipes (et noms par défaut), dans l'ordre d'attribution.
 * Choisies par calcul pour rester distinctes deux à deux (écart CIEDE2000
 * minimal ≥ 15) et lisibles sur le fond sombre (contraste ≥ 3,6) : voir
 * __tests__/teams20.test.ts. Les 6 premières sont celles d'origine. Chaque
 * équipe porte aussi un NUMÉRO partout (écran, téléphone, régie).
 */
export const TEAM_PALETTE: { name: string; color: string }[] = [
  { name: 'Azur', color: '#3B82F6' },
  { name: 'Mandarine', color: '#F97316' },
  { name: 'Améthyste', color: '#A855F7' },
  { name: 'Framboise', color: '#EC4899' },
  { name: 'Lagon', color: '#22D3EE' },
  { name: 'Soleil', color: '#FACC15' },
  { name: 'Émeraude', color: '#25B154' },
  { name: 'Neige', color: '#F1F5F9' },
  { name: 'Citron vert', color: '#A8F906' },
  { name: 'Rubis', color: '#D22D2D' },
  { name: 'Menthe', color: '#7EFCD2' },
  { name: 'Saumon', color: '#E89992' },
  { name: 'Bronze', color: '#B18225' },
  { name: 'Sable', color: '#E8BD92' },
  { name: 'Orchidée', color: '#E192E8' },
  { name: 'Olive', color: '#A5B125' },
  { name: 'Ciel', color: '#7EBDFC' },
  { name: 'Sarcelle', color: '#25B1A5' },
  { name: 'Vanille', color: '#E8E892' },
  { name: 'Pétrole', color: '#258EB1' },
]

/** Équipes par défaut (noms et couleurs de la palette) pour un nombre donné. */
export function defaultTeams(count: number): { name: string; color: string }[] {
  return TEAM_PALETTE.slice(0, Math.max(0, Math.min(count, TEAM_PALETTE.length))).map((t) => ({ ...t }))
}

/** Prochaine équipe libre de la palette (ni son nom ni sa couleur déjà pris). */
export function nextFreeTeam(taken: readonly { name: string; color: string }[]): { name: string; color: string } {
  const lc = (v: string) => v.trim().toLocaleLowerCase('fr-FR')
  const free = TEAM_PALETTE.find((p) => !taken.some((d) => lc(d.name) === lc(p.name) || d.color.toUpperCase() === p.color.toUpperCase()))
  if (free) return { ...free }
  // Palette épuisée (couleurs modifiées à la main) : nom numéroté unique.
  let i = taken.length + 1
  while (taken.some((d) => lc(d.name) === lc(`Équipe ${i}`))) i++
  return { name: `Équipe ${i}`, color: TEAM_PALETTE[taken.length % TEAM_PALETTE.length].color }
}

// Vues de la régie et du téléphone (reprises du protocole du prototype).

export interface CaptainInfo {
  teamId: string
  connected: boolean
  since: number | null
  lastSeen: number | null
}

export interface RegieView {
  v: number
  public: PublicView
  /** Données privées : réservées à la régie, jamais envoyées au public ni aux téléphones. */
  private: {
    solution: string | null
    variants: string[]
    difficulty: string | null
    nextUp: { category: string; solution: string; mode: 'reveal' | 'letters' }[]
    hiddenAtBuzz: number | null
    /** Fenêtre du buzz à arbitrer (renvoyée avec judge / cancelBuzz). */
    buzzWindowId: number | null
    potentialPoints: number | null
    /** Prochaine échéance du moteur (ms, heure serveur) : la régie envoie « tick » à cette heure. */
    nextDueAt: number | null
  }
  phase: 'waiting' | 'round' | 'final_intro' | 'end_tie' | 'podium'
  stage: 'main' | 'finale' | 'tiebreak'
  settings: Settings
  captains: CaptainInfo[]
  undo: string | null
  log: { at: number; text: string }[]
  connections: { public: number; regie: number; phones: number }
}

export interface PhoneView {
  v: number
  serverNow: number
  code: string
  status: PhoneStatus
  team: PublicTeam | null
  teams: PublicTeam[]
  takenTeamIds: string[]
  otherTeamName?: string
  /** Fenêtre de buzz ouverte (à renvoyer avec le buzz). */
  windowId: number | null
  deadline: number | null
  phase: PublicView['phase']
  category: string | null
}
