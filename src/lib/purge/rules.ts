// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Règles de la purge des contenus, SANS accès réseau (testables seules).
// Règle : tout ce qu'un compte a créé est supprimé 30 jours après la fin de son
// accès (abonnement, essai ou Pass Événement), après un e-mail envoyé au moins
// 7 jours avant. Le compte, l'historique d'abonnement, les factures et la trace
// d'essai sont conservés. Dans le doute, on ne supprime rien.

export const PURGE_GRACE_DAYS = 30
export const PURGE_WARNING_DAYS = 7
export const PURGE_LOG_RETENTION_YEARS = 3
export const PURGE_MAX_ACCOUNTS_PER_RUN = 5
export const PURGE_MAX_PLANNED_PER_RUN = 25
const DAY = 24 * 60 * 60 * 1000
// Marge pour l'heure exacte du cron (un passage par jour vers 03:00 UTC).
const CRON_TOLERANCE_MS = 2 * 60 * 60 * 1000

export type PurgeMode = 'dry-run' | 'warn' | 'live'
// Tout ce qui n'est pas exactement « warn » ou « live » vaut « dry-run ».
export function parsePurgeMode(value: string | undefined | null): PurgeMode {
  const v = (value ?? '').trim().toLowerCase()
  return v === 'live' || v === 'warn' ? v : 'dry-run'
}

export const ACCESS_STATUSES = ['active', 'trialing', 'weekend_pass'] as const
export const ENDED_STATUSES = ['expired', 'canceled', 'past_due', 'unpaid', 'incomplete_expired'] as const
// Statuts Stripe qui prouvent qu'un abonnement est vraiment terminé.
export const STRIPE_ENDED_STATUSES = ['canceled', 'incomplete_expired'] as const

export interface SubscriptionRow {
  status: string | null
  trial_end: string | null
  current_period_end: string | null
  pass_validity_until: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
}

export type AccessType = 'essai' | 'pass' | 'abonnement'
export type AccessDecision =
  | { state: 'never'; reason: string }
  | { state: 'doubt'; reason: string }
  | { state: 'waiting' | 'due'; type: AccessType; endAt: number; purgeAt: number }

const toTime = (v: string | null | undefined): number => {
  if (!v) return NaN
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : NaN
}

// Fin d'accès d'un compte et date de purge prévue (avant prise en compte de l'e-mail).
export function decideAccess(
  profile: { role: string | null } | null,
  subs: SubscriptionRow[] | null,
  now: number,
): AccessDecision {
  if (!profile) return { state: 'doubt', reason: 'profil illisible' }
  if (profile.role === 'owner') return { state: 'never', reason: 'accès à vie' }
  if (!subs) return { state: 'doubt', reason: 'abonnements illisibles' }
  if (subs.length === 0) return { state: 'doubt', reason: 'aucune ligne d’abonnement' }
  if (subs.some((s) => (ACCESS_STATUSES as readonly string[]).includes(s.status ?? ''))) {
    return { state: 'never', reason: 'accès en cours' }
  }
  const unknown = subs.find((s) => !(ENDED_STATUSES as readonly string[]).includes(s.status ?? ''))
  if (unknown) return { state: 'doubt', reason: `statut inconnu : ${unknown.status ?? 'vide'}` }

  let endAt = -Infinity
  let type: AccessType = 'abonnement'
  for (const s of subs) {
    const dates = [toTime(s.trial_end), toTime(s.current_period_end), toTime(s.pass_validity_until)].filter((t) => !Number.isNaN(t))
    if (dates.length === 0) return { state: 'doubt', reason: 'date de fin manquante' }
    const rowEnd = Math.max(...dates)
    if (rowEnd > endAt) {
      endAt = rowEnd
      type = s.pass_validity_until ? 'pass' : !s.stripe_subscription_id && s.trial_end ? 'essai' : 'abonnement'
    }
  }
  const purgeAt = endAt + PURGE_GRACE_DAYS * DAY
  return { state: now >= purgeAt ? 'due' : 'waiting', type, endAt, purgeAt }
}

// Date de suppression annoncée / effective : jamais moins de 7 jours après l'e-mail.
export function effectivePurgeAt(purgeAt: number, warnedAt: number | null): number | null {
  if (warnedAt === null) return null
  return Math.max(purgeAt, warnedAt + PURGE_WARNING_DAYS * DAY)
}

// L'e-mail part 7 jours avant la date prévue (ou dès que possible si on est déjà dans la fenêtre).
export function warningDue(purgeAt: number, warnedAt: number | null, now: number): boolean {
  return warnedAt === null && now >= purgeAt - PURGE_WARNING_DAYS * DAY - CRON_TOLERANCE_MS
}

export function purgeAllowed(purgeAt: number, warnedAt: number | null, now: number): boolean {
  const eff = effectivePurgeAt(purgeAt, warnedAt)
  return eff !== null && now >= eff - CRON_TOLERANCE_MS
}

