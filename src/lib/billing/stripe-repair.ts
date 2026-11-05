// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Filet de sécurité « webhook perdu » : quand la base dit qu'un abonnement est
// terminé mais que Stripe le dit encore actif, on remet la ligne à « active »
// avec les dates de Stripe. Indépendant de la purge et de PURGE_MODE.
// Ne supprime jamais rien ; ne touche qu'une ligne de `subscriptions` par compte.

import type { SupabaseClient } from '@supabase/supabase-js'

export const REPAIR_ENDED_STATUSES = ['expired', 'canceled', 'past_due', 'unpaid', 'incomplete_expired'] as const
const ACCESS_STATUSES = ['active', 'trialing', 'weekend_pass']
export const REPAIR_MAX_PER_RUN = 100

export interface ActiveStripeSubscription {
  status: string
  periodStart: string | null
  periodEnd: string | null
}

// Renvoie l'abonnement Stripe actif (active / trialing) du compte, ou null.
// Lève une erreur si Stripe ne répond pas : la ligne n'est alors pas modifiée.
export interface StripeActiveReader {
  findActive(subscriptionId: string | null, customerId: string | null): Promise<ActiveStripeSubscription | null>
}

export interface RepairReport {
  checked: number
  repaired: { userId: string; rowId: string; status: string; periodEnd: string }[]
  errors: string[]
}

interface SubRow {
  id: string
  user_id: string | null
  status: string | null
  current_period_end: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
}

// Lit les dates d'un abonnement Stripe, quelle que soit la version de l'API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripePeriod(sub: any): { periodStart: string | null; periodEnd: string | null } {
  const toIso = (s: unknown) => (typeof s === 'number' && s > 0 ? new Date(s * 1000).toISOString() : null)
  const item = sub?.items?.data?.[0]
  return {
    periodStart: toIso(sub?.current_period_start) ?? toIso(item?.current_period_start),
    periodEnd: toIso(sub?.current_period_end) ?? toIso(item?.current_period_end),
  }
}

export async function repairSubscriptionsFromStripe(deps: {
  db: SupabaseClient
  stripe: StripeActiveReader
  now: number
  max?: number
  log?: (m: string) => void
}): Promise<RepairReport> {
  const { db, stripe, now } = deps
  const log = deps.log ?? (() => {})
  const report: RepairReport = { checked: 0, repaired: [], errors: [] }

  const { data, error } = await db
    .from('subscriptions')
    .select('id, user_id, status, current_period_end, stripe_subscription_id, stripe_customer_id')
    .in('status', [...REPAIR_ENDED_STATUSES])
    .or('stripe_subscription_id.not.is.null,stripe_customer_id.not.is.null')
    .order('current_period_end', { ascending: false, nullsFirst: false })
  if (error) throw new Error(`lecture subscriptions : ${error.message}`)

  // Une seule ligne par compte : la plus récente.
  const byUser = new Map<string, SubRow>()
  for (const row of (data ?? []) as SubRow[]) if (row.user_id && !byUser.has(row.user_id)) byUser.set(row.user_id, row)

  for (const row of [...byUser.values()].slice(0, deps.max ?? REPAIR_MAX_PER_RUN)) {
    const userId = row.user_id as string
    report.checked++
    try {
      // Compte déjà actif par une autre ligne : rien à réparer.
      const other = await db.from('subscriptions').select('id').eq('user_id', userId).in('status', ACCESS_STATUSES).limit(1)
      if (other.error) throw new Error(`lecture : ${other.error.message}`)
      if ((other.data ?? []).length > 0) continue

      const active = await stripe.findActive(row.stripe_subscription_id, row.stripe_customer_id)
      // Uniquement si Stripe confirme une fin de période FUTURE (évite les boucles sur erreur ou date absente).
      if (!active || !active.periodEnd || Date.parse(active.periodEnd) <= now) continue

      const upd = await db
        .from('subscriptions')
        .update({ status: 'active', current_period_end: active.periodEnd, ...(active.periodStart ? { current_period_start: active.periodStart } : {}) })
        .eq('id', row.id)
        .eq('status', row.status as string) // n'écrase pas une ligne modifiée entre-temps (webhook)
        .select('id')
      if (upd.error) throw new Error(`mise à jour : ${upd.error.message}`)
      if ((upd.data ?? []).length === 1) {
        report.repaired.push({ userId, rowId: row.id, status: row.status as string, periodEnd: active.periodEnd })
        log(`[Réparation Stripe] ${userId} : ${row.status} → active (fin ${active.periodEnd})`)
      }
    } catch (e) {
      // Une erreur sur un compte ne bloque pas les autres ; rien n'est modifié pour ce compte.
      report.errors.push(`${userId} : ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return report
}
