'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Régie AnimaBingo : la suite de la partie, À LA PLACE du bouton TIRER.
// Gagnant validé → « Continuer · lot 2 / 5 » ou « Passer à la DOUBLE QUINE »
// (gros bouton toujours visible), partie finie → « Nouvelle partie ».
// Dessous : passer l'étape ou sauter au carton plein, avec confirmation.
// Chaque commande envoie l'étape affichée (expect) : un double clic ou un
// renvoi après coupure ne saute jamais deux étapes.

import { useEffect, useState } from 'react'
import { PHASE_LABELS } from '@/lib/bingo/constants'
import { lotInfo, nextPhase } from '@/lib/bingo/display'
import type { BingoPublicState, Phase } from '@/lib/bingo/types'
import type { AdminBody, AdminResult } from './api'
import type { ConfirmRequest } from './ConfirmDialog'

type Live = Extract<BingoPublicState, { active: true }>
type Run = (b: AdminBody, o?: { quiet?: boolean; key?: string }) => Promise<AdminResult | null>

const TO: Record<Phase, string> = { quine: 'À LA QUINE', double: 'À LA DOUBLE QUINE', plein: 'AU CARTON PLEIN' }
const to = (p: Phase) => TO[p].toLowerCase()

/** Passage automatique : 8 s après le dernier gagnant validé (même délai que la base). */
export const AUTO_ADVANCE_MS = 8000

/** Gros bouton qui remplace TIRER, ou null quand on tire normalement. */
export function StepButton({ live, held, busy, run, offset, onNewGame }: {
  live: Live
  held: boolean
  busy: string | null
  run: Run
  /** Heure serveur − heure du PC (ms). */
  offset: number
  onNewGame: () => void
}) {
  const lot = lotInfo(live)
  const next = nextPhase(live)
  const [now, setNow] = useState(() => Date.now())
  const auto = live.status === 'celebrating' && lot.done && live.advance === 'auto' && live.pending === 0
  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [auto])

  if (live.status === 'finished') {
    return (
      <button className="draw step" onClick={onNewGame} disabled={held || busy !== null} data-testid="step-new-game" aria-label="Nouvelle partie avec les mêmes cartons">
        <div><b>NOUVELLE</b><b>PARTIE</b><small>MÊMES CARTONS</small></div>
      </button>
    )
  }
  if (live.status !== 'celebrating') return null
  const pending = live.pending > 0
  if (!lot.done) {
    return (
      <button className="draw step" onClick={() => void run({ action: 'resume' }, { key: 'resume' })} disabled={held || busy !== null || pending} data-testid="step-resume">
        <div><b>CONTINUER</b><small>LOT {Math.min(lot.n, lot.used + 1)} / {lot.n}</small></div>
      </button>
    )
  }
  const winAt = live.lastWinAt ? Date.parse(live.lastWinAt) - offset : now
  const secLeft = auto ? Math.max(0, Math.ceil((winAt + AUTO_ADVANCE_MS - now) / 1000)) : null
  return (
    <button
      className="draw step go"
      onClick={() => void run({ action: 'next_phase', expect: live.phaseIndex }, { key: 'next' })}
      disabled={held || busy !== null || pending}
      data-testid="step-next"
    >
      <div>
        <small>{next ? 'PASSER' : 'TERMINER'}</small>
        <b>{next ? TO[next] : 'LA PARTIE'}</b>
        {secLeft !== null && <small data-testid="step-auto">AUTO DANS {secLeft} S</small>}
      </div>
    </button>
  )
}

/** Petites commandes sous le bouton : étape suivante sans attendre, saut au carton plein. */
export function StepLinks({ live, held, busy, run, askConfirm }: {
  live: Live
  held: boolean
  busy: string | null
  run: Run
  askConfirm: (r: ConfirmRequest) => void
}) {
  if (held || !['running', 'checking', 'celebrating'].includes(live.status) || live.phaseIndex >= live.phases.length) return null
  const lot = lotInfo(live)
  const cur = live.phases[live.phaseIndex]
  const next = nextPhase(live)
  const last = live.phases[live.phases.length - 1]
  const canJump = live.phaseIndex + 1 < live.phases.length - 1 || (!!next && !(live.status === 'celebrating' && lot.done))
  const expect = live.phaseIndex
  // Le gros bouton fait déjà « passer » quand l'étape est gagnée.
  const showSkip = !!next && !(live.status === 'celebrating' && lot.done) && live.phaseIndex + 1 < live.phases.length - 1
  if (!canJump && !showSkip) return null
  return (
    <div className="step-links">
      {showSkip && next && (
        <button
          className="btn sm ghost"
          disabled={busy !== null}
          data-testid="step-skip"
          onClick={() => askConfirm({
            title: `Passer ${to(next)} ?`,
            message: `La ${PHASE_LABELS[cur].toLowerCase()} s’arrête maintenant${lot.n > 1 ? ` (${lot.used} lot${lot.used > 1 ? 's' : ''} gagné${lot.used > 1 ? 's' : ''} sur ${lot.n})` : ''}.`,
            note: 'Les boules déjà sorties restent sorties. Les jetons des joueurs ne sont pas effacés.',
            check: `J’ai compris : on ne joue plus la ${PHASE_LABELS[cur].toLowerCase()}.`,
            confirm: `Passer ${to(next)}`,
            onConfirm: async () => { await run({ action: 'next_phase', expect }, { key: 'next' }) },
          })}
        >
          Passer {to(next)}
        </button>
      )}
      {canJump && (
        <button
          className="btn sm ghost"
          disabled={busy !== null}
          data-testid="step-jump"
          onClick={() => askConfirm({
            title: `Sauter ${to(last)} ?`,
            message: `Les étapes restantes avant le ${PHASE_LABELS[last].toLowerCase()} ne seront pas jouées.`,
            note: 'Les boules déjà sorties restent sorties. Les jetons des joueurs ne sont pas effacés.',
            check: `J’ai compris : on passe directement ${to(last)}.`,
            confirm: `Sauter ${to(last)}`,
            onConfirm: async () => { await run({ action: 'jump_final', expect }, { key: 'jump' }) },
          })}
        >
          Sauter {to(last)}
        </button>
      )}
    </div>
  )
}
