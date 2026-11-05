// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Cron quotidien (03:00 UTC) :
// 0. Réparation « webhook perdu » : abonnement terminé en base mais actif chez
//    Stripe → remis à « active ». Toujours actif, quel que soit PURGE_MODE ;
//    ne supprime jamais rien.
// 1. Purge des contenus 30 jours après la fin d'accès (src/lib/purge), avec
//    e-mail obligatoire 7 jours avant. Mode piloté par PURGE_MODE :
//    dry-run (défaut, rien n'est supprimé ni envoyé) | warn (e-mails seulement) | live.
//    Le compte, les abonnements, les factures et la trace d'essai sont conservés.
// 2. Rappel 30 jours avant le renouvellement des abonnements annuels.
// Configure in vercel.json: { "path": "/api/cron/cleanup-expired", "schedule": "0 3 * * *" }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendAnnualRenewalReminderEmail, sendContentDeletionWarningEmail } from '@/lib/resend'
import { REMINDER_LOG_KIND, runAnnualRenewalReminders } from '@/lib/billing/annual-reminder'
import { stripe } from '@/lib/stripe'
import { runAccountPurge, type StripeStatusReader } from '@/lib/purge/account-purge'
import { formatFrenchDate, parsePurgeMode } from '@/lib/purge/rules'
import { repairSubscriptionsFromStripe, stripePeriod, type StripeActiveReader } from '@/lib/billing/stripe-repair'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Écrit une ligne d'audit dans purge_log (best-effort : ne bloque jamais le cron).
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

// Lecture des statuts Stripe (aucune écriture).
const stripeReader: StripeStatusReader = {
  async subscriptionStatus(id) {
    const sub = await stripe.subscriptions.retrieve(id)
    return sub.status
  },
  async customerStatuses(customerId) {
    const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
    return list.data.map((s) => s.status)
  },
}

