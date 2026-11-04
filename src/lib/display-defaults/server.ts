// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Réglages d'affichage par défaut du compte — côté serveur (routes API et
// purge uniquement, ne jamais importer depuis un composant client).
//
// Règles :
//  • rien ne s'applique tout seul à une session existante : applyDisplayDefaults
//    n'est appelé que sur la session qui vient d'être créée, ou sur clic ;
//  • aucun fichier n'est partagé : enregistrer copie les fichiers de la session
//    vers des copies « defaults-<user> », appliquer recopie vers la session ;
//  • avant d'effacer un ancien fichier de session, on vérifie qu'aucune autre
//    session du compte ni les réglages par défaut ne l'utilisent.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  DISPLAY_DEFAULT_KEYS,
  defaultsCopyPath,
  filePathsOf,
  isOwnDefaultsPath,
  parsePromoPaths,
  pickDisplaySettings,
  remapPleinEcran,
  sessionCopyPath,
  type DisplaySettings,
  type FileKind,
} from './settings'

export const DEFAULTS_TABLE = 'account_display_defaults'
const BUCKET = 'photos'
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205'])

export function getDefaultsAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface StoredDefaults {
  settings: DisplaySettings
  updated_at: string
}

export class DisplayDefaultsError extends Error {
  constructor(public code: 'not_found' | 'copy_failed' | 'db', message: string) {
    super(message)
  }
}

// Copie un fichier du bucket. La copie est faite AU NOM de l'animateur
// (client avec ses cookies) pour qu'il en soit propriétaire et puisse la
// remplacer/effacer plus tard depuis Paramètres, comme ses autres fichiers.
// Si la copie directe est refusée (fichier ancien dont il n'est pas
// propriétaire, ex. compte recréé), on relit le fichier avec la clé serveur
// et on le renvoie à son nom.
async function copyFile(user: SupabaseClient, admin: SupabaseClient, from: string, to: string): Promise<boolean> {
  const direct = await user.storage.from(BUCKET).copy(from, to)
  if (!direct.error) return true
  const { data: blob, error: dlError } = await admin.storage.from(BUCKET).download(from)
  if (dlError || !blob) {
    console.error('[display-defaults] Copie impossible (lecture):', from, dlError?.message)
    return false
  }
  const { error: upError } = await user.storage.from(BUCKET).upload(to, blob, {
    contentType: blob.type || undefined,
    upsert: false,
  })
  if (upError) {
    console.error('[display-defaults] Copie impossible (envoi):', to, upError.message)
    return false
  }
  return true
}

async function removeFiles(admin: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return
  const { error } = await admin.storage.from(BUCKET).remove(paths)
  if (error) console.error('[display-defaults] Suppression Storage:', error.message)
}

// Garde uniquement les cadres qui existent encore dans la bibliothèque du compte.
async function keepOwnTemplates(admin: SupabaseClient, userId: string, settings: DisplaySettings) {
  const ids = [settings.borne_template_portrait_id, settings.borne_template_landscape_id]
    .filter((v): v is string => typeof v === 'string')
  if (ids.length === 0) return
  const { data } = await admin.from('borne_templates').select('id').eq('user_id', userId).in('id', ids)
  const existing = new Set((data ?? []).map((t: { id: string }) => t.id))
  for (const key of ['borne_template_portrait_id', 'borne_template_landscape_id'] as const) {
    const v = settings[key]
    if (typeof v === 'string' && !existing.has(v)) settings[key] = null
  }
}

