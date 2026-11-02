// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { ACTIVATION_DENIED_CODE, type ActivationResult } from './activation'

/**
 * Appelle la route d'activation. Lève une erreur si la route ne répond pas.
 * Un refus d'accès n'est pas une panne : il ne doit pas déclencher l'écriture de secours.
 */
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
  if (response.status === 403) {
    const payload = await response.json().catch(() => null)
    if (payload?.code === ACTIVATION_DENIED_CODE) return { status: 'denied' }
  }
  if (!response.ok) throw new Error(`Activation : HTTP ${response.status}`)
  return response.json()
}
