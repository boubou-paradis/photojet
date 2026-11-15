// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// À Demi-Mot — moteur déterministe (fonctions pures).
// apply(state, cmd, now) et tick(state, now) renvoient un NOUVEL état et des événements ;
// aucune minuterie interne : les délais sont des échéances absolues que l'autorité fait avancer.

import { baseLetters, letterIndexes, normalizeLetter, toCells } from './text'
import { DEFAULT_SETTINGS, STATE_SCHEMA, type GameState, type Puzzle, type Round, type Settings, type Team } from './types'

export type Command =
  | { type: 'setTeams'; teams: { id?: string; name: string; color: string }[] }
  | { type: 'renameTeam'; teamId: string; name?: string; color?: string }
  | { type: 'setSettings'; settings: Partial<Settings> }
  | { type: 'startGame'; puzzles: Puzzle[]; finale: Puzzle[] }
  | { type: 'startReveal' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'revealLetter' }
  | { type: 'buzz'; teamId: string; windowId: number }
  | { type: 'judge'; correct: boolean; windowId: number }
  | { type: 'cancelBuzz'; windowId: number }
  | { type: 'undo' }
  | { type: 'adjustScore'; teamId: string; delta: number }
  | { type: 'skip' }
  | { type: 'revealSolution' }
  | { type: 'next'; roundKey: string }
  | { type: 'display'; display: GameState['display'] }
  | { type: 'proposeLetter'; letter: string }
  | { type: 'solveTurn'; correct: boolean }
  | { type: 'passTurn' }
  | { type: 'startFinale' }
  | { type: 'tiebreak'; puzzle: Puzzle }
  | { type: 'finish' }
  | { type: 'reset' }

export type GameEvent =
  | { type: 'reveal'; positions: number[] }
  | { type: 'buzz'; teamId: string }
  | { type: 'correct'; teamId: string; points: number }
  | { type: 'wrong'; teamId: string }
  | { type: 'timeout'; teamId: string }
  | { type: 'resolved'; won: boolean }
  | { type: 'letter'; letter: string; hits: number }
  | { type: 'turn'; teamId: string }
  | { type: 'round'; key: string }
  | { type: 'podium' }

export type Result = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string; message: string }

export const MIN_TEAMS = 2
export const MAX_TEAMS = 20
const LOG_MAX = 200
const UNDO_MAX = 20

// ---------------------------------------------------------------- création
export function createGame(code: string, teams: Team[], seed: number, now: number, settings: Partial<Settings> = {}): GameState {
  return {
    schema: STATE_SCHEMA,
    v: 1,
    code,
    phase: 'waiting',
    display: 'board',
    settings: { ...DEFAULT_SETTINGS, ...settings, finale: { ...DEFAULT_SETTINGS.finale, ...(settings.finale ?? {}) } },
    teams,
    plan: { puzzles: [], finale: [] },
    roundIndex: -1,
    stage: 'main',
    round: null,
    usedPuzzleIds: [],
    undo: [],
    log: [],
    seed: seed >>> 0,
    createdAt: now,
    updatedAt: now,
  }
}

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Permutation de Fisher-Yates, stable pour une graine donnée. */
export function permutation<T>(items: T[], seed: number): T[] {
  const out = [...items]
  const r = rng(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function hashString(s: string) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619)
  return h >>> 0
}

// ---------------------------------------------------------------- outils
const fail = (error: string, message: string): Result => ({ ok: false, error, message })

export const hiddenCount = (r: Round) => r.cells.reduce((n, c, i) => n + (c.kind === 'letter' && !r.revealed[i] ? 1 : 0), 0)
const teamName = (s: GameState, id: string) => s.teams.find((t) => t.id === id)?.name ?? id

function log(s: GameState, now: number, text: string) {
  s.log.push({ at: now, text })
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX)
}

function snapshot(s: GameState, label: string) {
  s.undo.push({ label, teams: structuredClone(s.teams), round: structuredClone(s.round!) })
  if (s.undo.length > UNDO_MAX) s.undo.shift()
}