export const warningKey = (endAt: number) => `end=${new Date(endAt).toISOString()}`

// ---------- Stockage : chemins et propriétaires ----------

// Chemin dans le bucket photos d'une valeur stockée (adresse publique ou chemin).
export function toPhotosPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v) return null
  const clean = v.split(/[?#]/)[0]
  const m = clean.match(/\/object\/(?:public|sign)\/photos\/(.+)$/)
  let p: string
  if (m) p = m[1]
  else if (/^https?:\/\//i.test(clean)) return null
  else p = clean.replace(/^\/+/, '')
  try { p = decodeURIComponent(p) } catch { /* gardé tel quel */ }
  return p || null
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
// Dossiers de médias connus du bucket photos (un texte libre ne compte jamais comme fichier).
const MEDIA_PATH = new RegExp(
  `^(?:${UUID}|quiz-audio|quiz-photos|quiz-question-audio|quiz-ambient|mystery-photos|mystery-audio|backgrounds|logos|promos|vote-photos|buzzer-media|borne-templates)/[^\\s]+$`,
)

// Toutes les chaînes d'un objet JSON qui ressemblent à un fichier du bucket photos.
export function collectPhotosPaths(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    let parsed: unknown = undefined
    const s = value.trim()
    if ((s.startsWith('[') || s.startsWith('{')) && s.length > 1) {
      try { parsed = JSON.parse(s) } catch { parsed = undefined }
    }
    if (parsed !== undefined) collectPhotosPaths(parsed, out)
    else if (s.includes('/photos/') || MEDIA_PATH.test(s)) {
      const p = toPhotosPath(s)
      if (p && MEDIA_PATH.test(p)) out.add(p)
    }
  } else if (Array.isArray(value)) {
    for (const v of value) collectPhotosPaths(v, out)
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectPhotosPaths(v, out)
  }
  return out
}

const OWNER_RULES: [RegExp, 'session' | 'user'][] = [
  [new RegExp(`^(${UUID})/`), 'session'],
  [new RegExp(`^quiz-(?:audio|photos|question-audio)/(${UUID})_`), 'session'],
  [new RegExp(`^mystery-(?:photos|audio)/mystery_(?:audio_|reveal_)?(${UUID})_`), 'session'],
  [new RegExp(`^(?:backgrounds|logos)/defaults-(${UUID})-`), 'user'],
  [new RegExp(`^(?:backgrounds|logos)/(${UUID})-`), 'session'],
  [new RegExp(`^promos/defaults-(${UUID})/`), 'user'],
  [new RegExp(`^promos/(${UUID})/`), 'session'],
  [new RegExp(`^vote-photos/(${UUID})/`), 'session'],
  [new RegExp(`^buzzer-media/(${UUID})/`), 'user'],
  [new RegExp(`^borne-templates/(${UUID})/`), 'user'],
]

// Le chemin désigne-t-il ce compte (par une de ses sessions ou par son identifiant) ?
export function pathBelongsTo(path: string, userId: string, sessionIds: Set<string>): boolean {
  for (const [re, kind] of OWNER_RULES) {
    const m = path.match(re)
    if (m) return kind === 'user' ? m[1] === userId : sessionIds.has(m[1])
  }
  return false
}

export interface StoredFile { path: string; size: number }

export interface FilePlan {
  toDelete: StoredFile[]
  keptShared: string[]
  bytes: number
}

// Fichiers à supprimer pour un compte :
// - ceux rangés sous ses sessions / son identifiant (même s'ils ne sont plus référencés) ;
// - ceux qu'il référence ailleurs (anciens noms), sauf si le chemin désigne un autre compte ;
// jamais ceux qu'un AUTRE compte référence.
export function planFiles(
  owned: StoredFile[],
  referencedByAccount: Set<string>,
  referencedBy: Map<string, Set<string>>,
  userId: string,
  ownedByAnotherAccount: (path: string) => boolean,
): FilePlan {
  const usedByOthers = (p: string) => [...(referencedBy.get(p) ?? [])].some((u) => u !== userId)
  const byPath = new Map<string, StoredFile>()
  for (const f of owned) byPath.set(f.path, f)
  const keptShared: string[] = []
  for (const p of referencedByAccount) {
    if (byPath.has(p)) continue
    if (ownedByAnotherAccount(p)) keptShared.push(p)
    else byPath.set(p, { path: p, size: 0 })
  }
  const toDelete: StoredFile[] = []
  for (const f of byPath.values()) {
    if (usedByOthers(f.path)) keptShared.push(f.path)
    else toDelete.push(f)
  }
  toDelete.sort((a, b) => a.path.localeCompare(b.path))
  return { toDelete, keptShared, bytes: toDelete.reduce((s, f) => s + (f.size || 0), 0) }
}

export function formatFrenchDate(t: number): string {
  return new Date(t).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' })
}
