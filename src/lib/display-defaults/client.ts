// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Appels navigateur vers /api/account/display-defaults.

import type { Session } from '@/types/database'
import type { DisplaySettings } from './settings'

export interface DisplayDefaults {
  settings: DisplaySettings
  updated_at: string
}

export type ApplyDefaultsResult =
  | { status: 'none' }
  | { status: 'applied'; session: Session; warnings: string[] }

const URL_PATH = '/api/account/display-defaults'

async function call<T>(init?: RequestInit): Promise<T> {
  const res = await fetch(URL_PATH, init)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error || 'Erreur technique, réessayez.')
  return body as T
}

const post = <T>(payload: object) =>
  call<T>({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

export async function fetchDisplayDefaults(): Promise<DisplayDefaults | null> {
  return (await call<{ defaults: DisplayDefaults | null }>()).defaults
}

export async function saveDisplayDefaults(sessionId: string): Promise<DisplayDefaults> {
  return (await post<{ defaults: DisplayDefaults }>({ action: 'save', sessionId })).defaults
}

export function applyDisplayDefaults(sessionId: string): Promise<ApplyDefaultsResult> {
  return post<ApplyDefaultsResult>({ action: 'apply', sessionId })
}

export async function deleteDisplayDefaults(): Promise<void> {
  await post({ action: 'delete' })
}