function revealAll(r: Round) {
  const newly: number[] = []
  r.cells.forEach((c, i) => {
    if (c.kind === 'letter' && !r.revealed[i]) {
      r.revealed[i] = true
      newly.push(i)
    }
  })
  return newly
}

function resolve(s: GameState, r: Round, now: number, outcome: NonNullable<Round['outcome']>, events: GameEvent[], show: boolean) {
  r.outcome = outcome
  r.status = 'resolved'
  r.buzz = null
  r.nextRevealAt = null
  r.finalWindowEndsAt = null
  r.turnDeadline = null
  r.paused = null
  r.windowId++ // ferme définitivement la fenêtre courante
  if (show) {
    const newly = revealAll(r)
    r.solutionShown = true
    if (newly.length) r.lastRevealed = newly
  }
  events.push({ type: 'resolved', won: outcome.kind === 'won' })
  log(s, now, outcome.kind === 'won' ? `Énigme ${r.number} gagnée par ${teamName(s, outcome.teamId)} (+${outcome.points})` : `Énigme ${r.number} close sans gagnant (${outcome.reason === 'all_blocked' ? 'toutes les équipes bloquées' : outcome.reason === 'time' ? 'temps écoulé' : outcome.reason === 'skipped' ? 'passée' : 'solution révélée'})`)
}

/** Révèle la prochaine position de la permutation. Renvoie false s'il n'en reste plus. */
function revealNext(r: Round): number | null {
  while (r.cursor < r.order.length && r.revealed[r.order[r.cursor]]) r.cursor++
  if (r.cursor >= r.order.length) return null
  const i = r.order[r.cursor++]
  r.revealed[i] = true
  r.lastRevealed = [i]
  return i
}

function eligibleTeams(s: GameState, r: Round) {
  return s.teams.filter((t) => !r.blocked.includes(t.id))
}

function makeRound(s: GameState, puzzle: Puzzle, opts: { number: number; total: number; mode: Round['mode']; isFinal: boolean; isTiebreak: boolean; blocked: string[] }): Round {
  const cells = toCells(puzzle.solution)
  // Clé publique de la manche (envoyée à l'écran et aux téléphones) : JAMAIS l'identifiant
  // de l'énigme, qui peut être tiré de la solution (« se-tourner-les-pouces »).
  const key = `${s.stage}-${opts.number}-${s.usedPuzzleIds.length}`
  const points = opts.isFinal ? s.settings.finale.base : (puzzle.points ?? s.settings.pointsPerPuzzle)
  return {
    key,
    number: opts.number,
    total: opts.total,
    puzzle: structuredClone(puzzle),
    mode: opts.mode,
    isFinal: opts.isFinal,
    isTiebreak: opts.isTiebreak,
    points,
    cells,
    revealed: cells.map((c) => c.kind !== 'letter'),
    order: permutation(letterIndexes(cells), (s.seed ^ hashString(key)) >>> 0),
    cursor: 0,
    status: 'ready',
    nextRevealAt: null,
    finalWindowEndsAt: null,
    windowId: 1,
    buzz: null,
    blocked: opts.blocked,
    paused: null,
    turnTeamId: null,
    turnDeadline: null,
    letters: [],
    lastRevealed: [],
    outcome: null,
    solutionShown: false,
  }
}

function startRound(s: GameState, puzzle: Puzzle, opts: Parameters<typeof makeRound>[2], now: number, events: GameEvent[]) {
  s.round = makeRound(s, puzzle, opts)
  s.usedPuzzleIds.push(puzzle.id)
  s.undo = []
  s.display = 'board'
  s.phase = 'round'
  events.push({ type: 'round', key: s.round.key })
  log(s, now, `Énigme ${opts.number}/${opts.total}${opts.isFinal ? ' (finale)' : opts.isTiebreak ? ' (départage)' : ''} prête · ${puzzle.category}`)
}

function mainMode(s: GameState, index: number): Round['mode'] {
  const n = s.plan.puzzles.length
  return index >= n - Math.min(s.settings.lettersRounds, n) ? 'letters' : 'reveal'
}

/** Équipes à égalité en tête (au moins deux), sinon null. */
export function topTie(teams: Team[]): string[] | null {
  if (teams.length < 2) return null
  const max = Math.max(...teams.map((t) => t.score))
  const top = teams.filter((t) => t.score === max).map((t) => t.id)
  return top.length > 1 ? top : null
}

