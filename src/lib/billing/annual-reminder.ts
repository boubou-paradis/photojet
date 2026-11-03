// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Rappel envoyé 30 jours avant le renouvellement d'un abonnement ANNUEL
// (jamais pour le mensuel). Lancé par la tâche quotidienne cleanup-expired.
//
// • La vérité vient de Stripe : formule annuelle, abonnement actif, pas de
//   résiliation programmée, date de renouvellement.
// • Un seul envoi par période : chaque envoi est noté dans purge_log
//   (kind « annual_reminder », reason = date de renouvellement). Si la tâche
//   saute un jour, le rappel part le lendemain.
// • Accès externes injectés (tests avec faux Stripe / fausse base).

export const REMINDER_DAYS_BEFORE = 30
/** En dessous de ce délai, plus de rappel (trop tard pour être utile). */
export const REMINDER_MIN_DAYS_BEFORE = 3
export const REMINDER_LOG_KIND = 'annual_reminder'

export interface ReminderCandidate {
  user_id: string
  stripe_subscription_id: string
}

export interface StripeSubscriptionSummary {
  status: string
  cancelAtPeriodEnd: boolean
  interval: string | null
  unitAmountCents: number | null
  /** Fin de la période en cours (secondes Unix) */
  periodEnd: number | null
}

export interface ReminderDeps {
  /** Abonnements actifs avec abonnement Stripe dont la fin tombe dans [from, to]. */
  listCandidates: (fromIso: string, toIso: string) => Promise<ReminderCandidate[]>
  isOwner: (userId: string) => Promise<boolean>
  retrieveSubscription: (id: string) => Promise<StripeSubscriptionSummary>
  alreadySent: (userId: string, key: string) => Promise<boolean>
  getEmail: (userId: string) => Promise<string | null>
  sendEmail: (params: { to: string; renewalDate: Date; amountEur: number }) => Promise<{ success: boolean }>
  logSent: (params: { userId: string; email: string; key: string }) => Promise<void>
}

export interface ReminderReport {
  sent: string[]
  skipped: number
  errors: string[]
}

const DAY = 24 * 60 * 60 * 1000

export async function runAnnualRenewalReminders(now: Date, deps: ReminderDeps): Promise<ReminderReport> {
  const report: ReminderReport = { sent: [], skipped: 0, errors: [] }
  const from = new Date(now.getTime() + REMINDER_MIN_DAYS_BEFORE * DAY)
  const to = new Date(now.getTime() + REMINDER_DAYS_BEFORE * DAY)
  const candidates = await deps.listCandidates(from.toISOString(), to.toISOString())

  for (const c of candidates) {
    try {
      if (await deps.isOwner(c.user_id)) { report.skipped++; continue }
      const sub = await deps.retrieveSubscription(c.stripe_subscription_id)
      if (sub.interval !== 'year' || sub.status !== 'active' || sub.cancelAtPeriodEnd || !sub.periodEnd) {
        report.skipped++
        continue
      }
      const renewalDate = new Date(sub.periodEnd * 1000)
      // Date Stripe hors fenêtre (base en retard) : on attend.
      if (renewalDate < from || renewalDate > to) { report.skipped++; continue }
      const key = `renouvellement=${renewalDate.toISOString().slice(0, 10)}`
      if (await deps.alreadySent(c.user_id, key)) { report.skipped++; continue }
      const email = await deps.getEmail(c.user_id)
      if (!email) { report.skipped++; continue }
      const amountEur = typeof sub.unitAmountCents === 'number' ? sub.unitAmountCents / 100 : 299
      const result = await deps.sendEmail({ to: email, renewalDate, amountEur })
      if (!result.success) { report.errors.push(`${c.user_id}: envoi refusé`); continue }
      await deps.logSent({ userId: c.user_id, email, key })
      report.sent.push(email)
    } catch (e) {
      report.errors.push(`${c.user_id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return report
}
