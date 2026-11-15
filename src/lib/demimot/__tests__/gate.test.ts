// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it } from 'vitest'
import { apply, createGame, tick, type Command } from '../engine'
import { foldBuzz, gateOf, phoneStatus, type DemiMotPublicState } from '../gate'
import { publicView } from '../project'
import type { GameState, Puzzle } from '../types'
import { parseAdminRequest, parseJoinRequest } from '../validation'

const T0 = 1_700_000_000_000
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const S = '33333333-3333-4333-8333-333333333333'
const pz = (id: string, solution: string): Puzzle => ({ id, category: 'Test', solution, variants: [], difficulty: 'facile', points: null, active: true })

function ok(s: GameState, cmd: Command, now: number): GameState {
  const r = apply(s, cmd, now)
  if (!r.ok) throw new Error(`${cmd.type}: ${r.message}`)
  return r.state
}

function started(): GameState {
  let s = createGame('ZQ9X', [], 1, T0, { lettersRounds: 0, revealIntervalMs: 1000, finalWindowMs: 5000, answerMs: 8000, finale: { enabled: false, puzzles: 3, base: 100, bonusPerHidden: 10 } })
  s = ok(s, { type: 'setTeams', teams: [{ id: A, name: 'Les Zincs', color: '#AA3355' }, { id: B, name: 'Le Comptoir', color: '#3355AA' }] }, T0)
  s = ok(s, { type: 'startGame', puzzles: [pz('a', 'Café crème')], finale: [] }, T0)
  return ok(s, { type: 'startReveal' }, T0)
}

const view = (s: GameState) => publicView(s, { now: T0, connectedTeamIds: new Set(), joinUrl: 'x' })
const pub = (s: GameState, extra: Partial<DemiMotPublicState> = {}): DemiMotPublicState => ({
  active: true,
  view: view(s),
  gate: { ...gateOf(s), teamName: null },
  paused: false,
  serverNow: new Date(T0).toISOString(),
  ...extra,
})

describe('équipes', () => {
  it('garde les identifiants fournis par le serveur (uuid de demimot_teams)', () => {
    const s = started()
    expect(s.teams.map((t) => t.id)).toEqual([A, B])
  })
})

describe('porte des buzzers', () => {
  it('fermée avant le dévoilement, ouverte pendant, avec une heure de fermeture exacte', () => {
    let s = createGame('ZQ9X', [], 1, T0, { lettersRounds: 0 })
    expect(gateOf(s).state).toBe('closed')
    s = started()
    const g = gateOf(s)
    expect(g.state).toBe('open')
    // 9 lettres (CAFÉCRÈME) : 1re à T0+1 s, dernière à T0+9 s, puis 5 s de derniers instants.
    expect(g.until).toBe(new Date(T0 + 9000 + 5000).toISOString())
  })

  it('intègre un buzz à son heure exacte : aucune lettre prévue après le buzz', () => {
    const s = started()
    const g = gateOf(s)
    const { state, ok: accepted } = foldBuzz(s, { teamId: B, window: g.window, at: new Date(T0 + 2500).toISOString() })
    expect(accepted).toBe(true)
    const r = state.round!
    expect(r.status).toBe('answering')
    expect(r.buzz?.teamId).toBe(B)
    expect(r.revealed.filter((x, i) => x && r.cells[i].kind === 'letter').length).toBe(2)
    // Même buzz intégré deux fois : rien ne change.
    expect(foldBuzz(state, { teamId: B, window: g.window, at: new Date(T0 + 2500).toISOString() }).state).toBe(state)
    expect(gateOf(state)).toMatchObject({ state: 'buzzed', teamId: B, window: g.window })
  })

  it('refuse un buzz d’une fenêtre périmée', () => {
    const s = started()
    expect(foldBuzz(s, { teamId: A, window: gateOf(s).window + 5, at: new Date(T0 + 1000).toISOString() }).ok).toBe(false)
  })

  it('après une mauvaise réponse, nouvelle fenêtre et équipe bloquée', () => {
    const s0 = started()
    const g = gateOf(s0)
    let s = foldBuzz(s0, { teamId: A, window: g.window, at: new Date(T0 + 1500).toISOString() }).state
    s = ok(s, { type: 'judge', correct: false, windowId: g.window }, T0 + 3000)
    const g2 = gateOf(s)
    expect(g2.state).toBe('open')
    expect(g2.window).toBeGreaterThan(g.window)
    expect(g2.blocked).toEqual([A])
  })

  it('fermée une fois la fenêtre finale écoulée', () => {
    const s = tick(started(), T0 + 60_000).state
    expect(s.round?.status).toBe('resolved')
    expect(gateOf(s).state).toBe('closed')
  })
})

