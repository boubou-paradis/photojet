// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Appels de la régie AnimaBingo (/api/bingo/admin). La page n'écrit rien
// elle-même : chaque action est vérifiée et enregistrée par la base.

import type { RegieSnapshot } from '@/lib/bingo/server'
import type { BingoSettings, Phase } from '@/lib/bingo/types'

export type AdminBody =
  | { action: 'launch' | 'new_game'; settings: BingoSettings; phases: Phase[]; lots?: number[]; playlistId?: string }
  | { action: 'new_round'; settings?: BingoSettings; phases?: Phase[]; lots?: number[] }
  | { action: 'settings'; settings: BingoSettings; phases?: Phase[]; lots?: number[] }
  | { action: 'next_phase' | 'advance' | 'jump_final'; expect?: number }
  | { action: 'formula'; phases: Phase[]; lots: number[]; expect?: number }
  | { action: 'start' | 'resume' | 'heartbeat' | 'exit' | 'paper_clear' | 'paper_list' | 'reveal' }
  | { action: 'draw'; expect: number }
  | { action: 'auto'; mode: 'manual' | 'auto' | 'paused'; ms?: number }
  | { action: 'decide'; claimId: number; accept: boolean }
  | { action: 'paper_win' | 'paper_check'; serial: number }
  | { action: 'paper_add'; count: number }

export interface AdminResult<T = unknown> {
  ok: boolean
  /** 0 = réseau coupé (rien n'est parti ou la réponse s'est perdue). */
  status: number
  error?: string
  code?: string
  data?: T
}

async function request<T>(url: string, init?: RequestInit): Promise<AdminResult<T>> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init })
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) return { ok: false, status: res.status, error: (json.error as string) ?? 'Action impossible', code: json.code as string | undefined }
    return { ok: true, status: res.status, data: json as T }
  } catch {
    return { ok: false, status: 0, error: 'Connexion perdue, réessayez.' }
  }
}

export function callAdmin<T = unknown>(sessionId: string, body: AdminBody): Promise<AdminResult<T>> {
  return request<T>('/api/bingo/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, ...body }),
  })
}

export function loadSnapshot(sessionId: string): Promise<AdminResult<RegieSnapshot>> {
  return request<RegieSnapshot>(`/api/bingo/admin?sessionId=${encodeURIComponent(sessionId)}`)
}
