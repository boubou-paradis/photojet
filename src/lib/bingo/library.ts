// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo, loto musical : bibliothèque de playlists du compte, côté
// serveur uniquement (routes API). Ne jamais importer depuis un composant client.
//
// - Les playlists vivent dans saved_bingo_playlists (RLS propriétaire) ; les
//   routes écrivent quand même avec le filtre user_id explicite.
// - Les morceaux sont dans photos/bingo-music/<compte>/… : un fichier n'est
//   effacé que s'il n'est plus cité NI par une playlist du compte NI par une
//   partie en cours (bingo_music), pour ne jamais couper une soirée.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { MUSIC_BUCKET, MUSIC_FOLDER, parsePlaylist, playlistProblem, type MusicTrack } from './music'

/** 50 playlists au plus par compte. */
export const MAX_PLAYLISTS = 50

export interface PlaylistRow {
  id: string
  name: string
  tracks: (MusicTrack & { url: string })[]
  updatedAt: string
  /** null = jouable ; sinon la raison (moins de 30 titres, doublon…). */
  problem: string | null
}

/** Compte connecté (cookies vérifiés par Supabase), ou null. */
export async function currentUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export const musicUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, '')}/storage/v1/object/public/${MUSIC_BUCKET}/${path}`

const toRow = (r: { id: string; name: string; tracks: unknown; updated_at: string }): PlaylistRow => {
  const tracks = (Array.isArray(r.tracks) ? r.tracks : []) as MusicTrack[]
  return { id: r.id, name: r.name, tracks: tracks.map((t) => ({ ...t, url: musicUrl(t.path) })), updatedAt: r.updated_at, problem: playlistProblem(tracks) }
}

export async function listPlaylists(admin: SupabaseClient, userId: string): Promise<PlaylistRow[]> {
  const { data, error } = await admin.from('saved_bingo_playlists').select('id, name, tracks, updated_at').eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toRow)
}

/** Chemins encore cités : playlists du compte + parties en cours de ses sessions. */
async function referencedPaths(admin: SupabaseClient, userId: string): Promise<Set<string>> {
  const used = new Set<string>()
  const { data: lists, error } = await admin.from('saved_bingo_playlists').select('tracks').eq('user_id', userId)
  if (error) throw new Error(error.message)
  for (const l of lists ?? []) for (const t of (l.tracks as MusicTrack[]) ?? []) used.add(t.path)
  const { data: sessions, error: e2 } = await admin.from('sessions').select('id').eq('user_id', userId)
  if (e2) throw new Error(e2.message)
  const ids = (sessions ?? []).map((s) => s.id as string)
  for (let i = 0; i < ids.length; i += 200) {
    const { data: games, error: e3 } = await admin.from('bingo_music').select('tracks').in('session_id', ids.slice(i, i + 200))
    if (e3) throw new Error(e3.message)
    for (const g of games ?? []) for (const t of (g.tracks as MusicTrack[]) ?? []) used.add(t.path)
  }
  return used
}

/** Efface les fichiers donnés qui ne sont plus cités nulle part (jamais ceux d'un autre compte). */
export async function removeUnused(admin: SupabaseClient, userId: string, candidates: Iterable<string>): Promise<number> {
  const mine = [...new Set(candidates)].filter((p) => p.startsWith(`${MUSIC_FOLDER}/${userId}/`))
  if (mine.length === 0) return 0
  const used = await referencedPaths(admin, userId)
  const gone = mine.filter((p) => !used.has(p))
  if (gone.length === 0) return 0
  const { error } = await admin.storage.from(MUSIC_BUCKET).remove(gone)
  if (error) console.error('[AnimaBingo] effacement de morceaux :', error.message)
  return error ? 0 : gone.length
}

export type SaveResult = { ok: true; playlist: PlaylistRow } | { ok: false; error: string; status: number }

/** Crée (id absent) ou remplace une playlist du compte. */
export async function savePlaylist(admin: SupabaseClient, userId: string, body: { id?: unknown; name?: unknown; tracks?: unknown }): Promise<SaveResult> {
  const parsed = parsePlaylist(body, userId)
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 }
  const { name, tracks } = parsed.value
  const now = new Date().toISOString()
  if (typeof body.id === 'string') {
    const { data: old, error } = await admin.from('saved_bingo_playlists').select('tracks').eq('id', body.id).eq('user_id', userId).maybeSingle()
    if (error) throw new Error(error.message)
    if (!old) return { ok: false, error: 'Playlist introuvable.', status: 404 }
    const { data, error: e2 } = await admin.from('saved_bingo_playlists').update({ name, tracks, updated_at: now })
      .eq('id', body.id).eq('user_id', userId).select('id, name, tracks, updated_at').single()
    if (e2) throw new Error(e2.message)
    const kept = new Set(tracks.map((t) => t.path))
    await removeUnused(admin, userId, ((old.tracks as MusicTrack[]) ?? []).map((t) => t.path).filter((p) => !kept.has(p)))
    return { ok: true, playlist: toRow(data) }
  }
  const { count, error: ce } = await admin.from('saved_bingo_playlists').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if (ce) throw new Error(ce.message)
  if ((count ?? 0) >= MAX_PLAYLISTS) return { ok: false, error: `${MAX_PLAYLISTS} playlists au maximum.`, status: 409 }
  const { data, error } = await admin.from('saved_bingo_playlists').insert({ user_id: userId, name, tracks }).select('id, name, tracks, updated_at').single()
  if (error) throw new Error(error.message)
  return { ok: true, playlist: toRow(data) }
}

export async function deletePlaylist(admin: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const { data, error } = await admin.from('saved_bingo_playlists').delete().eq('id', id).eq('user_id', userId).select('tracks')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return false
  await removeUnused(admin, userId, data.flatMap((r) => ((r.tracks as MusicTrack[]) ?? []).map((t) => t.path)))
  return true
}

/**
 * Cron : morceaux envoyés mais jamais enregistrés (onglet fermé avant
 * d'enregistrer la playlist). Effacés seulement après `minAgeMs` et s'ils ne
 * sont cités par AUCUNE playlist ni AUCUNE partie en cours.
 */
export async function purgeOrphanMusic(admin: SupabaseClient, minAgeMs: number, now = Date.now()): Promise<number> {
  const used = new Set<string>()
  for (const table of ['saved_bingo_playlists', 'bingo_music']) {
    for (let from = 0; ; from += 500) {
      const { data, error } = await admin.from(table).select('tracks').range(from, from + 499)
      if (error) throw new Error(error.message)
      for (const r of data ?? []) for (const t of (r.tracks as MusicTrack[]) ?? []) used.add(t.path)
      if (!data || data.length < 500) break
    }
  }
  const storage = admin.storage.from(MUSIC_BUCKET)
  const orphans: string[] = []
  const { data: owners, error } = await storage.list(MUSIC_FOLDER, { limit: 1000 })
  if (error) throw new Error(error.message)
  for (const o of owners ?? []) {
    if (o.id !== null) continue
    for (let offset = 0; ; offset += 1000) {
      const { data: files, error: e2 } = await storage.list(`${MUSIC_FOLDER}/${o.name}`, { limit: 1000, offset })
      if (e2) throw new Error(e2.message)
      for (const f of files ?? []) {
        const path = `${MUSIC_FOLDER}/${o.name}/${f.name}`
        const at = Date.parse(f.created_at ?? '')
        if (f.id !== null && !used.has(path) && Number.isFinite(at) && now - at > minAgeMs) orphans.push(path)
      }
      if (!files || files.length < 1000) break
    }
  }
  for (let i = 0; i < orphans.length; i += 100) {
    const { error: e3 } = await storage.remove(orphans.slice(i, i + 100))
    if (e3) throw new Error(e3.message)
  }
  return orphans.length
}
