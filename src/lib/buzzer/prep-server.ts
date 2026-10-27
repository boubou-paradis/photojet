// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — manches préparées, côté serveur uniquement (routes API et
// cron). Ne jamais importer ce fichier depuis un composant client.

import type { SupabaseClient } from '@supabase/supabase-js'
import { BUZZER_MEDIA_BUCKET, BUZZER_MEDIA_FOLDER, collectMediaPaths } from './prep'

/** Adresse publique d'un média (le bucket photos est public en lecture par lien). */
export function mediaPublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, '')}/storage/v1/object/public/${BUZZER_MEDIA_BUCKET}/${path}`
}

/** Premiers octets d'un média déjà envoyé (requête partielle : le fichier n'est pas téléchargé en entier). */
export async function readMediaHead(path: string, bytes = 32): Promise<Uint8Array | null> {
  const res = await fetch(mediaPublicUrl(path), { headers: { Range: `bytes=0-${bytes - 1}` }, cache: 'no-store' })
  if (!res.ok) return null
  const buf = new Uint8Array(await res.arrayBuffer())
  return buf.subarray(0, bytes)
}

/** Tous les médias encore cités : listes en préparation, bibliothèques, parties en cours. */
export async function loadReferencedMedia(admin: SupabaseClient): Promise<Set<string>> {
  const used = new Set<string>()
  const PAGE = 500
  const sources = [
    { table: 'buzzer_prep_sets', column: 'data', key: 'session_id' },
    { table: 'buzzer_prep_runtime', column: 'rounds', key: 'session_id' },
    { table: 'saved_buzzer_sets', column: 'rounds', key: 'id' },
  ] as const
  for (const { table, column, key } of sources) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin.from(table).select(column).order(key).range(from, from + PAGE - 1)
      if (error) throw new Error(`${table} : ${error.message}`)
      for (const row of data ?? []) for (const p of collectMediaPaths((row as Record<string, unknown>)[column])) used.add(p)
      if (!data || data.length < PAGE) break
    }
  }
  return used
}

export interface StoredMedia {
  path: string
  createdAt: number
}

async function listFolder(admin: SupabaseClient, prefix: string) {
  const out: { name: string; id: string | null; created_at: string | null }[] = []
  const PAGE = 1000
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from(BUZZER_MEDIA_BUCKET).list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`liste ${prefix} : ${error.message}`)
    out.push(...((data ?? []) as typeof out))
    if (!data || data.length < PAGE) return out
  }
}

/** Tous les fichiers de buzzer-media/<compte>/<session>/ (les dossiers ont un id null). */
export async function listStoredMedia(admin: SupabaseClient): Promise<StoredMedia[]> {
  const files: StoredMedia[] = []
  for (const user of await listFolder(admin, BUZZER_MEDIA_FOLDER)) {
    if (user.id !== null) continue
    for (const session of await listFolder(admin, `${BUZZER_MEDIA_FOLDER}/${user.name}`)) {
      if (session.id !== null) continue
      const prefix = `${BUZZER_MEDIA_FOLDER}/${user.name}/${session.name}`
      for (const file of await listFolder(admin, prefix)) {
        if (file.id === null) continue
        files.push({ path: `${prefix}/${file.name}`, createdAt: file.created_at ? Date.parse(file.created_at) : 0 })
      }
    }
  }
  return files
}

/**
 * Médias à effacer : ni cités nulle part, ni récents. Le délai protège un
 * envoi en cours (fichier déjà déposé, liste pas encore enregistrée).
 */
export function selectOrphanMedia(files: StoredMedia[], used: Set<string>, now: number, minAgeMs: number): string[] {
  return files.filter((f) => !used.has(f.path) && f.createdAt > 0 && now - f.createdAt >= minAgeMs).map((f) => f.path)
}