export async function readDisplayDefaults(admin: SupabaseClient, userId: string): Promise<StoredDefaults | null> {
  const { data, error } = await admin
    .from(DEFAULTS_TABLE)
    .select('settings, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  // Table pas encore créée (migration non appliquée) : comme « aucun réglage »,
  // pour que la création de session, la purge et les cadres marchent comme avant.
  if (error && MISSING_TABLE_CODES.has(error.code)) return null
  if (error) throw new DisplayDefaultsError('db', error.message)
  if (!data) return null
  return { settings: pickDisplaySettings(data.settings as Record<string, unknown>), updated_at: data.updated_at as string }
}

async function readOwnSession(admin: SupabaseClient, userId: string, sessionId: string) {
  const { data, error } = await admin
    .from('sessions')
    .select(['id', ...DISPLAY_DEFAULT_KEYS].join(', '))
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new DisplayDefaultsError('db', error.message)
  if (!data) throw new DisplayDefaultsError('not_found', 'Session introuvable')
  return data as unknown as Record<string, unknown>
}

/**
 * Enregistre les réglages visuels de la session (relus en base) comme
 * réglages par défaut du compte. Les fichiers sont copiés. En cas d'échec
 * d'une copie, rien n'est enregistré (les anciens réglages restent intacts).
 */
export async function saveDisplayDefaults(
  user: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<StoredDefaults> {
  const session = await readOwnSession(admin, userId, sessionId)
  const settings = pickDisplaySettings(session)
  const created: string[] = []

  const copyOrFail = async (kind: FileKind, source: string) => {
    const target = defaultsCopyPath(kind, userId, source)
    if (!(await copyFile(user, admin, source, target))) {
      await removeFiles(admin, created)
      const label = kind === 'background' ? 'le fond' : kind === 'logo' ? 'le logo' : 'une affiche'
      throw new DisplayDefaultsError('copy_failed', `Impossible de copier ${label}. Réessayez.`)
    }
    created.push(target)
    return target
  }

  if (typeof settings.background_image === 'string' && settings.background_image) {
    settings.background_image = await copyOrFail('background', settings.background_image)
  }
  if (typeof settings.custom_logo === 'string' && settings.custom_logo) {
    settings.custom_logo = await copyOrFail('logo', settings.custom_logo)
  }
  const promos = parsePromoPaths(settings.promo_affiches)
  const promoCopies: string[] = []
  const promoMap = new Map<string, string>()
  for (const p of promos) {
    const target = await copyOrFail('promo', p)
    promoCopies.push(target)
    promoMap.set(p, target)
  }
  settings.promo_affiches = JSON.stringify(promoCopies)
  // Le choix « plein écran » suit chaque affiche vers sa copie.
  settings.promo_affiches_plein_ecran = remapPleinEcran(settings.promo_affiches_plein_ecran, promoMap)

  await keepOwnTemplates(admin, userId, settings)

  const previous = await readDisplayDefaults(admin, userId).catch(() => null)
  const updatedAt = new Date().toISOString()
  const { error } = await admin
    .from(DEFAULTS_TABLE)
    .upsert({ user_id: userId, settings, updated_at: updatedAt }, { onConflict: 'user_id' })
  if (error) {
    await removeFiles(admin, created)
    throw new DisplayDefaultsError('db', error.message)
  }

  // Anciennes copies : elles n'appartiennent qu'aux réglages par défaut.
  if (previous) {
    const keep = new Set(created)
    await removeFiles(admin, ownDefaultsFiles(userId, previous.settings).filter((p) => !keep.has(p)))
  }

  return { settings, updated_at: updatedAt }
}

// Fichiers des réglages par défaut, limités aux copies de CE compte (on
// n'efface jamais un chemin qui ne suit pas le format des copies).
function ownDefaultsFiles(userId: string, settings: DisplaySettings): string[] {
  const out: string[] = []
  if (isOwnDefaultsPath('background', userId, settings.background_image)) out.push(settings.background_image)
  if (isOwnDefaultsPath('logo', userId, settings.custom_logo)) out.push(settings.custom_logo)
  for (const p of parsePromoPaths(settings.promo_affiches)) if (isOwnDefaultsPath('promo', userId, p)) out.push(p)
  return out
}

export type ApplyResult =
  | { status: 'none' }
  | { status: 'applied'; session: Record<string, unknown>; warnings: string[] }

/**
 * Applique les réglages par défaut à UNE session du compte (création ou clic
 * de l'animateur). Une copie de fichier ratée n'empêche pas le reste : le
 * réglage concerné garde sa valeur actuelle et un avertissement est renvoyé.
 */
export async function applyDisplayDefaults(
  user: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<ApplyResult> {
  const defaults = await readDisplayDefaults(admin, userId)
  if (!defaults) return { status: 'none' }
  const current = await readOwnSession(admin, userId, sessionId)

  const s = { ...defaults.settings }
  const patch: Record<string, unknown> = {}
  const warnings: string[] = []
  const created: string[] = []

  for (const key of DISPLAY_DEFAULT_KEYS) {
    if (key === 'background_image' || key === 'custom_logo' || key === 'promo_affiches' || key === 'promo_affiches_plein_ecran') continue
    if (key in s) patch[key] = s[key]
  }

  // Fond
  if ('background_image' in s) {
    if (!s.background_image) {
      patch.background_image = null
    } else if (isOwnDefaultsPath('background', userId, s.background_image)) {
      const target = sessionCopyPath('background', sessionId, s.background_image)
      if (await copyFile(user, admin, s.background_image, target)) {
        patch.background_image = target
        created.push(target)
      } else {
        delete patch.background_type
        warnings.push('Fond non copié, à remettre à la main.')
      }
    } else {
      delete patch.background_type
    }
  }

  // Logo
  if ('custom_logo' in s) {
    if (!s.custom_logo) {
      patch.custom_logo = null
    } else if (isOwnDefaultsPath('logo', userId, s.custom_logo)) {
      const target = sessionCopyPath('logo', sessionId, s.custom_logo)
      if (await copyFile(user, admin, s.custom_logo, target)) {
        patch.custom_logo = target
        created.push(target)
      } else {
        warnings.push('Logo non copié, à remettre à la main.')
      }
    }
  }

  // Affiches
  if ('promo_affiches' in s) {
    const copies: string[] = []
    const promoMap = new Map<string, string>()
    let failed = 0
    for (const p of parsePromoPaths(s.promo_affiches)) {
      if (!isOwnDefaultsPath('promo', userId, p)) { failed++; continue }
      const target = sessionCopyPath('promo', sessionId, p)
      if (await copyFile(user, admin, p, target)) {
        copies.push(target)
        promoMap.set(p, target)
        created.push(target)
      } else {
        failed++
      }
    }
    patch.promo_affiches = JSON.stringify(copies)
    // Réglages enregistrés avant l'option : aucune clé, donc toutes en Ajuster.
    patch.promo_affiches_plein_ecran = remapPleinEcran(s.promo_affiches_plein_ecran, promoMap)
    if (failed > 0) warnings.push(`${failed} affiche${failed > 1 ? 's' : ''} non copiée${failed > 1 ? 's' : ''}, à remettre à la main.`)
  }

  await keepOwnTemplates(admin, userId, patch as DisplaySettings)

  const { data: updated, error } = await admin
    .from('sessions')
    .update(patch)
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error || !updated) {
    await removeFiles(admin, created)
    throw new DisplayDefaultsError('db', error?.message ?? 'Mise à jour impossible')
  }

  // Anciens fichiers de la session remplacés : effacés seulement si plus
  // rien ne les utilise (autre session du compte, réglages par défaut).
  const replaced: string[] = []
  if ('background_image' in patch && current.background_image && current.background_image !== patch.background_image) {
    replaced.push(current.background_image as string)
  }
  if ('custom_logo' in patch && current.custom_logo && current.custom_logo !== patch.custom_logo) {
    replaced.push(current.custom_logo as string)
  }
  if ('promo_affiches' in patch) replaced.push(...parsePromoPaths(current.promo_affiches))
  await removeUnreferenced(admin, userId, replaced)

  return { status: 'applied', session: updated as Record<string, unknown>, warnings }
}

async function removeUnreferenced(admin: SupabaseClient, userId: string, candidates: string[]) {
  const unique = Array.from(new Set(candidates.filter(Boolean)))
  if (unique.length === 0) return
  const { data: sessions, error } = await admin
    .from('sessions')
    .select('background_image, custom_logo, promo_affiches')
    .eq('user_id', userId)
  if (error) {
    console.error('[display-defaults] Vérification des fichiers impossible, rien effacé:', error.message)
    return
  }
  const used = new Set<string>()
  for (const row of (sessions ?? []) as Record<string, unknown>[]) for (const p of filePathsOf(row)) used.add(p)
  const defaults = await readDisplayDefaults(admin, userId).catch(() => undefined)
  if (defaults === undefined) return // prudence : en cas de doute, ne rien effacer
  for (const p of filePathsOf(defaults?.settings)) used.add(p)
  await removeFiles(admin, unique.filter((p) => !used.has(p)))
}

/** Supprime les réglages par défaut du compte et leurs copies de fichiers. */
export async function deleteDisplayDefaults(admin: SupabaseClient, userId: string): Promise<number> {
  const previous = await readDisplayDefaults(admin, userId)
  if (!previous) return 0
  const { error } = await admin.from(DEFAULTS_TABLE).delete().eq('user_id', userId)
  if (error) throw new DisplayDefaultsError('db', error.message)
  const files = ownDefaultsFiles(userId, previous.settings)
  await removeFiles(admin, files)
  return files.length
}

/** Retire un cadre supprimé de la bibliothèque des réglages par défaut. */
export async function unlinkTemplateFromDefaults(admin: SupabaseClient, userId: string, templateId: string) {
  const defaults = await readDisplayDefaults(admin, userId)
  if (!defaults) return
  const settings = { ...defaults.settings }
  let changed = false
  for (const key of ['borne_template_portrait_id', 'borne_template_landscape_id'] as const) {
    if (settings[key] === templateId) { settings[key] = null; changed = true }
  }
  if (!changed) return
  const { error } = await admin.from(DEFAULTS_TABLE).update({ settings }).eq('user_id', userId)
  if (error) throw new DisplayDefaultsError('db', error.message)
}
