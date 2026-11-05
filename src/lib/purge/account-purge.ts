// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Purge des contenus d'un compte 30 jours après la fin de son accès.
// Modes (variable PURGE_MODE) :
//   dry-run (défaut) : rien n'est supprimé ni envoyé, chaque compte concerné est
//                      inscrit dans purge_log (status 'dry_run') avec ce qui partirait ;
//   warn             : les e-mails J-7 partent, rien n'est supprimé ;
//   live             : e-mails + suppressions réelles (5 comptes max, arrêt à la 1re erreur).
// Conservés : compte (auth, profil), abonnements, factures, trial_tokens, affiliation, purge_log (3 ans).

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ENDED_STATUSES,
  PURGE_LOG_RETENTION_YEARS,
  PURGE_MAX_ACCOUNTS_PER_RUN,
  PURGE_MAX_PLANNED_PER_RUN,
  STRIPE_ENDED_STATUSES,
  collectPhotosPaths,
  decideAccess,
  effectivePurgeAt,
  pathBelongsTo,
  planFiles,
  purgeAllowed,
  toPhotosPath,
  warningDue,
  warningKey,
  type AccessType,
  type PurgeMode,
  type StoredFile,
  type SubscriptionRow,
} from './rules'

const BUCKET = 'photos'
const KIND_PURGE = 'account_purge'
const KIND_WARNING = 'purge_warning'
const SUB_COLS = 'status, trial_end, current_period_end, pass_validity_until, stripe_subscription_id, stripe_customer_id'
const SESSION_MEDIA_COLS = 'id, quiz_questions, mystery_photos, mystery_photo_url, mystery_reveal_audio, lineup_audio, wheel_audio, background_image, custom_logo, promo_affiches'

export interface StripeStatusReader {
  subscriptionStatus(id: string): Promise<string>
  customerStatuses(customerId: string): Promise<string[]>
}

export interface PurgeDeps {
  db: SupabaseClient
  mode: PurgeMode
  now: number
  stripe: StripeStatusReader | null
  sendWarning: (p: { to: string; type: AccessType; endAt: number; purgeAt: number }) => Promise<{ success: boolean; error?: unknown }>
  timeBudgetMs?: number
  log?: (msg: string) => void
}

export interface AccountReport {
  userId: string
  email: string | null
  type: AccessType
  endAt: string
  purgeAt: string
  warnedAt: string | null
  action: 'warned' | 'warn-skipped' | 'waiting-warning' | 'dry-run' | 'purged' | 'skipped' | 'failed'
  reason?: string
  counts?: Record<string, number>
  files?: number
  bytes?: number
  keptShared?: number
}

export interface PurgeRunReport {
  mode: PurgeMode
  evaluated: number
  reports: AccountReport[]
  stoppedOnError: string | null
  logRowsExpired: number
}

class PurgeError extends Error {}
const must = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new PurgeError(`${what} : ${r.error.message}`)
  return r.data
}