describe('téléphone du capitaine', () => {
  it('suit la porte : ouvert, la main, trop tard, bloqué', () => {
    const s0 = started()
    expect(phoneStatus(pub(s0), A)).toBe('open')
    expect(phoneStatus(pub(s0), null)).toBe('choose_team')
    // Buzz accepté en base, pas encore intégré par le moteur : la porte prime.
    const buzzed = pub(s0, { gate: { ...gateOf(s0), state: 'buzzed', teamId: B, at: new Date(T0).toISOString(), teamName: 'Le Comptoir' } })
    expect(phoneStatus(buzzed, B)).toBe('accepted')
    expect(phoneStatus(buzzed, A)).toBe('too_late')
    let s = foldBuzz(s0, { teamId: A, window: gateOf(s0).window, at: new Date(T0 + 1500).toISOString() }).state
    s = ok(s, { type: 'judge', correct: false, windowId: gateOf(s0).window }, T0 + 3000)
    expect(phoneStatus(pub(s), A)).toBe('blocked')
    expect(phoneStatus(pub(s), B)).toBe('open')
    expect(phoneStatus(pub(s, { paused: true }), B)).toBe('waiting')
  })

  it('la vue publique ne contient jamais la solution avant sa révélation', () => {
    const v = JSON.stringify(view(started()))
    expect(v).not.toContain('Café')
    expect(v).not.toContain('crème')
  })

  it('la vue publique ne contient pas l’identifiant de l’énigme (tiré de la solution)', () => {
    let s = createGame('ZQ9X', [], 1, T0, { lettersRounds: 0 })
    s = ok(s, { type: 'setTeams', teams: [{ id: A, name: 'Les Zincs', color: '#AA3355' }, { id: B, name: 'Le Comptoir', color: '#3355AA' }] }, T0)
    s = ok(s, { type: 'startGame', puzzles: [pz('se-tourner-les-pouces', 'Se tourner les pouces')], finale: [] }, T0)
    const v = JSON.stringify(view(s))
    expect(v).not.toContain('pouces')
    expect(v).not.toContain('tourner')
  })
})

describe('validation des requêtes', () => {
  it('n’accepte que des commandes connues, jamais d’énigme venant du navigateur', () => {
    expect(parseAdminRequest({ sessionId: S, action: 'command', command: { type: 'judge', correct: true, windowId: 3 } }).ok).toBe(true)
    expect(parseAdminRequest({ sessionId: S, action: 'command', command: { type: 'startGame', puzzles: [pz('x', 'Triche')] } })).toMatchObject({ ok: true, value: { command: { type: 'startGame' } } })
    const r = parseAdminRequest({ sessionId: S, action: 'command', command: { type: 'startGame', puzzles: [pz('x', 'Triche')] } })
    expect(r.ok && 'command' in r.value && 'puzzles' in r.value.command).toBe(false)
    expect(parseAdminRequest({ sessionId: S, action: 'command', command: { type: 'buzz', teamId: A, windowId: 1 } }).ok).toBe(false)
    expect(parseAdminRequest({ sessionId: S, action: 'command', command: { type: 'setTeams', teams: [{ name: 'X', color: 'red' }] } }).ok).toBe(false)
    expect(parseAdminRequest({ sessionId: 'pas-un-uuid', action: 'snapshot' }).ok).toBe(false)
  })

  it('arrivée d’un capitaine : code et équipe obligatoires', () => {
    expect(parseJoinRequest({ code: 'zq9x', teamId: A })).toMatchObject({ ok: true, value: { code: 'ZQ9X' } })
    expect(parseJoinRequest({ code: 'ZQ9X' }).ok).toBe(false)
  })
})
