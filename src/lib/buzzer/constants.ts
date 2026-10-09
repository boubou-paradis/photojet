// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz - Le buzzer live d'AnimaJet.
// `buzzer` est l'identifiant technique : jamais affiché à l'utilisateur.

export const BUZZER_GAME_ID = 'buzzer'

export const BUZZER_LIMITS = {
  /** « La partie est complète » au-delà (vérifié en base, sous verrou). */
  maxPlayers: 200,
  nicknameMaxLength: 24,
  teamMaxLength: 24,
  maxTeams: 30,
} as const

/** Fenêtre après le 1er buzz pendant laquelle les suivants sont encore classés. 0 = verrouillage immédiat. */
export const BUZZER_WINDOWS_MS = [0, 500, 1000, 1500, 2000, 3000] as const
export const BUZZER_DEFAULT_WINDOW_MS = 1500

/** Chronos proposés à l'animateur, en secondes. `null` = sans chrono. */
export const BUZZER_TIMERS_S = [null, 5, 10, 15, 20, 30] as const
export const BUZZER_DEFAULT_TIMER_S = null

/** Signal de vie de la page animateur : toutes les 30 s. Pause des buzz après 90 s (fonction SQL). */
export const BUZZER_HEARTBEAT_INTERVAL_MS = 30_000
export const BUZZER_PAUSED_AFTER_MS = 90_000
/** /invite et /live ne montrent AnimaBuzz que si l'animateur a donné signe de vie depuis moins de 3 min. */
export const BUZZER_LIVE_STALE_MS = 3 * 60_000

/** Ping du téléphone (connexion gardée ouverte, latence mesurée). */
export const BUZZER_PING_INTERVAL_MS = 20_000
/** Un téléphone sans ping depuis 45 s est affiché « hors ligne » à l'animateur. */
export const BUZZER_OFFLINE_AFTER_MS = 45_000

/** Purge : 23 h après le dernier signal de vie (cron horaire → jamais plus de 24 h). */
export const BUZZER_PURGE_AFTER_MS = 23 * 60 * 60_000
export const BUZZER_DATA_TTL_MS = 24 * 60 * 60_000

/** Canal privé de diffusion d'une session (policy realtime « buzzer:% »). */
export function buzzerTopic(sessionId: string): string {
  return `buzzer:${sessionId}`
}
