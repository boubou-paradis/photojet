// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot - jeu de phrase masquée avec buzzers capitaines.
// `demimot` est l'identifiant technique : jamais affiché à l'utilisateur.

export const DEMIMOT_GAME_ID = 'demimot'

/** Signal de vie de la régie : toutes les 30 s. Pause des buzz après 90 s (fonction SQL). */
export const DEMIMOT_HEARTBEAT_INTERVAL_MS = 30_000
export const DEMIMOT_PAUSED_AFTER_MS = 90_000
/** /invite et /live ne montrent À Demi-Mot que si la régie a donné signe de vie depuis moins de 3 min. */
export const DEMIMOT_LIVE_STALE_MS = 3 * 60_000

/** Ping du téléphone capitaine (connexion gardée ouverte, latence mesurée). */
export const DEMIMOT_PING_INTERVAL_MS = 20_000
/** Un capitaine sans ping depuis 45 s est affiché « hors ligne ». */
export const DEMIMOT_OFFLINE_AFTER_MS = 45_000

/** Purge : 23 h après le dernier signal de vie (cron horaire → jamais plus de 24 h). */
export const DEMIMOT_PURGE_AFTER_MS = 23 * 60 * 60_000

/** Enregistrement refusé car la partie a changé entre-temps (un buzz) : on relit et on recommence. */
export const DEMIMOT_COMMIT_ATTEMPTS = 4

/** Plafonds de la bibliothèque d'un compte. */
export const DEMIMOT_LIBRARY_LIMITS = {
  maxPuzzles: 2000,
  maxSets: 100,
  /** Fichier importé (octets). */
  maxImportBytes: 1_000_000,
} as const

/** Canal privé de diffusion d'une session (policy realtime « demimot:% »). */
export function demimotTopic(sessionId: string): string {
  return `demimot:${sessionId}`
}

/** Équipes créées d'office au lancement (réglable ensuite en Préparation, de 2 à 20). */
export const DEMIMOT_DEFAULT_TEAM_COUNT = 4
/** Au-delà de ce nombre d'équipes, l'écran remplace les pupitres par un tableau des scores compact. */
export const DEMIMOT_LECTERN_MAX = 10
