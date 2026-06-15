// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Cron job for data deletion after subscription expiration.
// - Sends warning emails at 23 days and 29 days after expiration
// - Deletes all user data 30 days after expiration
// Configure in vercel.json: { "path": "/api/cron/cleanup-expired", "schedule": "0 3 * * *" }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendDataDeletionWarningEmail } from '@/lib/resend'
import { stripe } from '@/lib/stripe'

const GRACE_PERIOD_DAYS = 30
const TRIAL_GRACE_DAYS = 7 // Essais gratuits non convertis : purge 7 jours après expiration
const WARNING_DAYS = [7, 1] // Send warnings at 7 days and 1 day before deletion
const PHOTOS_BUCKET = 'photos'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Normalise une valeur stockée (URL publique Supabase OU chemin relatif) vers un
// chemin interne au bucket `photos`. Renvoie null si la valeur ne concerne pas ce bucket.
function toPhotosPath(value: string | null | undefined): string | null {
  if (!value) return null
  const v = String(value).trim()
  if (!v) return null
  // URL publique → on extrait ce qui suit ".../photos/"
  const m = v.match(/\/photos\/(.+)$/)
  if (m?.[1]) return decodeURIComponent(m[1].split('?')[0])
  // URL d'un autre bucket / domaine externe → on ignore
  if (/^https?:\/\//i.test(v)) return null
  // Sinon : chemin déjà relatif au bucket photos (ex: backgrounds/x, mystery-photos/x)
  return v
}

// Extrait tous les chemins Storage (bucket photos) référencés dans les colonnes
// JSON d'une session : jeux (quiz/mystery/lineup/wheel) + réglages (fonds/logos/promos).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectSessionStoragePaths(session: any): string[] {
  const out: (string | null)[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromJsonArray = (raw: string | null, pick: (item: any) => (string | null | undefined)[]) => {
    if (!raw) return
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) for (const it of arr) for (const u of pick(it)) out.push(toPhotosPath(u))
    } catch { /* JSON invalide, ignoré */ }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromJsonObj = (raw: string | null, pick: (o: any) => (string | null | undefined)[]) => {
    if (!raw) return
    try { const o = JSON.parse(raw); if (o) for (const u of pick(o)) out.push(toPhotosPath(u)) } catch { /* ignoré */ }
  }

  // Réglages
  out.push(toPhotosPath(session.background_image))
  out.push(toPhotosPath(session.custom_logo))
  fromJsonArray(session.promo_affiches, (p) => [typeof p === 'string' ? p : p?.url ?? p?.path])
  // Mystery
  out.push(toPhotosPath(session.mystery_photo_url))
  out.push(toPhotosPath(session.mystery_reveal_audio))
  fromJsonArray(session.mystery_photos, (p) => typeof p === 'string' ? [p] : [p?.url, p?.audioUrl])
  // Lineup & Wheel (WheelAudioSettings { url })
  fromJsonObj(session.lineup_audio, (o) => [o?.url])
  fromJsonObj(session.wheel_audio, (o) => [o?.url])
  // Quiz (QuizQuestion[]) : audio réponse + photo + audio question
  fromJsonArray(session.quiz_questions, (q) => [q?.audioUrl, q?.photoUrl, q?.questionAudioUrl])

  return Array.from(new Set(out.filter((p): p is string => !!p)))
}

// Supprime une liste de chemins du bucket photos (par lots de 100). Renvoie le nb tenté.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function removeFromPhotos(supabase: any, paths: string[]): Promise<number> {
  if (paths.length === 0) return 0
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    const { error } = await supabase.storage.from(PHOTOS_BUCKET).remove(batch)
    if (error) console.error('[Cron cleanup] Storage remove error:', error.message)
  }
  return paths.length
}

// GARDE-FOU : un user ne doit JAMAIS être supprimé s'il a encore un accès valide.
// Protège les owners (lifetime) et tout abonnement actif/essai/pass en cours, même
// si UNE autre de ses lignes d'abonnement est expirée depuis longtemps.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function userHasActiveAccess(supabase: any, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()
  if (profile?.role === 'owner') return true

  // Protection catégorique : la PRÉSENCE de toute ligne au statut donnant accès
  // (active / trialing / weekend_pass) protège le compte, quelle que soit la date de
  // période. On ne supprime JAMAIS un user au statut actif — c'est à check-expiring de
  // basculer ces statuts en 'expired' AVANT que la purge ne puisse les considérer.
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'weekend_pass'])
    .limit(1)

  return !!(subs && subs.length > 0)
}

