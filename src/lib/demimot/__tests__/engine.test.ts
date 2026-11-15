// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
import { describe, expect, it } from 'vitest'
import { apply, createGame, nextDeadline, permutation, restoreSafe, tick, type Command } from '../engine'
import { publicView } from '../project'
import type { GameState, Puzzle } from '../types'
import { normalizeForCompare, normalizeLetter } from '../text'

const T0 = 1_000_000
const pz = (id: string, solution: string, category = 'Test'): Puzzle => ({ id, category, solution, variants: [], difficulty: 'facile', points: null, active: true })
const teams = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Équipe ${i + 1}`, color: '#fff', score: 0 }))

function game(opts: { n?: number; puzzles?: Puzzle[]; finale?: Puzzle[]; letters?: number; finaleOn?: boolean } = {}) {
  let s = createGame('TEST', teams(opts.n ?? 3), 42, T0, { lettersRounds: opts.letters ?? 0, finale: { enabled: opts.finaleOn ?? false, puzzles: 3, base: 100, bonusPerHidden: 10 } })
  s = ok(s, { type: 'startGame', puzzles: opts.puzzles ?? [pz('a', 'Il pleut des cordes'), pz('b', 'Café crème')], finale: opts.finale ?? [] }, T0)
  return s
}
function ok(s: GameState, cmd: Command, now: number): GameState {
  const r = apply(s, cmd, now)
  if (!r.ok) throw new Error(`${cmd.type}: ${r.error} ${r.message}`)
  return r.state
}
function err(s: GameState, cmd: Command, now: number) {
  const r = apply(s, cmd, now)
  if (r.ok) throw new Error(`${cmd.type} aurait dû échouer`)
  return r.error
}
const at = (s: GameState, now: number) => tick(s, now).state

describe('texte et normalisation', () => {
  it('normalise casse et diacritiques des lettres proposées', () => {
    expect(normalizeLetter('é')).toBe('E')
    expect(normalizeLetter('Ç')).toBe('C')
    expect(normalizeLetter('ab')).toBeNull()
    expect(normalizeLetter('7')).toBeNull()
  })
  it('compare des phrases sans accents ni ponctuation', () => {
    expect(normalizeForCompare('L’œuf, c’est l’été !')).toBe(normalizeForCompare("l'oeuf c'est l'ete"))
  })
})

describe('Révélation', () => {
  it('permutation stable pour une graine donnée, et conservée dans la manche', () => {
    expect(permutation([1, 2, 3, 4, 5, 6], 7)).toEqual(permutation([1, 2, 3, 4, 5, 6], 7))
    const a = game()
    const b = game()
    expect(a.round!.order).toEqual(b.round!.order)
    expect([...a.round!.order].sort((x, y) => x - y)).toEqual(a.round!.cells.map((c, i) => (c.kind === 'letter' ? i : -1)).filter((i) => i >= 0))
  })
  it('révèle une seule position à la fois (pas toutes les occurrences) au rythme réglé', () => {
    let s = ok(game(), { type: 'startReveal' }, T0)
    expect(nextDeadline(s)).toBe(T0 + 1200)
    s = at(s, T0 + 1200)
    expect(s.round!.revealed.filter((v, i) => v && s.round!.cells[i].kind === 'letter').length).toBe(1)
    s = at(s, T0 + 3600 + 5) // rattrape deux échéances
    expect(s.round!.revealed.filter((v, i) => v && s.round!.cells[i].kind === 'letter').length).toBe(3)
  })
  it('premier buzz gagne, le second est refusé, la révélation est gelée', () => {
    let s = ok(game(), { type: 'startReveal' }, T0)
    const w = s.round!.windowId
    s = ok(s, { type: 'buzz', teamId: 't1', windowId: w }, T0 + 500)
    expect(err(s, { type: 'buzz', teamId: 't2', windowId: w }, T0 + 501)).toBe('taken')
    expect(s.round!.status).toBe('answering')
    expect(nextDeadline(s)).toBe(T0 + 500 + 8000)
  })
  it('mauvaise réponse : équipe bloquée, reprise sans file, ancien buzz refusé', () => {
    let s = ok(game(), { type: 'startReveal' }, T0)
    const w = s.round!.windowId
    s = ok(s, { type: 'buzz', teamId: 't1', windowId: w }, T0 + 500)
    s = ok(s, { type: 'judge', correct: false, windowId: w }, T0 + 2000)
    expect(s.round!.status).toBe('revealing')
    expect(s.round!.blocked).toEqual(['t1'])
    // Le délai restant avant la prochaine lettre est conservé (700 ms).
    expect(s.round!.nextRevealAt).toBe(T0 + 2000 + 700)
    expect(err(s, { type: 'buzz', teamId: 't2', windowId: w }, T0 + 2001)).toBe('stale')
    expect(err(s, { type: 'buzz', teamId: 't1', windowId: s.round!.windowId }, T0 + 2002)).toBe('blocked')
    s = ok(s, { type: 'buzz', teamId: 't2', windowId: s.round!.windowId }, T0 + 2003)
    expect(s.round!.buzz!.teamId).toBe('t2')
  })
  it('délai de réponse expiré = bloquée', () => {
    let s = ok(game(), { type: 'startReveal' }, T0)
    s = ok(s, { type: 'buzz', teamId: 't3', windowId: s.round!.windowId }, T0 + 100)
    s = at(s, T0 + 100 + 8000)
    expect(s.round!.blocked).toContain('t3')
    expect(s.round!.status).toBe('revealing')
  })
  it('points attribués une seule fois ; un double arbitrage est refusé', () => {
    let s = ok(game(), { type: 'startReveal' }, T0)
    const w = s.round!.windowId
    s = ok(s, { type: 'buzz', teamId: 't2', windowId: w }, T0 + 100)
    s = ok(s, { type: 'judge', correct: true, windowId: w }, T0 + 900)
    expect(s.teams.find((t) => t.id === 't2')!.score).toBe(100)
    expect(err(s, { type: 'judge', correct: true, windowId: w }, T0 + 901)).toBe('state')
    expect(s.round!.status).toBe('resolved')
    expect(s.round!.solutionShown).toBe(true)
  })
  it('annuler l’arbitrage restaure scores et manche (en pause)', () => {
    let s = ok(game(), { type: 'startReveal' }, T0)
    const w = s.round!.windowId
    s = ok(s, { type: 'buzz', teamId: 't2', windowId: w }, T0 + 100)
    s = ok(s, { type: 'judge', correct: true, windowId: w }, T0 + 900)
    s = ok(s, { type: 'undo' }, T0 + 1000)
    expect(s.teams.find((t) => t.id === 't2')!.score).toBe(0)
    expect(s.round!.status).toBe('paused')
    expect(s.round!.paused!.from).toBe('answering')
    s = ok(s, { type: 'resume' }, T0 + 2000)
    s = ok(s, { type: 'judge', correct: false, windowId: s.round!.buzz!.windowId }, T0 + 2500)
    expect(s.round!.blocked).toEqual(['t2'])
  })
  it('annuler le buzz : pas de blocage, nouvelle fenêtre', () => {
    let s = ok(game(), { type: 'startReveal' }, T0)
    const w = s.round!.windowId
    s = ok(s, { type: 'buzz', teamId: 't1', windowId: w }, T0 + 100)
    s = ok(s, { type: 'cancelBuzz', windowId: w }, T0 + 200)
    expect(s.round!.blocked).toEqual([])
    expect(s.round!.windowId).toBeGreaterThan(w)
    expect(err(s, { type: 'buzz', teamId: 't1', windowId: w }, T0 + 201)).toBe('stale')
  })
  it('toutes les équipes bloquées : fin sans gagnant', () => {
    let s = ok(game({ n: 2 }), { type: 'startReveal' }, T0)
    for (const id of ['t1', 't2']) {
      s = ok(s, { type: 'buzz', teamId: id, windowId: s.round!.windowId }, T0 + 100)
      s = ok(s, { type: 'judge', correct: false, windowId: s.round!.buzz!.windowId }, T0 + 200)
    }
    expect(s.round!.status).toBe('resolved')
    expect(s.round!.outcome).toEqual({ kind: 'none', reason: 'all_blocked' })
  })
  it('toutes les lettres révélées puis fenêtre finale : fin sans gagnant', () => {
    let s = ok(game({ puzzles: [pz('x', 'Oui')] }), { type: 'startReveal' }, T0)
    s = at(s, T0 + 1200 * 3)
    expect(s.round!.status).toBe('final_window')
    expect(s.round!.finalWindowEndsAt).toBe(T0 + 3600 + 5000)
    s = at(s, T0 + 3600 + 5000)
    expect(s.round!.outcome).toEqual({ kind: 'none', reason: 'time' })
  })
  it('pause fige les délais, la reprise les recalcule', () => {
    let s = ok(game(), { type: 'startReveal' }, T0)
    s = ok(s, { type: 'buzz', teamId: 't1', windowId: s.round!.windowId }, T0 + 100)
    s = ok(s, { type: 'pause' }, T0 + 3100) // 5 s restantes
    expect(nextDeadline(s)).toBeNull()
    s = at(s, T0 + 60000)
    expect(s.round!.status).toBe('paused')
    s = ok(s, { type: 'resume' }, T0 + 60000)
    expect(s.round!.buzz!.deadline).toBe(T0 + 65000)
  })
  it('n’attend pas : « Énigme suivante » exige une action explicite', () => {
    let s = ok(game(), { type: 'startReveal' }, T0)
    s = ok(s, { type: 'skip' }, T0 + 10)
    s = at(s, T0 + 999999)
    expect(s.round!.number).toBe(1)
    expect(err(s, { type: 'next', roundKey: 'autre' }, T0)).toBe('stale')
    s = ok(s, { type: 'next', roundKey: s.round!.key }, T0 + 20)
    expect(s.round!.number).toBe(2)
  })
  it('la vue publique ne contient jamais la solution non dévoilée', () => {
    const s = ok(game({ puzzles: [pz('s', 'Secret bien gardé')] }), { type: 'startReveal' }, T0)
    const json = JSON.stringify(publicView(s, { now: T0, connectedTeamIds: new Set(), joinUrl: '' }))
    expect(json).not.toContain('Secret')
    expect(json).not.toContain('gardé')
    expect(json).not.toContain('"order"')
  })
})

describe('Tour de lettres', () => {
  const lettersGame = () => ok(game({ puzzles: [pz('l', 'Été à Évian')], letters: 1 }), { type: 'startReveal' }, T0)
  it('révèle toutes les occurrences, accents compris, et garde la main', () => {
    let s = lettersGame()
    expect(s.round!.turnTeamId).toBe('t1')
    s = ok(s, { type: 'proposeLetter', letter: 'e' }, T0 + 10)
    // É, é (Été) et É (Évian) : trois positions
    expect(s.round!.letters[0]).toMatchObject({ letter: 'E', hits: 3 })
    expect(s.round!.turnTeamId).toBe('t1')
  })
  it('lettre absente : la main passe ; lettre déjà proposée refusée sans pénalité', () => {
    let s = lettersGame()
    s = ok(s, { type: 'proposeLetter', letter: 'z' }, T0 + 10)
    expect(s.round!.turnTeamId).toBe('t2')
    expect(err(s, { type: 'proposeLetter', letter: 'Z' }, T0 + 20)).toBe('already')
    expect(s.round!.turnTeamId).toBe('t2')
  })
  it('délai de tour expiré et mauvaise résolution passent la main ; bonne résolution termine', () => {
    let s = lettersGame()
    s = at(s, T0 + 20000)
    expect(s.round!.turnTeamId).toBe('t2')
    s = ok(s, { type: 'solveTurn', correct: false }, T0 + 20010)
    expect(s.round!.turnTeamId).toBe('t3')
    s = ok(s, { type: 'solveTurn', correct: true }, T0 + 20020)
    expect(s.teams.find((t) => t.id === 't3')!.score).toBe(100)
    expect(s.round!.status).toBe('resolved')
  })
  it('les buzzers sont inactifs', () => {
    const s = lettersGame()
    expect(err(s, { type: 'buzz', teamId: 't1', windowId: s.round!.windowId }, T0 + 5)).toBe('closed')
  })
})

describe('Finale Déclic et égalité', () => {
  it('bonus figé au buzz, attribué à la validation', () => {
    let s = game({ puzzles: [pz('a', 'Abc')], finale: [pz('f', 'Bonne nuit')], finaleOn: true })
    s = ok(s, { type: 'skip' }, T0)
    s = ok(s, { type: 'next', roundKey: s.round!.key }, T0)
    expect(s.phase).toBe('final_intro')
    s = ok(s, { type: 'startFinale' }, T0)
    s = ok(s, { type: 'startReveal' }, T0)
    s = at(s, T0 + 1200 * 2) // 2 lettres révélées sur 9 → 7 cachées
    s = ok(s, { type: 'buzz', teamId: 't1', windowId: s.round!.windowId }, T0 + 2500)
    expect(s.round!.buzz!.hiddenAtBuzz).toBe(7)
    s = ok(s, { type: 'judge', correct: true, windowId: s.round!.buzz!.windowId }, T0 + 9000)
    expect(s.teams[0].score).toBe(100 + 10 * 7)
  })
  it('égalité en tête : départage proposé, ou égalité conservée', () => {
    let s = game({ n: 3, puzzles: [pz('a', 'Abc')] })
    s = ok(s, { type: 'skip' }, T0)
    s = ok(s, { type: 'next', roundKey: s.round!.key }, T0)
    expect(s.phase).toBe('end_tie') // 0-0-0
    const kept = ok(s, { type: 'finish' }, T0)
    expect(kept.phase).toBe('podium')
    s = ok(s, { type: 'adjustScore', teamId: 't3', delta: -10 }, T0)
    s = ok(s, { type: 'tiebreak', puzzle: pz('d', 'Départage') }, T0)
    expect(s.round!.isTiebreak).toBe(true)
    expect(s.round!.blocked).toEqual(['t3'])
    s = ok(s, { type: 'startReveal' }, T0)
    expect(err(s, { type: 'buzz', teamId: 't3', windowId: s.round!.windowId }, T0 + 1)).toBe('blocked')
    s = ok(s, { type: 'buzz', teamId: 't2', windowId: s.round!.windowId }, T0 + 2)
    s = ok(s, { type: 'judge', correct: true, windowId: s.round!.buzz!.windowId }, T0 + 3)
    s = ok(s, { type: 'next', roundKey: s.round!.key }, T0 + 4)
    expect(s.phase).toBe('podium')
  })
})

describe('restauration', () => {
  it('une manche interrompue repart en pause, scores et progression intacts', () => {
    let s = ok(game(), { type: 'startReveal' }, T0)
    s = at(s, T0 + 2400)
    s = ok(s, { type: 'adjustScore', teamId: 't1', delta: 30 }, T0 + 2500)
    const shown = s.round!.revealed.filter(Boolean).length
    const r = restoreSafe(JSON.parse(JSON.stringify(s)), T0 + 600000)
    expect(r.round!.status).toBe('paused')
    expect(r.round!.revealed.filter(Boolean).length).toBe(shown)
    expect(r.teams[0].score).toBe(30)
  })
})
