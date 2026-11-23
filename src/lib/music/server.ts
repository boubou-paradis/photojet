// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Demandes de musique : accès aux tables fermées (clé de service, serveur seul).
// Tables absentes (migration non appliquée) = fonction invisible, rien ne casse.

import type { SupabaseClient } from '@supabase/supabase-js'
import { groupMusicRequests, type MusicAliasRow, type MusicDecisionRow, type MusicGroup, type MusicRequestRow } from './group'

export const MUSIC_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class MusicUnavailable extends Error {}

/** Erreur « table inconnue » (Postgres 42P01 ou cache de schéma PostgREST). */
export function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || /could not find the table|does not exist/i.test(error.message ?? '')
}

/** true / false, ou null si la table n'existe pas. Lève en cas de panne. */
export async function readMusicEnabled(admin: SupabaseClient, sessionId: string): Promise<boolean | null> {
  const { data, error } = await admin
    .from('music_request_settings')
    .select('enabled')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (isMissingTable(error)) return null
  if (error) throw new Error(error.message)
  return data?.enabled === true
}

const PAGE = 1000

async function readAll<T>(admin: SupabaseClient, table: string, columns: string, orderBy: string, sessionId: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .eq('session_id', sessionId)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1)
    if (isMissingTable(error)) throw new MusicUnavailable(table)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return out
  }
}

export interface MusicSnapshot {
  groups: MusicGroup[]
  aliases: MusicAliasRow[]
}

export async function loadMusicGroups(admin: SupabaseClient, sessionId: string): Promise<MusicSnapshot> {
  const [rows, aliases, decisions] = await Promise.all([
    readAll<MusicRequestRow>(admin, 'music_requests', 'title, artist, norm_key, created_at', 'id', sessionId),
    readAll<MusicAliasRow>(admin, 'music_request_aliases', 'from_key, to_key', 'from_key', sessionId),
    readAll<MusicDecisionRow>(admin, 'music_request_decisions', 'group_key, status', 'group_key', sessionId),
  ])
  return { groups: groupMusicRequests(rows, aliases, decisions), aliases }
}
