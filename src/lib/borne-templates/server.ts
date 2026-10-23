// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Accès serveur des templates AnimaBooth (routes API uniquement).
// Ne jamais importer ce fichier depuis un composant client.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { TEMPLATES_PREFIX } from './constants'

export const PHOTOS_BUCKET = 'photos'

export function getTemplatesAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Utilisateur connecté (cookies vérifiés par Supabase), sinon null. */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/**
 * Tous les fichiers du dossier templates d'un utilisateur, y compris ceux
 * envoyés sans jamais avoir été enregistrés (import abandonné).
 */
export async function listUserTemplateFiles(admin: SupabaseClient, userId: string): Promise<string[]> {
  const folder = `${TEMPLATES_PREFIX}/${userId}`
  const paths: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(PHOTOS_BUCKET).list(folder, { limit: 1000, offset })
    if (error) throw new Error(error.message)
    paths.push(...(data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`))
    if (!data || data.length < 1000) return paths
  }
}
