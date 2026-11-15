// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// À Demi-Mot — projections de l'état privé vers chaque rôle.
// Public et téléphones : jamais la solution non dévoilée, ni l'ordre futur, ni la banque.

import type { CaptainInfo, PhoneView, RegieView } from './view'
import type { PhoneStatus, PublicCell, PublicTeam, PublicView } from './view'
import { hiddenCount, topTie } from './engine'
import type { GameState } from './types'

export interface ProjectionContext {
  now: number
  connectedTeamIds: Set<string>
  joinUrl: string
}

function teamsOf(s: GameState, ctx: ProjectionContext): PublicTeam[] {
  const blocked = s.round && s.round.status !== 'resolved' ? s.round.blocked : []
  return s.teams.map((t) => ({ id: t.id, name: t.name, color: t.color, score: t.score, connected: ctx.connectedTeamIds.has(t.id), blocked: blocked.includes(t.id) }))
}

export function publicView(s: GameState, ctx: ProjectionContext): PublicView {
  const r = s.round
  let phase: PublicView['phase'] = 'waiting'
  if (s.phase === 'podium') phase = 'podium'
  else if (s.phase === 'final_intro') phase = 'final_intro'
  else if (s.phase === 'end_tie') phase = 'resolved'
  else if (s.phase === 'round' && r) phase = r.status
  const tie = s.phase === 'end_tie' || s.phase === 'podium' ? topTie(s.teams) : null
  return {
    v: s.v,
    serverNow: ctx.now,
    phase,
    display: s.display,
    code: s.code,
    joinUrl: ctx.joinUrl,
    theme: s.settings.theme,
    teams: teamsOf(s, ctx),
    round:
      r && (s.phase === 'round' || s.phase === 'end_tie')
        ? {
            key: r.key,
            number: r.number,
            total: r.total,
            category: r.puzzle.category,
            mode: r.mode,
            isFinal: r.isFinal,
            isTiebreak: r.isTiebreak,
            points: r.points,
            // La solution ne sort que lettre par lettre, au fil des révélations.
            cells: r.cells.map((c, i): PublicCell => ({ kind: c.kind, ch: c.kind !== 'letter' || r.revealed[i] ? c.ch : null })),
            hiddenCount: hiddenCount(r),
            lastRevealed: r.lastRevealed,
            buzz: r.buzz ? { teamId: r.buzz.teamId, deadline: r.buzz.deadline, totalMs: r.buzz.totalMs } : null,
            turn: r.turnTeamId && (r.status === 'turn' || (r.status === 'paused' && r.paused?.from === 'turn')) ? { teamId: r.turnTeamId, deadline: r.turnDeadline, totalMs: s.settings.turnMs } : null,
            finalWindowMs: s.settings.finalWindowMs,
            finalWindowEndsAt: r.finalWindowEndsAt,
            pausedFrom: r.paused?.from ?? null,
            letters: r.letters,
            outcome: r.outcome,
            solutionShown: r.solutionShown,
          }
        : null,
    finale: s.plan.finale.length || s.settings.finale.enabled ? { base: s.settings.finale.base, bonusPerHidden: s.settings.finale.bonusPerHidden, puzzles: s.plan.finale.length || s.settings.finale.puzzles } : null,
    tie: tie ? { teamIds: tie } : null,
  }
}

/**
 * Prochaine échéance du moteur (lettre à révéler, fin de la dernière chance,
 * du temps de réponse ou d'un tour) : la régie fait avancer la partie à
 * cette heure-là (commande « tick »). Régie seulement.
 */
export function nextDueAt(s: GameState): number | null {
  const r = s.round
  if (!r || s.phase !== 'round') return null
  if (r.status === 'revealing') return r.nextRevealAt
  if (r.status === 'final_window') return r.finalWindowEndsAt
  if (r.status === 'answering') return r.buzz?.deadline ?? null
  if (r.status === 'turn') return r.turnDeadline
  return null
}

export function regieView(s: GameState, ctx: ProjectionContext & { captains: CaptainInfo[]; connections: RegieView['connections'] }): RegieView {
  const r = s.round
  const list = s.stage === 'finale' ? s.plan.finale : s.stage === 'main' ? s.plan.puzzles : []
  const nextUp = s.phase === 'round' || s.phase === 'waiting' ? list.slice(Math.max(0, s.roundIndex + 1), s.roundIndex + 4).map((p, k) => ({ category: p.category, solution: p.solution, mode: (s.stage === 'main' && s.roundIndex + 1 + k >= s.plan.puzzles.length - Math.min(s.settings.lettersRounds, s.plan.puzzles.length) ? 'letters' : 'reveal') as 'reveal' | 'letters' })) : []
  const snap = s.undo.length && r && s.undo[s.undo.length - 1].round.key === r.key ? s.undo[s.undo.length - 1].label : null
  const hiddenAtBuzz = r?.buzz?.hiddenAtBuzz ?? null
  return {
    v: s.v,
    public: publicView(s, ctx),
    private: {
      solution: r?.puzzle.solution ?? null,
      variants: r?.puzzle.variants ?? [],
      difficulty: r?.puzzle.difficulty ?? null,
      nextUp,
      hiddenAtBuzz,
      buzzWindowId: r?.buzz?.windowId ?? null,
      potentialPoints: r ? (r.isFinal ? s.settings.finale.base + s.settings.finale.bonusPerHidden * (hiddenAtBuzz ?? hiddenCount(r)) : r.points) : null,
      nextDueAt: nextDueAt(s),
    },
    phase: s.phase,
    stage: s.stage,
    settings: s.settings,
    captains: ctx.captains,
    undo: snap,
    log: s.log.slice(-60),
    connections: ctx.connections,
  }
}

export function phoneView(s: GameState, teamId: string | null, ctx: ProjectionContext & { takenTeamIds: string[]; revoked?: boolean }): PhoneView {
  const teams = teamsOf(s, ctx)
  const team = teamId ? (teams.find((t) => t.id === teamId) ?? null) : null
  const r = s.round
  const pub = publicView(s, ctx)
  let status: PhoneStatus = 'waiting'
  let otherTeamName: string | undefined
  let windowId: number | null = null
  let deadline: number | null = null
  if (ctx.revoked) status = 'revoked'
  else if (!team) status = 'choose_team'
  else if (s.phase === 'round' && r) {
    if (r.mode === 'letters') {
      if ((r.status === 'turn' || (r.status === 'paused' && r.paused?.from === 'turn')) && r.turnTeamId === team.id) {
        status = 'letters_turn'
        deadline = r.turnDeadline
      }
    } else if (r.blocked.includes(team.id) && r.status !== 'resolved') status = 'blocked'
    else if (r.status === 'revealing' || r.status === 'final_window') {
      status = 'open'
      windowId = r.windowId
    } else if (r.status === 'answering' && r.buzz) {
      if (r.buzz.teamId === team.id) {
        status = 'accepted'
        deadline = r.buzz.deadline
      } else {
        status = 'too_late'
        otherTeamName = s.teams.find((t) => t.id === r.buzz!.teamId)?.name
      }
    } else if (r.status === 'paused' && r.buzz?.teamId === team.id) status = 'accepted'
  }
  return { v: s.v, serverNow: ctx.now, code: s.code, status, team, teams, takenTeamIds: ctx.takenTeamIds, otherTeamName, windowId, deadline, phase: pub.phase, category: pub.round?.category ?? null }
}
