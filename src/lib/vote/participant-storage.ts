// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Identité du téléphone AnimaVote : gardée dans le localStorage pour
// retrouver le vote après un rechargement, une coupure réseau ou une mise en
// veille (et ne pas recevoir un nouveau droit de vote). Stockage indisponible
// (navigation privée) : on vote quand même, sans reprise.

export interface StoredVoteParticipant {
  sessionId: string
  participantId: string
  token: string
}

const PREFIX = 'vote-participant-'
const keyFor = (code: string) => `${PREFIX}${code}`

function parse(raw: string | null): StoredVoteParticipant | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { sessionId, participantId, token } = value as Record<string, unknown>
    if ([sessionId, participantId, token].some((v) => typeof v !== 'string')) return null
    return { sessionId, participantId, token } as StoredVoteParticipant
  } catch {
    return null
  }
}

export function readStoredParticipant(code: string): StoredVoteParticipant | null {
  try {
    return parse(window.localStorage.getItem(keyFor(code)))
  } catch {
    return null
  }
}

export function storeParticipant(code: string, participant: StoredVoteParticipant): void {
  try {
    window.localStorage.setItem(keyFor(code), JSON.stringify(participant))
  } catch {
    /* stockage indisponible : le vote reste possible, sans reprise */
  }
}

export function forgetParticipant(code: string): void {
  try {
    window.localStorage.removeItem(keyFor(code))
  } catch {
    /* idem */
  }
}
