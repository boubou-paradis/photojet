// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo - loto 90 boules à la française. `bingo` est l'identifiant
// technique : jamais affiché à l'utilisateur.

export const BINGO_GAME_ID = 'bingo'

/** Canal privé de diffusion (écran + régie seulement, jamais les téléphones). */
export const bingoTopic = (sessionId: string): string => `bingo:${sessionId}`

/** Signal de vie de la régie : toutes les 30 s. Partie « en pause » après 90 s (fonction SQL). */
export const BINGO_HEARTBEAT_INTERVAL_MS = 30_000
/** /invite et /live ne montrent AnimaBingo que si la régie a donné signe de vie depuis moins de 3 min. */
export const BINGO_LIVE_STALE_MS = 3 * 60_000

/** Téléphones : lecture de l'état public toutes les 3 s, mis en cache 1 s par le CDN. */
export const BINGO_PHONE_POLL_MS = 3_000
export const BINGO_STATE_CACHE = 'public, s-maxage=1, stale-while-revalidate=2'
/** Suivi de SA demande de quine, seulement tant qu'elle attend. */
export const BINGO_CLAIM_POLL_MS = 1_500

export const BINGO_MAX_CARDS_PER_PLAYER = 4
export const BINGO_NAME_MAX = 20
/** Cartons papier : numéros à partir de 5001, 600 au plus par génération. */
export const BINGO_PAPER_FIRST_SERIAL = 5001
export const BINGO_PAPER_MAX_PER_BATCH = 600
/** Nouvel essai de fabrication si un carton existe déjà (signature en double). */
export const BINGO_JOIN_ATTEMPTS = 3

export const BINGO_PHASES = ['quine', 'double', 'plein'] as const
export const PHASE_LINES = { quine: 1, double: 2, plein: 3 } as const
export const PHASE_LABELS = { quine: 'Quine', double: 'Double quine', plein: 'Carton plein' } as const
