// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Numéros de fenêtre de buzz : la base n'accepte qu'UN buzz par (partie, numéro)
// (UNIQUE (game_id, window_no) dans demimot_buzzes). Le numéro ne doit donc jamais
// revenir en arrière pendant une partie, ni après « Nouvelle partie » (même game_id).
import { describe, expect, it } from 'vitest'
import { apply, createGame, type Command } from '../engine'
import { DEMIMOT_SENT_TIMEOUT_MS, foldBuzz, gateOf, isSending } from '../gate'
import type { GameState, Puzzle } from '../types'

const T0 = 1_700_000_000_000
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const pz = (id: string, solution: string): Puzzle => ({ id, category: 'Test', solution, variants: [], difficulty: 'facile', points: null, active: true })

function ok(s: GameState, cmd: Command, now: number): GameState {
  const r = apply(s, cmd, now)
  if (!r.ok) throw new Error(`${cmd.type}: ${r.message}`)
  return r.state
}

/** Reproduit la base : un seul buzz par numéro de fenêtre sur toute la partie. */
function makeDb() {
  const used = new Set<number>()
  return {
    used,
    /** Buzz d'une équipe à l'instant `at` : « taken » si le numéro a déjà servi. */
    buzz(s: GameState, teamId: string, at: number): GameState {
      const g = gateOf(s)
      expect(g.state, 'la porte doit être ouverte').toBe('open')
      if (used.has(g.window)) throw new Error(`taken : fenêtre ${g.window} déjà utilisée dans cette partie`)
      used.add(g.window)
      const res = foldBuzz(s, { teamId, window: g.window, at: new Date(at).toISOString() })
      expect(res.ok).toBe(true)
      return res.state
    },
  }
}

function setup(): GameState {
  let s = createGame('ZQ9X', [], 1, T0, { lettersRounds: 0, revealIntervalMs: 1000, finalWindowMs: 5000, answerMs: 8000, finale: { enabled: true, puzzles: 2, base: 100, bonusPerHidden: 10 } })
  s = ok(s, { type: 'setTeams', teams: [{ id: A, name: 'Les Zincs', color: '#AA3355' }, { id: B, name: 'Le Comptoir', color: '#3355AA' }] }, T0)
  return ok(s, { type: 'startGame', puzzles: [pz('a', 'Café crème'), pz('b', 'Pain perdu')], finale: [pz('f1', 'Tarte tatin'), pz('f2', 'Crème brûlée')] }, T0)
}

const judge = (s: GameState, correct: boolean, now: number) => ok(s, { type: 'judge', correct, windowId: s.round!.buzz!.windowId }, now)
const next = (s: GameState, now: number) => ok(s, { type: 'next', roundKey: s.round!.key }, now)

describe('numéros de fenêtre de buzz sur toute la partie', () => {
  it('la même équipe buzze à l’énigme 1 puis en finale : jamais « taken »', () => {
    const db = makeDb()
    let t = T0
    let s = setup()
    // Énigme 1 : A buzze et gagne.
    s = ok(s, { type: 'startReveal' }, (t += 100))
    s = db.buzz(s, A, (t += 1500))
    s = judge(s, true, (t += 500))
    // Énigme 2 : A buzze, se trompe ; B buzze et gagne.
    s = next(s, (t += 500))
    s = ok(s, { type: 'startReveal' }, (t += 100))
    s = db.buzz(s, A, (t += 1500))
    s = judge(s, false, (t += 500))
    s = db.buzz(s, B, (t += 1200))
    s = judge(s, true, (t += 500))
    // Finale : annonce, puis A buzze aux deux énigmes.
    s = next(s, (t += 500))
    expect(s.phase).toBe('final_intro')
    s = ok(s, { type: 'startFinale' }, (t += 500))
    s = ok(s, { type: 'startReveal' }, (t += 100))
    s = db.buzz(s, A, (t += 1500))
    s = judge(s, true, (t += 500))
    s = next(s, (t += 500))
    s = ok(s, { type: 'startReveal' }, (t += 100))
    s = db.buzz(s, A, (t += 1500))
    s = judge(s, true, (t += 500))
    expect(db.used.size).toBe(5)
    s = next(s, (t += 500))
    expect(s.phase).toBe('podium')
  })

  it('les numéros continuent après « Nouvelle partie » (même partie en base)', () => {
    const db = makeDb()
    let t = T0
    let s = setup()
    s = ok(s, { type: 'startReveal' }, (t += 100))
    s = db.buzz(s, A, (t += 1500))
    s = judge(s, true, (t += 500))
    s = ok(s, { type: 'finish' }, (t += 500))
    s = ok(s, { type: 'reset' }, (t += 500))
    s = ok(s, { type: 'startGame', puzzles: [pz('c', 'Pot au feu')], finale: [] }, (t += 500))
    s = ok(s, { type: 'startReveal' }, (t += 100))
    db.buzz(s, A, (t += 1500))
    expect(db.used.size).toBe(2)
  })

  it('un état enregistré avant le correctif (sans plancher) reprend sans réutiliser un numéro', () => {
    let s = setup()
    s = ok(s, { type: 'startReveal' }, T0 + 100)
    const legacy = structuredClone(s) as GameState & { windowFloor?: number }
    delete legacy.windowFloor
    legacy.round!.windowId = 7
    legacy.round!.status = 'resolved'
    const after = ok(legacy, { type: 'next', roundKey: legacy.round!.key }, T0 + 1000)
    expect(after.round!.windowId).toBeGreaterThan(7)
  })
})

describe('téléphone : « Envoi… » ne reste jamais figé', () => {
  const sent = { roundKey: 'main-1-1', window: 3, at: T0 }
  it('vaut pour la même énigme et la même fenêtre, juste après l’envoi', () => {
    expect(isSending(sent, 3, 'main-1-1', T0 + 200)).toBe(true)
  })
  it('ne vaut plus à l’énigme suivante, même si le numéro de fenêtre coïncidait', () => {
    expect(isSending(sent, 3, 'main-2-2', T0 + 200)).toBe(false)
  })
  it('ne vaut plus pour une autre fenêtre', () => {
    expect(isSending(sent, 4, 'main-1-1', T0 + 200)).toBe(false)
  })
  it('rend la main au bouton si le serveur ne répond pas', () => {
    expect(isSending(sent, 3, 'main-1-1', T0 + DEMIMOT_SENT_TIMEOUT_MS)).toBe(false)
  })
  it('rien d’envoyé → jamais « Envoi… »', () => {
    expect(isSending(null, 3, 'main-1-1', T0)).toBe(false)
  })
})
