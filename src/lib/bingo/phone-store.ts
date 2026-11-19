// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Mémoire du téléphone d'un joueur (stockage local du navigateur, AUCUNE
// écriture en base) : jeton, cartons, coches et demande de quine pas encore
// partie. Survit au rechargement, à la fermeture du navigateur, aux
// coupures réseau. Une entrée par code de session.
//
// Tout accès au stockage est protégé : navigation privée, stockage plein ou
// bloqué → le jeu continue en mémoire, sans planter.

import type { Cells } from './types'

export interface StoredCard { id: string; serial: number; cells: Cells }

/** Demande de quine en attente d'envoi (réseau coupé) ou envoyée et suivie. */
export interface StoredClaim {
  cardId: string
  marks: number[]
  /** Phase en cours au moment de l'appui : si elle a changé, la demande n'est pas renvoyée. */
  phaseIndex: number
  round: number
  createdAt: number
  /** null tant que le serveur n'a pas confirmé la réception. */
  claimId: number | null
}

export interface PhoneMemory {
  v: 1
  token: string
  name: string
  gameId: string
  round: number
  cards: StoredCard[]
  /** Coches par carton (id → numéros). */
  marks: Record<string, number[]>
  claim: StoredClaim | null
  savedAt: number
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const KEY = (code: string) => `animabingo:${code.toUpperCase()}`
/** Mémoire gardée 2 jours : une soirée qui déborde ne perd rien. */
const MAX_AGE_MS = 48 * 3600_000

function defaultStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function isMemory(x: unknown): x is PhoneMemory {
  if (!x || typeof x !== 'object') return false
  const m = x as Record<string, unknown>
  return m.v === 1 && typeof m.token === 'string' && typeof m.gameId === 'string' && Array.isArray(m.cards)
    && typeof m.marks === 'object' && m.marks !== null && typeof m.round === 'number'
}

export function loadMemory(code: string, store: KeyValueStore | null = defaultStore(), now = Date.now()): PhoneMemory | null {
  if (!store) return null
  try {
    const raw = store.getItem(KEY(code))
    if (!raw) return null
    const m: unknown = JSON.parse(raw)
    if (!isMemory(m) || now - (m.savedAt ?? 0) > MAX_AGE_MS) return null
    return m
  } catch {
    return null
  }
}

/** Enregistre ; renvoie false si le stockage est indisponible (le jeu continue en mémoire). */
export function saveMemory(code: string, m: PhoneMemory, store: KeyValueStore | null = defaultStore(), now = Date.now()): boolean {
  if (!store) return false
  try {
    store.setItem(KEY(code), JSON.stringify({ ...m, savedAt: now }))
    return true
  } catch {
    return false
  }
}

export function clearMemory(code: string, store: KeyValueStore | null = defaultStore()): void {
  try { store?.removeItem(KEY(code)) } catch { /* rien à faire */ }
}

/** Coche / décoche un numéro de SON carton (ignoré s'il n'est pas dessus). */
export function toggleMark(m: PhoneMemory, cardId: string, n: number): PhoneMemory {
  const card = m.cards.find((c) => c.id === cardId)
  if (!card || !card.cells.includes(n) || n === 0) return m
  const cur = m.marks[cardId] ?? []
  const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b)
  return { ...m, marks: { ...m.marks, [cardId]: next } }
}

/**
 * Mise à jour quand le serveur annonce une partie / manche : même partie et
 * même manche → on garde tout ; nouvelle manche de la même partie → mêmes
 * cartons, coches remises à zéro ; autre partie → la mémoire n'est plus valable.
 */
export function reconcile(m: PhoneMemory, gameId: string, round: number): PhoneMemory | null {
  if (m.gameId !== gameId) return null
  if (m.round === round) return m
  return { ...m, round, marks: {}, claim: null }
}

/** Une demande en attente d'envoi doit-elle partir maintenant ? */
export function claimToSend(m: PhoneMemory, live: { round: number; phaseIndex: number; status: string }): 'send' | 'stale' | 'none' {
  const c = m.claim
  if (!c || c.claimId !== null) return 'none'
  if (c.round !== live.round || c.phaseIndex !== live.phaseIndex) return 'stale'
  return live.status === 'running' || live.status === 'checking' || live.status === 'celebrating' ? 'send' : 'none'
}
