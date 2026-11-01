// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BORNE_ONLINE_MINUTES,
  GAME_ACTIVITY_COLUMNS,
  RECENT_PHOTO_HOURS,
  hasOpenGame,
  isExemptUser,
  type ActivationResult,
  type ActiveSessionInfo,
} from './activation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>

/** Le compte exempté est lu côté serveur uniquement. */
export function isSessionRuleExempt(userId: string): boolean {
  return isExemptUser(userId, process.env.SESSION_RULE_EXEMPT_USER_IDS)
}

async function forceActivate(admin: AdminClient, sessionId: string, userId: string): Promise<void> {
  const { error } = await admin
    .from('sessions')
    .update({ is_active: true })
    .eq('id', sessionId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

// Nom et activité des sessions en conflit. Si l'activité ne peut pas être lue,
// on affiche l'avertissement renforcé : il ne bloque rien, il prévient seulement.
async function describeSessions(admin: AdminClient, ids: string[]): Promise<ActiveSessionInfo[]> {
  const { data, error } = await admin
    .from('sessions')
    .select(`id, name, ${GAME_ACTIVITY_COLUMNS.join(', ')}`)
    .in('id', ids)
  if (error || !data) {
    console.error('[Sessions] Lecture des sessions actives impossible:', error?.message)
    return ids.map((id) => ({ id, name: 'Événement', busy: true }))
  }

  const rows = data as unknown as Array<Record<string, unknown> & { id: string; name: string }>
  const photoSince = new Date(Date.now() - RECENT_PHOTO_HOURS * 3600_000).toISOString()
  const borneSince = new Date(Date.now() - BORNE_ONLINE_MINUTES * 60_000).toISOString()

  return Promise.all(rows.map(async (row) => {
    if (hasOpenGame(row)) return { id: row.id, name: row.name, busy: true }
    try {
      const [photos, bornes] = await Promise.all([
        admin.from('photos').select('id').eq('session_id', row.id).gte('uploaded_at', photoSince).limit(1),
        admin.from('borne_connections').select('id').eq('session_id', row.id).eq('is_online', true).gte('last_seen', borneSince).limit(1),
      ])
      if (photos.error || bornes.error) throw new Error(photos.error?.message ?? bornes.error?.message)
      return { id: row.id, name: row.name, busy: (photos.data?.length ?? 0) + (bornes.data?.length ?? 0) > 0 }
    } catch (err) {
      console.error('[Sessions] Lecture de l\'activité impossible:', err)
      return { id: row.id, name: row.name, busy: true }
    }
  }))
}

/**
 * Active une session. Une erreur technique ne bloque jamais l'abonné : la session
 * est activée sans contrôle et l'erreur est journalisée.
 */
export async function activateUserSession(
  admin: AdminClient,
  userId: string,
  sessionId: string,
  confirmedIds: string[] | null
): Promise<ActivationResult | { status: 'not_found' }> {
  if (isSessionRuleExempt(userId)) {
    await forceActivate(admin, sessionId, userId)
    return { status: 'activated', deactivated: [] }
  }

  const { data, error } = await admin.rpc('activate_session', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_confirmed_ids: confirmedIds,
  })

  if (error || !data) {
    console.error('[Sessions] activate_session en échec, activation sans contrôle:', error?.message)
    await forceActivate(admin, sessionId, userId)
    return { status: 'activated', deactivated: [], degraded: true }
  }

  const result = data as { status: string; others?: string[]; deactivated?: string[] }
  if (result.status === 'conflict') {
    return { status: 'conflict', others: await describeSessions(admin, result.others ?? []) }
  }
  if (result.status === 'activated') return { status: 'activated', deactivated: result.deactivated ?? [] }
  if (result.status === 'already_active') return { status: 'already_active' }
  return { status: 'not_found' }
}

// Ancien comportement, conservé comme secours : toutes les sessions du compte.
async function reactivateAllSessions(admin: AdminClient, userId: string): Promise<void> {
  try {
    const { error } = await admin.from('sessions').update({ is_active: true }).eq('user_id', userId)
    if (error) throw new Error(error.message)
  } catch (err) {
    console.error(`[Sessions] Secours en échec, sessions non réactivées pour ${userId}:`, err)
  }
}

/**
 * Remplace les réactivations de masse (Stripe, sync-subscription, grant-lifetime) :
 * ne fait rien si une session est déjà active, sinon réactive la plus récente.
 * En cas d'erreur, revient à l'ancien comportement : un abonné qui paie ne doit
 * jamais rester sans session active. Ne lève jamais d'erreur : l'appelant répond
 * comme avant.
 */
export async function reactivateLatestSessionIfNone(admin: AdminClient, userId: string): Promise<void> {
  try {
    const { data: active, error: activeError } = await admin
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
    if (activeError) throw new Error(activeError.message)
    if (active && active.length > 0) return

    const { data: latest, error: latestError } = await admin
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (latestError) throw new Error(latestError.message)
    if (!latest || latest.length === 0) return

    const { error } = await admin.from('sessions').update({ is_active: true }).eq('id', latest[0].id)
    if (error) throw new Error(error.message)
  } catch (err) {
    console.error(`[Sessions] Réactivation ciblée en échec pour ${userId}, retour à l'ancien comportement:`, err)
    await reactivateAllSessions(admin, userId)
  }
}