// ---------- Stripe : un compte n'est purgeable que si TOUT est terminé côté Stripe ----------
async function stripeConfirmsEnded(stripe: StripeStatusReader | null, subs: SubscriptionRow[]): Promise<{ ok: boolean; reason?: string }> {
  const subIds = [...new Set(subs.map((s) => s.stripe_subscription_id).filter((x): x is string => !!x))]
  const customers = [...new Set(subs.map((s) => s.stripe_customer_id).filter((x): x is string => !!x))]
  if (subIds.length === 0 && customers.length === 0) return { ok: true }
  if (!stripe) return { ok: false, reason: 'Stripe non configuré' }
  try {
    for (const id of subIds) {
      const st = await stripe.subscriptionStatus(id)
      if (!(STRIPE_ENDED_STATUSES as readonly string[]).includes(st)) return { ok: false, reason: `Stripe : abonnement ${st}` }
    }
    for (const c of customers) {
      const sts = await stripe.customerStatuses(c)
      const alive = sts.find((st) => !(STRIPE_ENDED_STATUSES as readonly string[]).includes(st))
      if (alive) return { ok: false, reason: `Stripe : client avec abonnement ${alive}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: `Stripe injoignable : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ---------- Lecture ----------
async function readAccess(db: SupabaseClient, userId: string) {
  const [p, s] = await Promise.all([
    db.from('user_profiles').select('role, email').eq('id', userId).maybeSingle(),
    db.from('subscriptions').select(SUB_COLS).eq('user_id', userId),
  ])
  return {
    profile: p.error ? null : (p.data as { role: string | null; email: string | null } | null),
    subs: s.error ? null : ((s.data ?? []) as SubscriptionRow[]),
  }
}

async function listAll(db: SupabaseClient, prefix: string, search?: string): Promise<StoredFile[]> {
  const out: StoredFile[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 1000, offset, ...(search ? { search } : {}) })
    if (error) throw new PurgeError(`listage ${prefix} : ${error.message}`)
    for (const f of data ?? []) {
      const path = `${prefix}/${f.name}`
      if (f.id === null) out.push(...(await listAll(db, path)))
      else out.push({ path, size: Number((f.metadata as { size?: number } | null)?.size ?? 0) })
    }
    if (!data || data.length < 1000) break
  }
  return out
}

// Fichiers rangés sous les sessions et l'identifiant du compte.
async function listOwnedFiles(db: SupabaseClient, userId: string, sessionIds: string[]): Promise<StoredFile[]> {
  const sids = new Set(sessionIds)
  const files: StoredFile[] = []
  const keep = (list: StoredFile[]) => files.push(...list.filter((f) => pathBelongsTo(f.path, userId, sids)))
  for (const sid of sessionIds) {
    keep(await listAll(db, sid))
    // La recherche du stockage ne trouve que les noms qui COMMENCENT par le texte donné.
    for (const folder of ['quiz-audio', 'quiz-photos', 'quiz-question-audio', 'quiz-ambient', 'backgrounds', 'logos']) {
      keep(await listAll(db, folder, sid))
    }
    for (const folder of ['mystery-photos', 'mystery-audio']) {
      for (const start of ['mystery_', 'mystery_audio_', 'mystery_reveal_']) keep(await listAll(db, folder, `${start}${sid}`))
    }
    keep(await listAll(db, `promos/${sid}`))
    keep(await listAll(db, `vote-photos/${sid}`))
  }
  keep(await listAll(db, `buzzer-media/${userId}`))
  keep(await listAll(db, `borne-templates/${userId}`))
  keep(await listAll(db, `promos/defaults-${userId}`))
  for (const folder of ['backgrounds', 'logos']) keep(await listAll(db, folder, `defaults-${userId}`))
  const seen = new Set<string>()
  return files.filter((f) => (seen.has(f.path) ? false : (seen.add(f.path), true)))
}

async function readAllRows<T>(db: SupabaseClient, table: string, cols: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const r = await db.from(table).select(cols).range(from, from + 999)
    const data = must(r as unknown as { data: T[]; error: { message: string } | null }, `lecture ${table}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

// Qui référence quel fichier, pour TOUS les comptes (protection contre les fichiers partagés).
export interface ReferenceIndex {
  byPath: Map<string, Set<string>>
  byUser: Map<string, Set<string>>
  sessionOwner: Map<string, string>
  userIds: Set<string>
}

export async function buildReferenceIndex(db: SupabaseClient): Promise<ReferenceIndex> {
  const byPath = new Map<string, Set<string>>()
  const byUser = new Map<string, Set<string>>()
  const add = (user: string | null | undefined, path: string) => {
    if (!user) return
    if (!byPath.has(path)) byPath.set(path, new Set())
    byPath.get(path)!.add(user)
    if (!byUser.has(user)) byUser.set(user, new Set())
    byUser.get(user)!.add(path)
  }
  const addAll = (user: string | null | undefined, value: unknown) => { for (const p of collectPhotosPaths(value)) add(user, p) }

  const sessions = await readAllRows<Record<string, unknown>>(db, 'sessions', `user_id, ${SESSION_MEDIA_COLS}`)
  const sessionOwner = new Map<string, string>()
  for (const s of sessions) {
    if (typeof s.user_id === 'string') sessionOwner.set(s.id as string, s.user_id)
    const { id: _id, user_id, ...media } = s
    void _id
    addAll(user_id as string, media)
  }
  for (const r of await readAllRows<{ session_id: string; storage_path: string | null }>(db, 'photos', 'session_id, storage_path')) {
    const p = toPhotosPath(r.storage_path)
    if (p) add(sessionOwner.get(r.session_id), p)
  }
  for (const t of ['saved_quizzes', 'saved_mysteries', 'saved_buzzer_sets', 'borne_templates', 'account_display_defaults']) {
    for (const r of await readAllRows<Record<string, unknown>>(db, t, '*')) addAll(r.user_id as string, r)
  }
  for (const t of ['vote_drafts', 'buzzer_prep_sets']) {
    for (const r of await readAllRows<Record<string, unknown>>(db, t, '*')) addAll(sessionOwner.get(r.session_id as string), r)
  }
  const profiles = await readAllRows<{ id: string }>(db, 'user_profiles', 'id')
  return { byPath, byUser, sessionOwner, userIds: new Set(profiles.map((p) => p.id)) }
}

// ---------- Plan d'un compte ----------
const SESSION_TABLES = ['messages', 'photos', 'print_requests', 'borne_connections'] as const
const USER_TABLES = ['saved_quizzes', 'saved_mysteries', 'saved_matchings', 'saved_buzzer_sets', 'borne_templates', 'account_display_defaults'] as const

async function countRows(db: SupabaseClient, table: string, col: string, values: string[]): Promise<number> {
  if (values.length === 0) return 0
  const r = await db.from(table).select(col, { count: 'exact', head: true }).in(col, values)
  if (r.error) throw new PurgeError(`comptage ${table} : ${r.error.message}`)
  return r.count ?? 0
}

export async function planAccount(db: SupabaseClient, index: ReferenceIndex, userId: string) {
  const sessions = must(await db.from('sessions').select('id').eq('user_id', userId), 'lecture sessions') as { id: string }[]
  const sessionIds = sessions.map((s) => s.id)
  const counts: Record<string, number> = { sessions: sessionIds.length }
  for (const t of SESSION_TABLES) counts[t] = await countRows(db, t, 'session_id', sessionIds)
  for (const t of USER_TABLES) counts[t] = await countRows(db, t, 'user_id', [userId])
  const owned = await listOwnedFiles(db, userId, sessionIds)
  const otherOwner = (p: string) => {
    for (const [sid, uid] of index.sessionOwner) if (uid !== userId && pathBelongsTo(p, uid, new Set([sid]))) return true
    for (const uid of index.userIds) if (uid !== userId && pathBelongsTo(p, uid, new Set())) return true
    return false
  }
  const files = planFiles(owned, index.byUser.get(userId) ?? new Set(), index.byPath, userId, otherOwner)
  return { sessionIds, counts, files }
}

// ---------- Exécution d'un compte (fichiers d'abord : une reprise reste possible) ----------
async function executeAccount(db: SupabaseClient, userId: string, plan: Awaited<ReturnType<typeof planAccount>>) {
  const deleted: Record<string, number> = {}
  const paths = plan.files.toDelete.map((f) => f.path)
  let filesRemoved = 0
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    const r = await db.storage.from(BUCKET).remove(batch)
    if (r.error) throw new PurgeError(`suppression fichiers : ${r.error.message}`)
    filesRemoved += r.data?.length ?? 0
  }
  const ids = plan.sessionIds
  for (const t of SESSION_TABLES) {
    if (ids.length === 0) { deleted[t] = 0; continue }
    const r = await db.from(t).delete({ count: 'exact' }).in('session_id', ids)
    if (r.error) throw new PurgeError(`suppression ${t} : ${r.error.message}`)
    deleted[t] = r.count ?? 0
  }
  const rs = await db.from('sessions').delete({ count: 'exact' }).eq('user_id', userId)
  if (rs.error) throw new PurgeError(`suppression sessions : ${rs.error.message}`)
  deleted.sessions = rs.count ?? 0
  for (const t of USER_TABLES) {
    const r = await db.from(t).delete({ count: 'exact' }).eq('user_id', userId)
    if (r.error) throw new PurgeError(`suppression ${t} : ${r.error.message}`)
    deleted[t] = r.count ?? 0
  }
  const left = await db.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if (left.error || (left.count ?? 0) > 0) throw new PurgeError('des sessions restent après suppression')
  return { deleted, filesRemoved }
}

// ---------- Journal ----------
async function lastLog(db: SupabaseClient, userId: string, kind: string, reason: string, status?: string) {
  let q = db.from('purge_log').select('id, created_at, status').eq('user_id', userId).eq('kind', kind).eq('reason', reason)
  if (status) q = q.eq('status', status)
  const r = await q.order('created_at', { ascending: true }).limit(1)
  if (r.error) throw new PurgeError(`lecture purge_log : ${r.error.message}`)
  return (r.data?.[0] as { id: string; created_at: string } | undefined) ?? null
}

async function insertLog(db: SupabaseClient, row: Record<string, unknown>): Promise<string> {
  const r = await db.from('purge_log').insert(row).select('id').single()
  if (r.error || !r.data) throw new PurgeError(`écriture purge_log : ${r.error?.message ?? 'aucune ligne'}`)
  return (r.data as { id: string }).id
}

// ---------- Passage complet ----------
export async function runAccountPurge(deps: PurgeDeps): Promise<PurgeRunReport> {
  const { db, mode, now, stripe } = deps
  const log = deps.log ?? (() => {})
  const deadline = Date.now() + (deps.timeBudgetMs ?? 150_000)
  const report: PurgeRunReport = { mode, evaluated: 0, reports: [], stoppedOnError: null, logRowsExpired: 0 }

  // Comptes candidats : au moins une ligne d'abonnement terminée.
  const cand = must(await db.from('subscriptions').select('user_id').in('status', [...ENDED_STATUSES]), 'lecture candidats') as { user_id: string }[]
  const userIds = [...new Set(cand.map((c) => c.user_id))]

  type Due = { userId: string; email: string | null; type: AccessType; endAt: number; purgeAt: number; subs: SubscriptionRow[] }
  const evaluated: Due[] = []
  for (const userId of userIds) {
    const { profile, subs } = await readAccess(db, userId)
    const d = decideAccess(profile, subs, now)
    report.evaluated++
    if (d.state === 'never' || d.state === 'doubt') {
      if (d.state === 'doubt') log(`[purge] ${userId} ignoré (doute) : ${d.reason}`)
      continue
    }
    if (now < d.purgeAt - 8 * 864e5) continue // loin de l'échéance
    evaluated.push({ userId, email: profile?.email ?? null, type: d.type, endAt: d.endAt, purgeAt: d.purgeAt, subs: subs ?? [] })
  }
  evaluated.sort((a, b) => a.purgeAt - b.purgeAt)

  let index: ReferenceIndex | null = null
  let planned = 0
  let executed = 0
  for (const acc of evaluated) {
    if (Date.now() > deadline) { log('[purge] budget de temps atteint, suite au prochain passage'); break }
    const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString())
    const key = warningKey(acc.endAt)
    const base = { userId: acc.userId, email: acc.email, type: acc.type, endAt: iso(acc.endAt)!, purgeAt: iso(acc.purgeAt)! }
    try {
      // Déjà purgé pour cette fin d'accès ?
      if (await lastLog(db, acc.userId, KIND_PURGE, key, 'done')) continue

      const warn = await lastLog(db, acc.userId, KIND_WARNING, key)
      const warnedAt = warn ? Date.parse(warn.created_at) : null

      // 1. E-mail J-7 (jamais envoyé en dry-run). Aucune suppression le même soir.
      if (warnedAt === null) {
        if (!warningDue(acc.purgeAt, null, now)) continue
        const stripeCheck = await stripeConfirmsEnded(stripe, acc.subs)
        if (!stripeCheck.ok) { report.reports.push({ ...base, warnedAt: null, action: 'skipped', reason: stripeCheck.reason }); continue }
        const announced = effectivePurgeAt(acc.purgeAt, now)!
        if (mode === 'dry-run') {
          report.reports.push({ ...base, warnedAt: null, action: 'warn-skipped', reason: `e-mail qui partirait (suppression annoncée le ${iso(announced)})` })
          // En dry-run, on liste aussi ce qui partirait si l'échéance des 30 jours est passée.
          if (now < acc.purgeAt) continue
        } else if (!acc.email) {
          report.reports.push({ ...base, warnedAt: null, action: 'skipped', reason: 'pas d’adresse e-mail : aucune purge sans avertissement' })
          continue
        } else {
          const sent = await deps.sendWarning({ to: acc.email, type: acc.type, endAt: acc.endAt, purgeAt: announced })
          if (!sent.success) throw new PurgeError(`e-mail non envoyé : ${sent.error instanceof Error ? sent.error.message : String(sent.error ?? '')}`)
          await insertLog(db, { kind: KIND_WARNING, user_id: acc.userId, email: acc.email, reason: key, status: 'done', details: { type: acc.type, endAt: base.endAt, purgeAt: iso(announced) } })
          report.reports.push({ ...base, warnedAt: new Date(now).toISOString(), action: 'warned', reason: `suppression annoncée le ${iso(announced)}` })
          continue
        }
      } else if (!purgeAllowed(acc.purgeAt, warnedAt, now)) {
        // 2. Averti : on attend la date annoncée (au moins 7 jours après l'e-mail).
        report.reports.push({ ...base, warnedAt: iso(warnedAt), action: 'waiting-warning', reason: `suppression le ${iso(effectivePurgeAt(acc.purgeAt, warnedAt))}` })
        continue
      }

      // 3. Suppression (simulée en dry-run, jamais en warn)
      if (mode === 'warn') continue
      if (planned >= PURGE_MAX_PLANNED_PER_RUN) break
      if (mode === 'live' && executed >= PURGE_MAX_ACCOUNTS_PER_RUN) break

      const stripe1 = await stripeConfirmsEnded(stripe, acc.subs)
      if (!stripe1.ok) { report.reports.push({ ...base, warnedAt: iso(warnedAt), action: 'skipped', reason: stripe1.reason }); continue }

      index ??= await buildReferenceIndex(db)
      const plan = await planAccount(db, index, acc.userId)
      planned++
      const summary = { counts: plan.counts, files: plan.files.toDelete.length, bytes: plan.files.bytes, keptShared: plan.files.keptShared.length }

      if (mode === 'dry-run') {
        await insertLog(db, { kind: KIND_PURGE, user_id: acc.userId, email: acc.email, reason: key, status: 'dry_run', files_deleted: 0, rows_deleted: 0, bytes_deleted: 0,
          details: { mode, type: acc.type, endAt: base.endAt, purgeAt: base.purgeAt, warnedAt: iso(warnedAt), wouldDelete: { ...summary, keptSharedPaths: plan.files.keptShared.slice(0, 50) } } })
        report.reports.push({ ...base, warnedAt: iso(warnedAt), action: 'dry-run', ...summary })
        continue
      }

      // Mode réel : deuxième vérification juste avant de supprimer (DB + Stripe).
      const again = await readAccess(db, acc.userId)
      const d2 = decideAccess(again.profile, again.subs, now)
      if (d2.state !== 'due' || d2.endAt !== acc.endAt) { report.reports.push({ ...base, warnedAt: iso(warnedAt), action: 'skipped', reason: 'situation changée au dernier contrôle' }); continue }
      const stripe2 = await stripeConfirmsEnded(stripe, again.subs ?? [])
      if (!stripe2.ok) { report.reports.push({ ...base, warnedAt: iso(warnedAt), action: 'skipped', reason: stripe2.reason }); continue }

      const logId = await insertLog(db, { kind: KIND_PURGE, user_id: acc.userId, email: acc.email, reason: key, status: 'started', files_deleted: 0,
        details: { mode, type: acc.type, endAt: base.endAt, purgeAt: base.purgeAt, warnedAt: iso(warnedAt), planned: summary } })
      executed++
      try {
        const res = await executeAccount(db, acc.userId, plan)
        const rows = Object.values(res.deleted).reduce((a, b) => a + b, 0)
        const upd = await db.from('purge_log').update({ status: 'done', files_deleted: res.filesRemoved, rows_deleted: rows, bytes_deleted: plan.files.bytes,
          details: { mode, type: acc.type, endAt: base.endAt, purgeAt: base.purgeAt, warnedAt: iso(warnedAt), planned: summary, deleted: res.deleted, keptSharedPaths: plan.files.keptShared.slice(0, 50) } }).eq('id', logId)
        if (upd.error) throw new PurgeError(`mise à jour purge_log : ${upd.error.message}`)
        report.reports.push({ ...base, warnedAt: iso(warnedAt), action: 'purged', counts: res.deleted, files: res.filesRemoved, bytes: plan.files.bytes, keptShared: summary.keptShared })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await db.from('purge_log').update({ status: 'failed', error: msg }).eq('id', logId)
        throw e
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      report.reports.push({ ...base, warnedAt: null, action: 'failed', reason: msg })
      report.stoppedOnError = `${acc.userId} : ${msg}`
      log(`[purge] ARRÊT sur erreur : ${report.stoppedOnError}`)
      break
    }
  }

  // Journal des purges : 3 ans de conservation.
  const limit = new Date(now)
  limit.setFullYear(limit.getFullYear() - PURGE_LOG_RETENTION_YEARS)
  if (mode === 'live' && !report.stoppedOnError) {
    const r = await db.from('purge_log').delete({ count: 'exact' }).lt('created_at', limit.toISOString())
    if (!r.error) report.logRowsExpired = r.count ?? 0
  }
  return report
}