function endOrTie(s: GameState, now: number, events: GameEvent[]) {
  const tie = topTie(s.teams)
  if (tie) {
    s.phase = 'end_tie'
    s.display = 'standings'
    log(s, now, `Égalité en tête : ${tie.map((id) => teamName(s, id)).join(', ')}`)
  } else {
    s.phase = 'podium'
    s.display = 'board'
    events.push({ type: 'podium' })
    log(s, now, 'Podium')
  }
}

function passTurn(s: GameState, r: Round, now: number, events: GameEvent[]) {
  const ids = s.teams.map((t) => t.id)
  const i = ids.indexOf(r.turnTeamId ?? '')
  r.turnTeamId = ids[(i + 1) % ids.length]
  r.turnDeadline = now + s.settings.turnMs
  events.push({ type: 'turn', teamId: r.turnTeamId })
}

function resumeAfterBuzz(r: Round, now: number) {
  const b = r.buzz!
  r.buzz = null
  r.windowId++ // nouvelle fenêtre : les anciens buzzs ne prennent plus effet
  r.status = b.resume
  if (b.resume === 'revealing') r.nextRevealAt = now + Math.max(0, b.resumeMs)
  else r.finalWindowEndsAt = now + Math.max(0, b.resumeMs)
}

/** Mauvaise réponse ou délai expiré : l'équipe est bloquée, les autres reprennent (sans file de buzzs). */
function failAnswer(s: GameState, r: Round, now: number, events: GameEvent[], timeout: boolean) {
  const teamId = r.buzz!.teamId
  const team = s.teams.find((t) => t.id === teamId)!
  if (s.settings.wrongPenalty > 0) team.score -= s.settings.wrongPenalty
  r.blocked.push(teamId)
  events.push(timeout ? { type: 'timeout', teamId } : { type: 'wrong', teamId })
  log(s, now, `${team.name} : ${timeout ? 'temps de réponse écoulé' : 'mauvaise réponse'} → bloquée${s.settings.wrongPenalty ? ` (−${s.settings.wrongPenalty})` : ''}`)
  if (eligibleTeams(s, r).length === 0) {
    resolve(s, r, now, { kind: 'none', reason: 'all_blocked' }, events, true)
    return
  }
  resumeAfterBuzz(r, now)
}

// ---------------------------------------------------------------- commandes
export function apply(prev: GameState, cmd: Command, now: number): Result {
  const s = structuredClone(prev)
  const events: GameEvent[] = []
  const r = s.round
  const res = run(s, r, cmd, now, events)
  if (res) return res
  // Les échéances déjà dépassées sont traitées avant de rendre l'état.
  tickInPlace(s, now, events)
  s.v = prev.v + 1
  s.updatedAt = now
  return { ok: true, state: s, events }
}