// Recherche d'un abonnement Stripe actif (aucune écriture chez Stripe).
const ACTIVE_IN_STRIPE = ['active', 'trialing']
const stripeActiveReader: StripeActiveReader = {
  async findActive(subscriptionId, customerId) {
    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      if (ACTIVE_IN_STRIPE.includes(sub.status)) return { status: sub.status, ...stripePeriod(sub) }
    }
    if (customerId) {
      const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
      const found = list.data.find((s) => ACTIVE_IN_STRIPE.includes(s.status))
      if (found) return { status: found.status, ...stripePeriod(found) }
    }
    return null
  },
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

  // ============================================================
  // 0. Réparation « webhook perdu » (avant la purge, indépendante d'elle)
  // ============================================================
  let repair: Awaited<ReturnType<typeof repairSubscriptionsFromStripe>> | null = null
  let repairError: string | null = null
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      repair = await repairSubscriptionsFromStripe({ db: supabase, stripe: stripeActiveReader, now: now.getTime(), log: (m) => console.log(m) })
      for (const r of repair.repaired) {
        await logPurge(supabase, { kind: 'stripe_repair', user_id: r.userId, reason: `${r.status}→active fin=${r.periodEnd}` })
      }
      if (repair.errors.length) console.error('[Cron cleanup] Réparation Stripe, erreurs :', repair.errors)
    } catch (e) {
      repairError = e instanceof Error ? e.message : String(e)
      console.error('[Cron cleanup] Réparation Stripe impossible:', repairError)
    }
  }

  // ============================================================
  // 1. Purge des contenus (30 jours après la fin d'accès)
  // ============================================================
  const mode = parsePurgeMode(process.env.PURGE_MODE)
  let purge: Awaited<ReturnType<typeof runAccountPurge>> | null = null
  let purgeError: string | null = null
  try {
    purge = await runAccountPurge({
      db: supabase,
      mode,
      now: now.getTime(),
      stripe: process.env.STRIPE_SECRET_KEY ? stripeReader : null,
      sendWarning: ({ to, type, endAt, purgeAt }) =>
        sendContentDeletionWarningEmail({ to, type, endDate: formatFrenchDate(endAt), deletionDate: formatFrenchDate(purgeAt) }),
      log: (m) => console.log(m),
    })
  } catch (e) {
    purgeError = e instanceof Error ? e.message : String(e)
    console.error('[Cron cleanup] Purge impossible:', purgeError)
  }

  // ============================================================
  // 2. Rappel 30 jours avant le renouvellement des abonnements ANNUELS
  //    (indépendant de la purge : une erreur ici ne bloque rien d'autre)
  // ============================================================
  let annualReminders: { sent: number; skipped: number; errors: string[] } = { sent: 0, skipped: 0, errors: [] }
  try {
    const report = await runAnnualRenewalReminders(now, {
      listCandidates: async (fromIso, toIso) => {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('user_id, stripe_subscription_id')
          .eq('status', 'active')
          .not('stripe_subscription_id', 'is', null)
          .gte('current_period_end', fromIso)
          .lte('current_period_end', toIso)
        if (error) throw new Error(error.message)
        return (data ?? []) as { user_id: string; stripe_subscription_id: string }[]
      },
      isOwner: async (userId) => {
        const { data } = await supabase.from('user_profiles').select('role').eq('id', userId).maybeSingle()
        return data?.role === 'owner'
      },
      retrieveSubscription: async (id) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = await stripe.subscriptions.retrieve(id) as any
        const item = sub.items?.data?.[0]
        return {
          status: sub.status,
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          interval: item?.price?.recurring?.interval ?? null,
          unitAmountCents: typeof item?.price?.unit_amount === 'number' ? item.price.unit_amount : null,
          periodEnd: sub.current_period_end ?? item?.current_period_end ?? null,
        }
      },
      alreadySent: async (userId, key) => {
        const { data, error } = await supabase
          .from('purge_log')
          .select('id')
          .eq('kind', REMINDER_LOG_KIND)
          .eq('user_id', userId)
          .eq('reason', key)
          .limit(1)
        // Prudence : si on ne peut pas vérifier, on considère le rappel déjà envoyé.
        if (error) return true
        return !!(data && data.length > 0)
      },
      getEmail: async (userId) => {
        const { data } = await supabase.from('user_profiles').select('email').eq('id', userId).maybeSingle()
        return data?.email ?? null
      },
      sendEmail: (params) => sendAnnualRenewalReminderEmail(params),
      logSent: ({ userId, email, key }) => logPurge(supabase, { kind: REMINDER_LOG_KIND, user_id: userId, email, reason: key }),
    })
    annualReminders = { sent: report.sent.length, skipped: report.skipped, errors: report.errors }
    if (report.errors.length) console.error('[Cron cleanup] Rappels annuels en erreur:', report.errors)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    annualReminders.errors.push(msg)
    console.error('[Cron cleanup] Rappels annuels impossibles:', msg)
  }

  const count = (action: string) => purge?.reports.filter((r) => r.action === action).length ?? 0
  const summary = `repaired=${repair?.repaired.length ?? 0} mode=${mode} evaluated=${purge?.evaluated ?? 0} warned=${count('warned')} dry_run=${count('dry-run')} purged=${count('purged')} skipped=${count('skipped')} failed=${count('failed')} annual_reminders=${annualReminders.sent}`
  console.log(`[Cron cleanup] Done: ${summary}`)

  // Ligne de résumé pour l'audit
  await logPurge(supabase, {
    kind: 'summary',
    files_deleted: purge?.reports.reduce((s, r) => s + (r.action === 'purged' ? r.files ?? 0 : 0), 0) ?? 0,
    reason: summary,
    error: purgeError ?? purge?.stoppedOnError ?? null,
  })

  return NextResponse.json({
    success: !purgeError && !purge?.stoppedOnError,
    mode,
    purge,
    purgeError,
    repair,
    repairError,
    annualReminders,
  })
}
