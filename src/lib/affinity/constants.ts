// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching - Le jeu des points communs.
// `affinity` est l'identifiant technique : jamais affiché à l'utilisateur.

export const AFFINITY_GAME_ID = 'affinity'

export const AFFINITY_LIMITS = {
  minQuestions: 5,
  maxQuestions: 20,
  minAnswers: 2,
  maxAnswers: 4,
  questionMaxLength: 120,
  answerMaxLength: 40,
  questionIdMaxLength: 64,
  nicknameMaxLength: 24,
  tableMaxLength: 12,
  /** Garde-fou contre l'inscription en masse sur une même partie. */
  maxPlayers: 500,
} as const

/** Chronos proposés à l'animateur, en secondes. `null` = infini. */
export const AFFINITY_TIME_LIMITS = [10, 15, 20, 30, null] as const
export const AFFINITY_DEFAULT_TIME_LIMIT = 20

/** Un résultat n'est affiché que si les deux joueurs ont répondu en commun à 60 % des questions révélées. */
export const AFFINITY_MIN_COMMON_RATIO = 0.6
export const AFFINITY_TOP_SIZE = 5

/** Tolérance réseau après la fin du chrono (la vérification réelle est dans la fonction SQL). */
export const AFFINITY_DEADLINE_GRACE_MS = 1000

/** Signal de vie de la page animateur : écrit toutes les 60 s, périmé après 3 min. */
export const AFFINITY_HEARTBEAT_INTERVAL_MS = 60_000
export const AFFINITY_HEARTBEAT_STALE_MS = 3 * 60_000

/** « Tes réponses sont effacées au plus tard 24 h après la partie ». */
export const AFFINITY_DATA_TTL_MS = 24 * 60 * 60_000
/** Le cron horaire purge à 23 h : avec un passage par heure, rien ne dépasse 24 h. */
export const AFFINITY_PURGE_AFTER_MS = 23 * 60 * 60_000

/** En dessous, une statistique collective n'a pas de sens (2 joueurs = 50 % / 50 %). */
export const AFFINITY_MIN_RESPONSES_FOR_STATS = 5