function run(s: GameState, r: Round | null, cmd: Command, now: number, events: GameEvent[]): Result | null {
  switch (cmd.type) {
    case 'setTeams': {
      if (s.phase !== 'waiting') return fail('locked', 'Les équipes ne peuvent être ajoutées ou retirées qu’avant le lancement de la partie.')
      if (cmd.teams.length < MIN_TEAMS || cmd.teams.length > MAX_TEAMS) return fail('team_count', `Il faut entre ${MIN_TEAMS} et ${MAX_TEAMS} équipes.`)
      const names = cmd.teams.map((t) => t.name.trim())
      if (names.some((n) => !n || n.length > 28)) return fail('team_name', 'Chaque équipe a un nom de 1 à 28 caractères.')
      if (new Set(names.map((n) => n.toLocaleLowerCase('fr-FR'))).size !== names.length) return fail('team_name', 'Deux équipes portent le même nom.')
      const byId = new Map(s.teams.map((t) => [t.id, t]))
      let n = 0
      s.teams = cmd.teams.map((t) => {
        const old = t.id ? byId.get(t.id) : undefined
        // Identifiant fourni par le serveur (uuid de demimot_teams) : conservé tel quel.
        let id = old?.id ?? t.id
        while (!id || (!old && s.teams.some((x) => x.id === id))) id = `t${Date.now().toString(36)}${n++}`
        return { id, name: t.name.trim(), color: t.color, score: old?.score ?? 0 }
      })
      log(s, now, `Équipes : ${s.teams.map((t) => t.name).join(', ')}`)
      return null
    }
    case 'renameTeam': {
      const t = s.teams.find((x) => x.id === cmd.teamId)
      if (!t) return fail('unknown_team', 'Équipe inconnue.')
      const name = cmd.name?.trim()
      if (name !== undefined) {
        if (!name || name.length > 28) return fail('team_name', 'Le nom doit compter de 1 à 28 caractères.')
        if (s.teams.some((x) => x.id !== t.id && x.name.toLocaleLowerCase('fr-FR') === name.toLocaleLowerCase('fr-FR'))) return fail('team_name', 'Une autre équipe porte déjà ce nom.')
        t.name = name
      }
      if (cmd.color) t.color = cmd.color
      return null
    }
    case 'setSettings': {
      const next = { ...s.settings, ...cmd.settings, finale: { ...s.settings.finale, ...(cmd.settings.finale ?? {}) } }
      const n = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi
      if (!n(next.puzzleCount, 1, 50) || !n(next.lettersRounds, 0, 50) || !n(next.pointsPerPuzzle, 0, 10000) || !n(next.revealIntervalMs, 300, 10000) || !n(next.answerMs, 2000, 60000) || !n(next.finalWindowMs, 0, 30000) || !n(next.wrongPenalty, 0, 10000) || !n(next.turnMs, 5000, 120000) || !n(next.finale.puzzles, 1, 10) || !n(next.finale.base, 0, 10000) || !n(next.finale.bonusPerHidden, 0, 1000))
        return fail('settings', 'Réglage hors des limites autorisées.')
      // Les règles de manche ne changent pas pendant une énigme en cours (sauf la couleur du plateau).
      const onlyTheme = Object.keys(cmd.settings).every((k) => k === 'theme')
      if (s.phase === 'round' && r && r.status !== 'resolved' && !onlyTheme) return fail('locked', 'Réglage modifiable entre deux énigmes seulement.')
      s.settings = next
      return null
    }
    case 'startGame': {
      if (s.phase !== 'waiting') return fail('state', 'La partie est déjà lancée.')
      if (s.teams.length < MIN_TEAMS) return fail('team_count', `Il faut au moins ${MIN_TEAMS} équipes.`)
      if (!cmd.puzzles.length) return fail('no_puzzle', 'Aucune énigme disponible pour cette partie.')
      s.plan = { puzzles: structuredClone(cmd.puzzles), finale: s.settings.finale.enabled ? structuredClone(cmd.finale) : [] }
      s.stage = 'main'
      s.roundIndex = 0
      startRound(s, s.plan.puzzles[0], { number: 1, total: s.plan.puzzles.length, mode: mainMode(s, 0), isFinal: false, isTiebreak: false, blocked: [] }, now, events)
      log(s, now, `Partie lancée : ${s.plan.puzzles.length} énigmes${s.plan.finale.length ? ` + finale (${s.plan.finale.length})` : ''}`)
      return null
    }
    case 'startReveal': {
      if (!r || r.status !== 'ready') return fail('state', 'Aucune énigme prête à lancer.')
      if (r.mode === 'reveal') {
        r.status = 'revealing'
        r.windowId++
        r.nextRevealAt = now + s.settings.revealIntervalMs
        log(s, now, `Dévoilement lancé · énigme ${r.number}`)
      } else {
        r.status = 'turn'
        const ids = s.teams.map((t) => t.id)
        r.turnTeamId = ids[(r.number - 1) % ids.length]
        r.turnDeadline = now + s.settings.turnMs
        events.push({ type: 'turn', teamId: r.turnTeamId })
        log(s, now, `Tour de lettres lancé · ${teamName(s, r.turnTeamId)} commence`)
      }
      return null
    }
    case 'pause': {
      if (!r || !['revealing', 'final_window', 'answering', 'turn', 'ready'].includes(r.status)) return fail('state', 'Rien à mettre en pause.')
      const from = r.status as Exclude<Round['status'], 'paused' | 'resolved'>
      const deadline = from === 'revealing' ? r.nextRevealAt : from === 'final_window' ? r.finalWindowEndsAt : from === 'answering' ? r.buzz!.deadline : from === 'turn' ? r.turnDeadline : null
      r.paused = { from, remainingMs: deadline === null ? null : Math.max(0, deadline - now) }
      r.status = 'paused'
      r.nextRevealAt = null
      r.finalWindowEndsAt = null
      r.turnDeadline = null
      log(s, now, 'Pause')
      return null
    }
    case 'resume': {
      if (!r || r.status !== 'paused' || !r.paused) return fail('state', 'La partie n’est pas en pause.')
      const { from, remainingMs } = r.paused
      const rem = remainingMs ?? 0
      r.status = from
      r.paused = null
      if (from === 'revealing') {
        r.windowId++
        r.nextRevealAt = now + rem
      } else if (from === 'final_window') {
        r.windowId++
        r.finalWindowEndsAt = now + rem
      } else if (from === 'answering') r.buzz!.deadline = now + rem
      else if (from === 'turn') r.turnDeadline = now + rem
      log(s, now, 'Reprise')
      return null
    }
    case 'revealLetter': {
      if (!r || r.mode !== 'reveal' || !['ready', 'revealing', 'paused'].includes(r.status) || (r.status === 'paused' && r.paused?.from !== 'revealing' && r.paused?.from !== 'ready'))
        return fail('state', 'Révélation manuelle possible avant ou pendant le dévoilement seulement.')
      const i = revealNext(r)
      if (i === null) return fail('state', 'Toutes les lettres sont déjà visibles.')
      events.push({ type: 'reveal', positions: [i] })
      if (hiddenCount(r) === 0 && r.status === 'revealing') {
        r.status = 'final_window'
        r.nextRevealAt = null
        r.finalWindowEndsAt = now + s.settings.finalWindowMs
      }
      return null
    }
    case 'buzz': {
      if (!r || r.mode !== 'reveal') return fail('closed', 'Les buzzers sont fermés.')
      if (r.status !== 'revealing' && r.status !== 'final_window') return fail(r.status === 'answering' ? 'taken' : 'closed', r.status === 'answering' ? 'Une autre équipe a déjà la main.' : 'Les buzzers sont fermés.')
      if (cmd.windowId !== r.windowId) return fail('stale', 'Buzz d’une fenêtre précédente : ignoré.')
      if (!s.teams.some((t) => t.id === cmd.teamId)) return fail('unknown_team', 'Équipe inconnue.')
      if (r.blocked.includes(cmd.teamId)) return fail('blocked', 'Équipe bloquée pour cette énigme.')
      const resume = r.status
      const resumeMs = resume === 'revealing' ? Math.max(0, (r.nextRevealAt ?? now) - now) : Math.max(0, (r.finalWindowEndsAt ?? now) - now)
      r.buzz = { teamId: cmd.teamId, windowId: r.windowId, at: now, deadline: now + s.settings.answerMs, totalMs: s.settings.answerMs, hiddenAtBuzz: hiddenCount(r), resume, resumeMs }
      r.status = 'answering'
      r.nextRevealAt = null
      r.finalWindowEndsAt = null
      events.push({ type: 'buzz', teamId: cmd.teamId })
      log(s, now, `Buzz : ${teamName(s, cmd.teamId)}${r.isFinal ? ` (bonus figé : ${r.buzz.hiddenAtBuzz} lettres cachées)` : ''}`)
      return null
    }
    case 'judge': {
      if (!r || r.status !== 'answering' || !r.buzz) return fail('state', 'Aucune réponse à arbitrer.')
      if (cmd.windowId !== r.buzz.windowId) return fail('stale', 'Arbitrage d’un buzz déjà traité : ignoré.')
      snapshot(s, cmd.correct ? `Bonne réponse ${teamName(s, r.buzz.teamId)}` : `Mauvaise réponse ${teamName(s, r.buzz.teamId)}`)
      if (cmd.correct) {
        const teamId = r.buzz.teamId
        const points = r.isFinal ? s.settings.finale.base + s.settings.finale.bonusPerHidden * r.buzz.hiddenAtBuzz : r.points
        s.teams.find((t) => t.id === teamId)!.score += points
        events.push({ type: 'correct', teamId, points })
        resolve(s, r, now, { kind: 'won', teamId, points }, events, true)
      } else failAnswer(s, r, now, events, false)
      return null
    }
    case 'cancelBuzz': {
      if (!r || !r.buzz || (r.status !== 'answering' && !(r.status === 'paused' && r.paused?.from === 'answering'))) return fail('state', 'Aucun buzz à annuler.')
      if (cmd.windowId !== r.buzz.windowId) return fail('stale', 'Ce buzz a déjà été traité.')
      log(s, now, `Buzz annulé : ${teamName(s, r.buzz.teamId)} (non bloquée)`)
      if (r.status === 'paused') {
        // Reste en pause : la reprise rouvrira le dévoilement.
        r.paused = { from: r.buzz.resume, remainingMs: r.buzz.resumeMs }
        r.buzz = null
        r.windowId++
      } else resumeAfterBuzz(r, now)
      return null
    }
    case 'undo': {
      const snap = s.undo.pop()
      if (!snap || !r || snap.round.key !== r.key) return fail('nothing', 'Aucun arbitrage à annuler pour cette énigme.')
      s.teams = snap.teams
      const back = snap.round
      // État sûr et explicite : la manche revient en pause sur la réponse, temps de réponse complet.
      if (back.status === 'answering' && back.buzz) {
        back.paused = { from: 'answering', remainingMs: back.buzz.totalMs }
        back.status = 'paused'
      } else if (back.status === 'turn') {
        back.paused = { from: 'turn', remainingMs: s.settings.turnMs }
        back.status = 'paused'
        back.turnDeadline = null
      }
      back.windowId = Math.max(back.windowId, r.windowId) + 1
      if (back.buzz) back.buzz.windowId = back.windowId
      s.round = back
      s.phase = 'round'
      log(s, now, `Annulé : ${snap.label} (scores et manche restaurés, en pause)`)
      return null
    }
    case 'adjustScore': {
      const t = s.teams.find((x) => x.id === cmd.teamId)
      if (!t || !Number.isFinite(cmd.delta) || Math.abs(cmd.delta) > 10000) return fail('bad', 'Correction invalide.')
      t.score += Math.round(cmd.delta)
      log(s, now, `Correction : ${t.name} ${cmd.delta > 0 ? '+' : ''}${cmd.delta} → ${t.score}`)
      return null
    }
    case 'skip': {
      if (!r || r.status === 'resolved') return fail('state', 'Aucune énigme en cours.')
      resolve(s, r, now, { kind: 'none', reason: 'skipped' }, events, false)
      return null
    }
    case 'revealSolution': {
      if (!r) return fail('state', 'Aucune énigme en cours.')
      if (r.status === 'resolved') {
        const newly = revealAll(r)
        r.solutionShown = true
        if (newly.length) r.lastRevealed = newly
      } else resolve(s, r, now, { kind: 'none', reason: 'revealed' }, events, true)
      return null
    }
    case 'next': {
      if (!r || r.key !== cmd.roundKey) return fail('stale', 'Cette énigme n’est plus l’énigme courante.')
      if (r.status !== 'resolved') return fail('state', 'Terminez ou passez l’énigme avant de continuer.')
      if (s.phase !== 'round') return fail('state', 'Aucune énigme suivante.')
      if (s.stage === 'main' && s.roundIndex + 1 < s.plan.puzzles.length) {
        s.roundIndex++
        const i = s.roundIndex
        startRound(s, s.plan.puzzles[i], { number: i + 1, total: s.plan.puzzles.length, mode: mainMode(s, i), isFinal: false, isTiebreak: false, blocked: [] }, now, events)
      } else if (s.stage === 'main' && s.plan.finale.length) {
        s.phase = 'final_intro'
        s.display = 'board'
        log(s, now, 'Présentation de la Finale Déclic')
      } else if (s.stage === 'finale' && s.roundIndex + 1 < s.plan.finale.length) {
        s.roundIndex++
        const i = s.roundIndex
        startRound(s, s.plan.finale[i], { number: i + 1, total: s.plan.finale.length, mode: 'reveal', isFinal: true, isTiebreak: false, blocked: [] }, now, events)
      } else endOrTie(s, now, events)
      return null
    }
    case 'startFinale': {
      if (s.phase !== 'final_intro') return fail('state', 'La finale n’est pas annoncée.')
      s.stage = 'finale'
      s.roundIndex = 0
      startRound(s, s.plan.finale[0], { number: 1, total: s.plan.finale.length, mode: 'reveal', isFinal: true, isTiebreak: false, blocked: [] }, now, events)
      return null
    }
    case 'tiebreak': {
      if (s.phase !== 'end_tie') return fail('state', 'Aucune égalité à départager.')
      const tie = topTie(s.teams) ?? []
      s.stage = 'tiebreak'
      s.roundIndex = 0
      startRound(s, cmd.puzzle, { number: 1, total: 1, mode: 'reveal', isFinal: false, isTiebreak: true, blocked: s.teams.filter((t) => !tie.includes(t.id)).map((t) => t.id) }, now, events)
      return null
    }
    case 'finish': {
      if (s.phase !== 'end_tie' && !(s.phase === 'round' && r?.status === 'resolved')) return fail('state', 'Terminez l’énigme en cours avant le podium.')
      s.phase = 'podium'
      s.display = 'board'
      events.push({ type: 'podium' })
      log(s, now, topTie(s.teams) ? 'Podium (égalité conservée)' : 'Podium')
      return null
    }
    case 'display': {
      if (!['board', 'standings', 'rules', 'black'].includes(cmd.display)) return fail('bad', 'Affichage inconnu.')
      s.display = cmd.display
      return null
    }
    case 'proposeLetter': {
      if (!r || r.mode !== 'letters' || r.status !== 'turn' || !r.turnTeamId) return fail('state', 'Aucun tour de lettres en cours.')
      const L = normalizeLetter(cmd.letter)
      if (!L) return fail('bad_letter', 'Saisissez une seule lettre.')
      if (r.letters.some((x) => x.letter === L)) return fail('already', `La lettre ${L} a déjà été proposée (sans pénalité).`)
      const positions: number[] = []
      r.cells.forEach((c, i) => {
        if (c.kind === 'letter' && baseLetters(c.ch).includes(L)) positions.push(i)
      })
      const newly = positions.filter((i) => !r.revealed[i])
      for (const i of newly) r.revealed[i] = true
      r.lastRevealed = newly
      r.letters.push({ letter: L, hits: positions.length, teamId: r.turnTeamId })
      events.push({ type: 'letter', letter: L, hits: positions.length })
      if (newly.length) events.push({ type: 'reveal', positions: newly })
      log(s, now, `${teamName(s, r.turnTeamId)} propose ${L} : ${positions.length ? `${positions.length} fois` : 'absente'}`)
      if (positions.length) r.turnDeadline = now + s.settings.turnMs
      else passTurn(s, r, now, events)
      return null
    }
    case 'solveTurn': {
      if (!r || r.mode !== 'letters' || r.status !== 'turn' || !r.turnTeamId) return fail('state', 'Aucun tour de lettres en cours.')
      snapshot(s, `${cmd.correct ? 'Bonne' : 'Mauvaise'} résolution ${teamName(s, r.turnTeamId)}`)
      if (cmd.correct) {
        const teamId = r.turnTeamId
        s.teams.find((t) => t.id === teamId)!.score += r.points
        events.push({ type: 'correct', teamId, points: r.points })
        resolve(s, r, now, { kind: 'won', teamId, points: r.points }, events, true)
      } else {
        events.push({ type: 'wrong', teamId: r.turnTeamId })
        log(s, now, `${teamName(s, r.turnTeamId)} : résolution incorrecte, la main passe`)
        passTurn(s, r, now, events)
      }
      return null
    }
    case 'passTurn': {
      if (!r || r.mode !== 'letters' || r.status !== 'turn') return fail('state', 'Aucun tour de lettres en cours.')
      passTurn(s, r, now, events)
      return null
    }
    case 'reset': {
      s.phase = 'waiting'
      s.display = 'board'
      s.round = null
      s.plan = { puzzles: [], finale: [] }
      s.roundIndex = -1
      s.stage = 'main'
      s.undo = []
      s.usedPuzzleIds = []
      for (const t of s.teams) t.score = 0
      log(s, now, 'Nouvelle partie : scores remis à zéro')
      return null
    }
  }
}

