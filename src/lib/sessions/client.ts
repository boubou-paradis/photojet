// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import type { ActivationResult } from './activation'

/** Appelle la route d'activation. Lève une erreur si la route ne répond pas. */
export async function requestSessionState(body: {
  sessionId: string
  active: boolean
  confirmedIds?: string[]
}): Promise<ActivationResult> {
  const response = await fetch('/api/sessions/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Activation : HTTP ${response.status}`)
  return response.json()
}
