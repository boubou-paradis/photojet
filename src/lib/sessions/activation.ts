// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Une seule session active par compte : règles pures et types partagés entre la
// route, le tableau de bord et les paramètres. Aucune dépendance serveur ici.

/** Une photo reçue depuis moins longtemps compte comme activité. */
export const RECENT_PHOTO_HOURS = 6
/** Une borne vue depuis moins longtemps compte comme en ligne. */
export const BORNE_ONLINE_MINUTES = 5

/** Colonnes qui disent qu'un jeu est ouvert. Lues telles quelles, jamais écrites. */
export const GAME_ACTIVITY_COLUMNS = [
  'mystery_photo_active',
  'mystery_is_playing',
  'lineup_active',
  'wheel_active',
  'quiz_active',
  'quiz_lobby_visible',
  'affinity_active',
  'buzzer_active',
  'vote_active',
] as const

export interface ActiveSessionInfo {
  id: string
  name: string
  /** Un événement semble en cours : avertissement renforcé. */
  busy: boolean
}

export type ActivationResult =
  | { status: 'activated'; deactivated: string[]; degraded?: boolean }
  | { status: 'already_active' }
  | { status: 'deactivated' }
  | { status: 'conflict'; others: ActiveSessionInfo[] }

export function hasOpenGame(row: Record<string, unknown>): boolean {
  return GAME_ACTIVITY_COLUMNS.some((column) => row[column] === true)
}

/** Liste d'identifiants séparés par des virgules (variable d'environnement). */
export function isExemptUser(userId: string, exemptList: string | undefined): boolean {
  if (!exemptList) return false
  return exemptList.split(',').some((id) => id.trim() === userId)
}

export function joinSessionNames(others: ActiveSessionInfo[]): string {
  const names = others.map((s) => s.name || 'Événement')
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
}
