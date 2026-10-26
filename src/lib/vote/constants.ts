// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaVote - Le vote live qui fait participer toute la salle.
// `vote` est l'identifiant technique : jamais affiché à l'utilisateur.

export const VOTE_GAME_ID = 'vote'

export const VOTE_LIMITS = {
  /** « Le vote est complet » au-delà (vérifié en base, sous verrou). */
  maxParticipants: 300,
  minCandidates: 2,
  /** Au-delà, l'éditeur affiche un avertissement (lisibilité sur téléphone). */
  recommendedMaxCandidates: 20,
  maxCandidates: 30,
  titleMaxLength: 80,
  subtitleMaxLength: 120,
  introMaxLength: 280,
  thanksMaxLength: 280,
  labelMaxLength: 40,
  numberMaxLength: 6,
  descriptionMaxLength: 80,
  emojiMaxLength: 16,
} as const

/** Compte à rebours de fermeture, en secondes. 0 = fermeture immédiate. */
export const VOTE_COUNTDOWNS_S = [0, 5, 10, 15] as const
export const VOTE_DEFAULT_COUNTDOWN_S = 10

/** Signal de vie de la page animateur : toutes les 30 s. */
export const VOTE_HEARTBEAT_INTERVAL_MS = 30_000
/** /invite et /live ne montrent AnimaVote que si l'animateur a donné signe de vie depuis moins de 3 min. */
export const VOTE_LIVE_STALE_MS = 3 * 60_000

/** Purge : 23 h après le dernier signal de vie (cron horaire → jamais plus de 24 h). */
export const VOTE_PURGE_AFTER_MS = 23 * 60 * 60_000
export const VOTE_DATA_TTL_MS = 24 * 60 * 60_000

/** Photos des candidats : bucket `photos`, dossier propre à AnimaVote. */
export const VOTE_PHOTO_BUCKET = 'photos'
export const VOTE_PHOTO_FOLDER = 'vote-photos'
/** Photo déjà compressée par le navigateur (1080 px) : 2 Mo suffisent largement. */
export const VOTE_PHOTO_MAX_BYTES = 2 * 1024 * 1024
export const VOTE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Canal privé des téléphones : changements d'étape seulement (policy realtime « vote:% »). */
export function voteTopic(sessionId: string): string {
  return `vote:${sessionId}`
}

/** Canal privé de l'écran géant : totaux à chaque bulletin (policy realtime « vote-live:% »). */
export function voteLiveTopic(sessionId: string): string {
  return `vote-live:${sessionId}`
}