// ---------------------------------------------------------------- échéances
/** Fait avancer les échéances dépassées (révélations, délais, fenêtre finale, tour). */
export function tick(prev: GameState, now: number): { state: GameState; events: GameEvent[]; changed: boolean } {
  const due = nextDeadline(prev)
  if (due === null || due > now) return { state: prev, events: [], changed: false }
  const s = structuredClone(prev)
  const events: GameEvent[] = []
  tickInPlace(s, now, events)
  s.v = prev.v + 1
  s.updatedAt = now
  return { state: s, events, changed: true }
}

function tickInPlace(s: GameState, now: number, events: GameEvent[]) {
  const r = s.round
  if (!r) return
  for (let guard = 0; guard < 500; guard++) {
    if (r.status === 'revealing' && r.nextRevealAt !== null && r.nextRevealAt <= now) {
      const at = r.nextRevealAt
      const i = revealNext(r)
      if (i !== null) events.push({ type: 'reveal', positions: [i] })
      if (hiddenCount(r) === 0) {
        r.status = 'final_window'
        r.nextRevealAt = null
        r.finalWindowEndsAt = at + s.settings.finalWindowMs
      } else r.nextRevealAt = at + s.settings.revealIntervalMs
      continue
    }
    if (r.status === 'final_window' && r.finalWindowEndsAt !== null && r.finalWindowEndsAt <= now) {
      resolve(s, r, now, { kind: 'none', reason: 'time' }, events, true)
      continue
    }
    if (r.status === 'answering' && r.buzz && r.buzz.deadline <= now) {
      snapshot(s, `Temps écoulé ${teamName(s, r.buzz.teamId)}`)
      failAnswer(s, r, r.buzz.deadline, events, true)
      continue
    }
    if (r.status === 'turn' && r.turnDeadline !== null && r.turnDeadline <= now) {
      log(s, now, `${teamName(s, r.turnTeamId ?? '')} : temps de tour écoulé, la main passe`)
      passTurn(s, r, r.turnDeadline, events)
      if (r.turnDeadline !== null && r.turnDeadline <= now) r.turnDeadline = now + s.settings.turnMs
      continue
    }
    break
  }
}

