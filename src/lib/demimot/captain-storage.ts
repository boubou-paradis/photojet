// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Identité du capitaine À Demi-Mot sur son téléphone (localStorage) : il
// retrouve son équipe après un rechargement, une coupure réseau ou une mise
// en veille. Stockage indisponible (navigation privée) : on joue quand même,
// sans reprise.

export interface StoredCaptain {
  code: string
  sessionId: string
  teamId: string
  token: string
  teamName: string
}

const PREFIX = 'demimot-capitaine-'

function parse(raw: string | null): StoredCaptain | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Record<string, unknown>
    if (!v || typeof v !== 'object') return null
    if (['code', 'sessionId', 'teamId', 'token', 'teamName'].some((k) => typeof v[k] !== 'string')) return null
    return { code: v.code, sessionId: v.sessionId, teamId: v.teamId, token: v.token, teamName: v.teamName } as StoredCaptain
  } catch {
    return null
  }
}

export function readCaptain(code: string): StoredCaptain | null {
  try {
    return parse(window.localStorage.getItem(PREFIX + code))
  } catch {
    return null
  }
}

export function storeCaptain(c: StoredCaptain): void {
  try {
    window.localStorage.setItem(PREFIX + c.code, JSON.stringify(c))
  } catch {
    /* stockage indisponible */
  }
}

export function forgetCaptain(code: string): void {
  try {
    window.localStorage.removeItem(PREFIX + code)
  } catch {
    /* idem */
  }
}

export function findCaptainBySession(sessionId: string): StoredCaptain | null {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const c = parse(window.localStorage.getItem(key))
      if (c?.sessionId === sessionId) return c
    }
  } catch {
    /* idem */
  }
  return null
}
