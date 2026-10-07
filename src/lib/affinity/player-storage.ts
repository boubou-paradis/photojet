// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Identité du joueur sur son téléphone : gardée dans le localStorage pour
// retrouver sa partie après un rechargement ou une coupure réseau. Le stockage
// peut être indisponible (navigation privée) : on joue alors sans reprise.

export interface StoredAffinityPlayer {
  sessionId: string
  playerId: string
  token: string
  nickname: string
}

const keyFor = (code: string) => `matching-player-${code}`

export function readStoredPlayer(code: string): StoredAffinityPlayer | null {
  try {
    const raw = window.localStorage.getItem(keyFor(code))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { sessionId, playerId, token, nickname } = value as Record<string, unknown>
    if (typeof sessionId !== 'string' || typeof playerId !== 'string' || typeof token !== 'string' || typeof nickname !== 'string') return null
    return { sessionId, playerId, token, nickname }
  } catch {
    return null
  }
}

export function storePlayer(code: string, player: StoredAffinityPlayer): void {
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
export function findStoredPlayerBySession(sessionId: string): { code: string; player: StoredAffinityPlayer } | null {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith('matching-player-')) continue
      const code = key.slice('matching-player-'.length)
      const player = readStoredPlayer(code)
      if (player?.sessionId === sessionId) return { code, player }
    }
  } catch {
    /* idem */
  }
  return null
}