/** Prochaine échéance de l'état (ms absolues), pour la minuterie de l'autorité. */
export function nextDeadline(s: GameState): number | null {
  const r = s.round
  if (!r) return null
  if (r.status === 'revealing') return r.nextRevealAt
  if (r.status === 'final_window') return r.finalWindowEndsAt
  if (r.status === 'answering') return r.buzz?.deadline ?? null
  if (r.status === 'turn') return r.turnDeadline
  return null
}

/** Restauration après redémarrage : toute manche active repart EN PAUSE, avec ses délais restants. */
export function restoreSafe(prev: GameState, now: number): GameState {
  const r = prev.round
  if (!r || !['revealing', 'final_window', 'answering', 'turn'].includes(r.status)) return prev
  const res = apply(prev, { type: 'pause' }, now)
  if (!res.ok) return prev
  // Les délais restants calculés depuis l'arrêt peuvent être nuls : on rend un temps utile.
  const p = res.state.round!.paused!
  if (p.from === 'answering') p.remainingMs = r.buzz?.totalMs ?? p.remainingMs
  else if (p.from === 'revealing') p.remainingMs = res.state.settings.revealIntervalMs
  else if (p.from === 'final_window') p.remainingMs = res.state.settings.finalWindowMs
  else if (p.from === 'turn') p.remainingMs = res.state.settings.turnMs
  res.state.log.push({ at: now, text: 'Session restaurée après interruption : manche en pause' })
  return res.state
}
