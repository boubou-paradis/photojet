// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Identité du joueur AnimaBuzz sur son téléphone : gardée dans le
// localStorage pour retrouver sa partie après un rechargement, une coupure
// réseau ou une mise en veille, sans rien ressaisir. Stockage indisponible
// (navigation privée) : on joue quand même, sans reprise.

export interface StoredBuzzerPlayer {
  sessionId: string
  playerId: string
  token: string
  /** « p:<joueur> » ou « t:<équipe> » : identifie mon entrée dans la file. */
  unit: string
  label: string
}

const PREFIX = 'buzzer-player-'
const keyFor = (code: string) => `${PREFIX}${code}`

function parse(raw: string | null): StoredBuzzerPlayer | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { sessionId, playerId, token, unit, label } = value as Record<string, unknown>
    if ([sessionId, playerId, token, unit, label].some((v) => typeof v !== 'string')) return null
    return { sessionId, playerId, token, unit, label } as StoredBuzzerPlayer
  } catch {
    return null
  }
}

export function readStoredPlayer(code: string): StoredBuzzerPlayer | null {
  try {
    return parse(window.localStorage.getItem(keyFor(code)))
  } catch {
    return null
  }
}

export function storePlayer(code: string, player: StoredBuzzerPlayer): void {
  try {
    window.localStorage.setItem(keyFor(code), JSON.stringify(player))
  } catch {
    /* stockage indisponible : la partie reste jouable, sans reprise */
  }
}

export function forgetPlayer(code: string): void {
  try {
    window.localStorage.removeItem(keyFor(code))
  } catch {
    /* idem */
  }
}

/** Retrouve le joueur d'une session à partir de son id (page de jeu). */
export function findStoredPlayerBySession(sessionId: string): { code: string; player: StoredBuzzerPlayer } | null {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const player = parse(window.localStorage.getItem(key))
      if (player?.sessionId === sessionId) return { code: key.slice(PREFIX.length), player }
    }
  } catch {
    /* idem */
  }
  return null
}
