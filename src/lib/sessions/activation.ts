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
  | { status: 'denied' }

/** Code renvoyé par la route : les écrans ne repassent pas en écriture directe. */
export const ACTIVATION_DENIED_CODE = 'no_access'
export const ACTIVATION_DENIED_MESSAGE = 'Votre accès a expiré. Abonnez-vous pour réactiver cette session.'

export interface ActivationAccessRow {
  status: string
  current_period_end: string | null
  trial_end: string | null
  pass_validity_until: string | null
}

// Mêmes règles que isSubscriptionValid (middleware), ligne par ligne : une seule
// ligne valide suffit, comme dans le cron check-expiring.
function isRowValid(row: ActivationAccessRow, now: Date, weekendBlocked: boolean): boolean {
  if (row.status === 'weekend_pass') {
    return !!row.pass_validity_until && now < new Date(row.pass_validity_until)
  }
  if (row.status === 'trialing') {
    return !!row.trial_end && !weekendBlocked && now < new Date(row.trial_end)
  }
  if (row.status === 'active') {
    return !row.current_period_end || now < new Date(row.current_period_end)
  }
  return false
}

export function hasActivationAccess(
  role: string | null | undefined,
  rows: ActivationAccessRow[],
  now: Date,
  weekendBlocked: boolean
): boolean {
  if (role === 'owner') return true
  return rows.some((row) => isRowValid(row, now, weekendBlocked))
}

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

export function quoteSessionNames(others: ActiveSessionInfo[]): string {
  return joinSessionNames(others.map((s) => ({ ...s, name: `“${s.name || 'Événement'}”` })))
}

/** Au-delà de cette longueur, le nom reste dans le texte et le bouton dit « Basculer ». */
const MAX_NAME_IN_BUTTON = 24

export function switchButtonLabel(targetName: string): string {
  const name = targetName.trim()
  return name && name.length <= MAX_NAME_IN_BUTTON ? `Activer ${name}` : 'Basculer'
}
