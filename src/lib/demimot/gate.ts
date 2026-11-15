// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot - la porte des buzzers, entre le moteur (serveur) et la base.
// Le buzz est décidé en base (demimot_buzz, sous verrou) ; le moteur, lui,
// déroule l'énigme. Ce module traduit l'un vers l'autre, sans dépendance
// serveur : il est aussi utilisé par l'écran et les téléphones.

import { apply, hiddenCount, tick } from './engine'
import type { GameState } from './types'
import type { PhoneStatus, PublicView } from './view'

export interface GateState {
  state: 'closed' | 'open' | 'buzzed'
  window: number
  blocked: string[]
  /** Heure exacte (ISO) au-delà de laquelle un buzz est refusé, même porte ouverte. */
  until: string | null
  answerMs: number
  teamId: string | null
  /** Heure du buzz (ISO, horloge de la base). */
  at: string | null
}

/** État public tel que renvoyé par demimot_public_state (et diffusé sur le canal). */
export interface DemiMotPublicState {
  active: boolean
  v?: number
  gameId?: string
  view?: PublicView
  gate?: GateState & { teamName: string | null }
  paused?: boolean
  serverNow: string
}

const iso = (ms: number) => new Date(ms).toISOString()

/**
 * Fin prévue des « derniers instants » : toutes les lettres cachées restantes
 * révélées au rythme réglé, puis la fenêtre finale. C'est l'heure limite d'un
 * buzz pour cette fenêtre (la régie peut prendre du retard sur la cadence ;
 * la porte, elle, se ferme à l'heure).
 */
function closingTime(s: GameState): number | null {
  const r = s.round
  if (!r) return null
  if (r.status === 'final_window') return r.finalWindowEndsAt
  if (r.status === 'revealing' && r.nextRevealAt !== null) {
    const remaining = hiddenCount(r)
    if (remaining === 0) return r.nextRevealAt + s.settings.finalWindowMs
    return r.nextRevealAt + (remaining - 1) * s.settings.revealIntervalMs + s.settings.finalWindowMs
  }
  return null
}

/** Porte des buzzers correspondant à un état du moteur. */
export function gateOf(s: GameState): GateState {
  const r = s.round
  const base = { blocked: [] as string[], until: null, answerMs: s.settings.answerMs, teamId: null, at: null }
  if (!r || s.phase !== 'round') return { ...base, state: 'closed', window: r?.windowId ?? 0 }
  if (r.status === 'answering' && r.buzz) {
    return { ...base, state: 'buzzed', window: r.buzz.windowId, blocked: [...r.blocked], teamId: r.buzz.teamId, at: iso(r.buzz.at) }
  }
  if (r.mode === 'reveal' && (r.status === 'revealing' || r.status === 'final_window')) {
    const until = closingTime(s)
    return { ...base, state: 'open', window: r.windowId, blocked: [...r.blocked], until: until === null ? null : iso(until) }
  }
  return { ...base, state: 'closed', window: r.windowId, blocked: [...r.blocked] }
}

export interface PendingBuzz {
  teamId: string
  window: number
  at: string
}

/**
 * Intègre au moteur un buzz accepté par la base mais pas encore pris en
 * compte. Les échéances sont d'abord avancées jusqu'à l'heure EXACTE du buzz :
 * aucune lettre prévue après le buzz n'est révélée. Renvoie l'état inchangé si
 * le buzz est déjà intégré ; `ok: false` si le moteur le refuse (fenêtre close
 * entre-temps), la porte sera alors refermée par l'enregistrement suivant.
 */
export function foldBuzz(s: GameState, buzz: PendingBuzz): { state: GameState; ok: boolean } {
  const r = s.round
  if (r?.buzz && r.buzz.windowId === buzz.window && r.buzz.teamId === buzz.teamId) return { state: s, ok: true }
  const at = Date.parse(buzz.at)
  if (!Number.isFinite(at)) return { state: s, ok: false }
  const advanced = tick(s, at).state
  const res = apply(advanced, { type: 'buzz', teamId: buzz.teamId, windowId: buzz.window }, at)
  return res.ok ? { state: res.state, ok: true } : { state: advanced, ok: false }
}

/**
 * État du téléphone d'un capitaine, calculé à partir de l'état public
 * (mêmes règles que la vue téléphone du prototype). La porte (gate) prime :
 * l'écran d'un buzz s'affiche avant même que le moteur l'ait intégré.
 */
export function phoneStatus(state: DemiMotPublicState | null, teamId: string | null): PhoneStatus {
  if (!state?.active || !state.view) return 'waiting'
  if (!teamId) return 'choose_team'
  const view = state.view
  const team = view.teams.find((t) => t.id === teamId)
  if (!team) return 'choose_team'
  const r = view.round
  const gate = state.gate
  if (state.paused || !r || view.phase === 'paused') {
    if (gate?.state === 'buzzed' && gate.teamId === teamId) return 'accepted'
    return 'waiting'
  }
  if (r.mode === 'letters') return r.turn?.teamId === teamId ? 'letters_turn' : 'waiting'
  if (gate?.state === 'buzzed') return gate.teamId === teamId ? 'accepted' : 'too_late'
  if (team.blocked || gate?.blocked.includes(teamId)) return view.phase === 'resolved' ? 'waiting' : 'blocked'
  if (gate?.state === 'open') return 'open'
  if (r.buzz) return r.buzz.teamId === teamId ? 'accepted' : 'too_late'
  return 'waiting'
}