// Écrit une ligne d'audit dans purge_log (best-effort : ne bloque jamais la purge).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logPurge(supabase: any, entry: {
  kind: string
  user_id?: string | null
  email?: string | null
  files_deleted?: number
  reason?: string | null
  error?: string | null
}) {
  try {
    await supabase.from('purge_log').insert({
      kind: entry.kind,
      user_id: entry.user_id ?? null,
      email: entry.email ?? null,
      files_deleted: entry.files_deleted ?? 0,
      reason: entry.reason ?? null,
      error: entry.error ?? null,
    })
  } catch (e) {
    console.error('[Cron cleanup] purge_log insert failed:', e instanceof Error ? e.message : e)
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const now = new Date()
  const results: {
    warningsSent: string[]
    usersDeleted: string[]
    skippedStillActive?: string[]
    errors: string[]
  } = {
    warningsSent: [],
    usersDeleted: [],
    errors: [],
  }

  // ============================================================
  // 1. Send warning emails for users approaching data deletion
  // ============================================================
  for (const warningDaysBefore of WARNING_DAYS) {
    // Calculate the expiration date that corresponds to X days before deletion
    // If grace period is 30 days and warning is 7 days before deletion,
    // we look for subscriptions expired 23 days ago (30 - 7 = 23)
    const daysAfterExpiration = GRACE_PERIOD_DAYS - warningDaysBefore
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() - daysAfterExpiration)
    const targetStart = new Date(targetDate)
    targetStart.setHours(0, 0, 0, 0)
    const targetEnd = new Date(targetDate)
    targetEnd.setHours(23, 59, 59, 999)

    const { data: expiringUsers } = await supabase
      .from('subscriptions')
      .select('id, user_id, current_period_end, stripe_customer_id, stripe_subscription_id')
      .in('status', ['expired', 'canceled', 'past_due'])
      .gte('current_period_end', targetStart.toISOString())
      .lte('current_period_end', targetEnd.toISOString())

    if (expiringUsers) {
      for (const sub of expiringUsers) {
        // SAFETY CHECK: Don't warn users who have renewed in Stripe
        const isStillActive = await checkStripeSubscriptionActive(sub.stripe_customer_id, sub.stripe_subscription_id)
        if (isStillActive.active) {
          // Only reset to active if Stripe confirms a FUTURE period end
          // (avoids resetting on API errors or missing periodEnd which causes daily email loops)
          if (isStillActive.periodEnd && new Date(isStillActive.periodEnd) > now) {
            await supabase
              .from('subscriptions')
              .update({
                status: 'active',
                current_period_end: isStillActive.periodEnd,
                ...(isStillActive.periodStart ? { current_period_start: isStillActive.periodStart } : {}),
              })
              .eq('id', sub.id)
            results.skippedStillActive = results.skippedStillActive || []
            results.skippedStillActive.push(sub.user_id)
          }
          continue
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', sub.user_id)
          .single()

        if (profile?.email) {
          await sendDataDeletionWarningEmail({
            to: profile.email,
            daysLeft: warningDaysBefore,
          })
          results.warningsSent.push(`${warningDaysBefore}d: ${profile.email}`)
        }
      }
    }
  }

  // ============================================================
  // 2. Delete data for users whose grace period has expired
  //    - Essais non convertis (jamais passés par Stripe) : 7 jours après trial_end
  //    - Abonnés / pass expirés : 30 jours après current_period_end
  // ============================================================
  const graceThreshold = new Date(now)
  graceThreshold.setDate(graceThreshold.getDate() - GRACE_PERIOD_DAYS)
  const trialThreshold = new Date(now)
  trialThreshold.setDate(trialThreshold.getDate() - TRIAL_GRACE_DAYS)

  // 2a. Essais gratuits expirés non convertis (pas de stripe_subscription_id, trial_end défini)
  const { data: expiredTrials } = await supabase
    .from('subscriptions')
    .select('id, user_id, stripe_customer_id, stripe_subscription_id')
    .eq('status', 'expired')
    .is('stripe_subscription_id', null)
    .not('trial_end', 'is', null)
    .lt('trial_end', trialThreshold.toISOString())

  // 2b. Abonnés / pass week-end expirés (délai de grâce 30 jours)
  const { data: expiredPaid } = await supabase
    .from('subscriptions')
    .select('id, user_id, stripe_customer_id, stripe_subscription_id')
    .in('status', ['expired', 'canceled', 'past_due'])
    .lt('current_period_end', graceThreshold.toISOString())

  type SubRow = { id: string; user_id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null }
  type Candidate = SubRow & { kind: 'trial' | 'subscription' }
  const candidates: Candidate[] = [
    ...((expiredTrials || []) as SubRow[]).map((s) => ({ ...s, kind: 'trial' as const })),
    ...((expiredPaid || []) as SubRow[]).map((s) => ({ ...s, kind: 'subscription' as const })),
  ]

  const processedUsers = new Set<string>()

  for (const sub of candidates) {
    if (processedUsers.has(sub.user_id)) continue
    try {
      // GARDE-FOU 1 (DB) : ne jamais supprimer un user avec un accès encore valide (owner, sub active/essai/pass)
      if (await userHasActiveAccess(supabase, sub.user_id)) {
        console.log(`[Cron cleanup] SKIPPING user ${sub.user_id}: accès encore valide (owner ou sub active/essai/pass).`)
        processedUsers.add(sub.user_id)
        continue
      }

      // GARDE-FOU 2 (Stripe) : re-vérifier auprès de Stripe avant suppression (DB peut être désync)
      const isStillActive = await checkStripeSubscriptionActive(sub.stripe_customer_id, sub.stripe_subscription_id)
      if (isStillActive.active) {
        const hasFuturePeriodEnd = isStillActive.periodEnd && new Date(isStillActive.periodEnd) > now
        if (hasFuturePeriodEnd) {
          console.log(`[Cron cleanup] SKIPPING user ${sub.user_id}: Stripe subscription is still active (${isStillActive.status}, ends ${isStillActive.periodEnd}). Syncing DB instead.`)
          await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              current_period_end: isStillActive.periodEnd,
              ...(isStillActive.periodStart ? { current_period_start: isStillActive.periodStart } : {}),
            })
            .eq('id', sub.id)
          results.skippedStillActive = results.skippedStillActive || []
          results.skippedStillActive.push(sub.user_id)
        } else {
          console.log(`[Cron cleanup] SKIPPING deletion for user ${sub.user_id}: Stripe says active but no confirmed future period end (periodEnd=${isStillActive.periodEnd}). Keeping as expired.`)
        }
        processedUsers.add(sub.user_id)
        continue
      }

      const { filesDeleted, email } = await deleteUserData(supabase, sub.user_id)
      processedUsers.add(sub.user_id)
      results.usersDeleted.push(sub.user_id)
      await logPurge(supabase, {
        kind: sub.kind,
        user_id: sub.user_id,
        email,
        files_deleted: filesDeleted,
        reason: sub.kind === 'trial' ? `essai non converti (>${TRIAL_GRACE_DAYS}j)` : `abonnement expiré (>${GRACE_PERIOD_DAYS}j)`,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push(`${sub.user_id}: ${msg}`)
      console.error(`[Cron cleanup] Error deleting data for user ${sub.user_id}:`, msg)
      await logPurge(supabase, { kind: sub.kind, user_id: sub.user_id, reason: 'échec suppression', error: msg })
    }
  }

  console.log(`[Cron cleanup] Done: ${results.warningsSent.length} warnings, ${results.usersDeleted.length} deletions, ${results.errors.length} errors`)

  // Ligne de résumé pour l'audit
  await logPurge(supabase, {
    kind: 'summary',
    files_deleted: 0,
    reason: `warnings=${results.warningsSent.length} deletions=${results.usersDeleted.length} errors=${results.errors.length}`,
  })

  return NextResponse.json({
    success: true,
    ...results,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteUserData(
  supabase: any,
  userId: string
) {
  console.log(`[Cron cleanup] Deleting data for user ${userId}`)

  let filesDeleted = 0

  // Email récupéré tôt (utilisé pour trial_tokens + audit)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('id', userId)
    .single()
  const email: string | null = profile?.email ?? null

  // 1. Récupérer les sessions COMPLÈTES (pour extraire les médias des jeux/réglages avant suppression)
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)

  if (sessions && sessions.length > 0) {
    const sessionIds = sessions.map((s: { id: string }) => s.id)

    // 2. Médias référencés dans le JSON des sessions (quiz/mystery/lineup/wheel + fonds/logos/promos)
    const sessionMediaPaths = Array.from(
      new Set(sessions.flatMap((s: Record<string, unknown>) => collectSessionStoragePaths(s)))
    ) as string[]

    // 3. Photos invités/borne (table photos → storage_path)
    const { data: photos } = await supabase
      .from('photos')
      .select('storage_path')
      .in('session_id', sessionIds)
    const photoPaths = (photos || [])
      .map((p: { storage_path: string }) => p.storage_path)
      .filter(Boolean) as string[]

    // 4. Suppression Storage (bucket photos) : médias jeux + photos invités, dédupliqués
    const allPaths = Array.from(new Set([...sessionMediaPaths, ...photoPaths]))
    filesDeleted += await removeFromPhotos(supabase, allPaths)

    // 5. Suppression des enregistrements DB liés aux sessions
    await supabase.from('photos').delete().in('session_id', sessionIds)
    await supabase.from('print_requests').delete().in('session_id', sessionIds)
    await supabase.from('borne_connections').delete().in('session_id', sessionIds)

    // 6. Suppression des sessions
    await supabase.from('sessions').delete().eq('user_id', userId)
  }

  // 8. Delete invoices
  // First delete invoice PDFs from storage
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, pdf_path')
    .eq('user_id', userId)

  if (invoices && invoices.length > 0) {
    const pdfPaths = invoices.map((i: { pdf_path: string }) => i.pdf_path).filter(Boolean)
    if (pdfPaths.length > 0) {
      await supabase.storage
        .from('invoices')
        .remove(pdfPaths)
      filesDeleted += pdfPaths.length
    }

    await supabase
      .from('invoices')
      .delete()
      .eq('user_id', userId)
  }

  // 9. Delete trial tokens (email déjà récupéré plus haut)
  if (email) {
    await supabase
      .from('trial_tokens')
      .delete()
      .eq('email', email)
  }

  // 10. Delete promo code uses
  await supabase
    .from('promo_code_uses')
    .delete()
    .eq('user_id', userId)

  // 10b. Delete saved quizzes (bibliothèque personnelle) — cascade auth aussi en filet
  await supabase
    .from('saved_quizzes')
    .delete()
    .eq('user_id', userId)

  // 11. Delete subscription record
  await supabase
    .from('subscriptions')
    .delete()
    .eq('user_id', userId)

  // 12. Delete user profile
  await supabase
    .from('user_profiles')
    .delete()
    .eq('id', userId)

  // 13. Delete auth user (this cascades to user_profiles if not already deleted)
  await supabase.auth.admin.deleteUser(userId)

  console.log(`[Cron cleanup] Successfully deleted all data for user ${userId} (${filesDeleted} fichiers Storage)`)
  return { filesDeleted, email }
}

// Check if a user's Stripe subscription is actually still active
// This prevents deleting data for users who renewed but whose DB wasn't updated
async function checkStripeSubscriptionActive(
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null
): Promise<{ active: boolean; status?: string; periodStart?: string; periodEnd?: string }> {
  try {
    // Check by subscription ID first
    if (stripeSubscriptionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId) as any
      if (sub.status === 'active' || sub.status === 'trialing') {
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : sub.items?.data?.[0]?.current_period_end
            ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
            : undefined
        const periodStart = sub.current_period_start
          ? new Date(sub.current_period_start * 1000).toISOString()
          : sub.items?.data?.[0]?.current_period_start
            ? new Date(sub.items.data[0].current_period_start * 1000).toISOString()
            : undefined
        return { active: true, status: sub.status, periodStart, periodEnd }
      }
    }

    // Fallback: check all subscriptions for this customer
    if (stripeCustomerId) {
      const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, limit: 5 })
      const activeSub = subs.data.find(s => s.status === 'active' || s.status === 'trialing')
      if (activeSub) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = activeSub as any
        const periodEnd = raw.current_period_end
          ? new Date(raw.current_period_end * 1000).toISOString()
          : raw.items?.data?.[0]?.current_period_end
            ? new Date(raw.items.data[0].current_period_end * 1000).toISOString()
            : undefined
        const periodStart = raw.current_period_start
          ? new Date(raw.current_period_start * 1000).toISOString()
          : raw.items?.data?.[0]?.current_period_start
            ? new Date(raw.items.data[0].current_period_start * 1000).toISOString()
            : undefined
        return { active: true, status: activeSub.status, periodStart, periodEnd }
      }
    }
  } catch (error) {
    // If Stripe lookup fails, err on the side of caution: don't delete
    console.error('[Cron cleanup] Stripe check failed:', error instanceof Error ? error.message : error)
    return { active: true, status: 'unknown_stripe_error' }
  }

  return { active: false }
}
