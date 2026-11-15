// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Appels de la régie À Demi-Mot (/api/demimot/admin). La page n'écrit rien
// elle-même : chaque action est vérifiée et enregistrée par le serveur.

import type { GameEvent } from '@/lib/demimot/engine'
import type { DemiMotPublicState } from '@/lib/demimot/gate'
import type { RegieView } from '@/lib/demimot/view'
import type { RegieCommand } from '@/lib/demimot/validation'

export interface AdminResult {
  ok: boolean
  status: number
  error?: string
  code?: string
  state?: DemiMotPublicState
  regie?: RegieView | null
  resumed?: boolean
  /** Événements du moteur pendant l'action (sons de la régie). */
  events?: GameEvent[]
}

export type AdminBody =
  | { action: 'snapshot' | 'launch' | 'exit' | 'heartbeat' }
  | { action: 'release'; teamId: string }
  | { action: 'command'; command: RegieCommand }

export async function callAdmin(sessionId: string, body: AdminBody): Promise<AdminResult> {
  try {
    const res = await fetch('/api/demimot/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...body }),
    })
    const data = (await res.json().catch(() => ({}))) as Omit<AdminResult, 'ok' | 'status'>
    return { ...data, ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0, error: 'Connexion impossible, réessayez.' }
  }
}

/** Envoi d'une commande depuis l'interface (confirmation facultative). */
export type Send = (cmd: RegieCommand, confirmText?: string) => Promise<AdminResult | null>
