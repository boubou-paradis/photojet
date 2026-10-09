import { describe, expect, it } from 'vitest'
import { availableActions, isNewer, phoneView, remoteAction, windowEndsAt } from '../machine'
import type { BuzzerActiveState, BuzzerQueueEntry } from '../types'

const T0 = Date.parse('2026-10-09T20:00:00.000Z')
const iso = (ms: number) => new Date(ms).toISOString()

function state(patch: Partial<BuzzerActiveState> = {}): BuzzerActiveState {
  return {
    active: true, v: 10, phase: 'waiting', mode: 'solo', teams: [], windowMs: 1500, timerS: null,
    roundNo: 3, attempt: 1, openedAt: null, deadlineAt: null, firstBuzzAt: null, priority: null,
    queue: [], blocked: [], outcome: null, winner: null, paused: false, serverNow: iso(T0),
    ...patch,
  }
}

const q = (rank: number, unit: string, label: string, status: BuzzerQueueEntry['status'], gapMs: number): BuzzerQueueEntry => ({ rank, unit, label, status, gapMs })

const buzzed = (patch: Partial<BuzzerActiveState> = {}) =>
  state({
    phase: 'buzzed',
    firstBuzzAt: iso(T0),
    priority: { unit: 'p:luna', label: 'Luna' },
    queue: [q(1, 'p:luna', 'Luna', 'priority', 0), q(2, 'p:chris', 'Chris', 'queued', 140), q(3, 'p:mango', 'Mango', 'queued', 310)],
    ...patch,
  })

describe('télécommande', () => {
  it('PageDown : ouvrir, bonne réponse, nouvelle manche', () => {
    expect(remoteAction(state({ phase: 'waiting' }), 'next')).toBe('open')
    expect(remoteAction(buzzed(), 'next')).toBe('right')
    expect(remoteAction(state({ phase: 'closed', outcome: 'won' }), 'next')).toBe('new_round')
  })
  it('PageDown ne fait rien buzzers ouverts sans buzz, en lobby ou en test', () => {
    expect(remoteAction(state({ phase: 'open' }), 'next')).toBeNull()
    expect(remoteAction(state({ phase: 'lobby' }), 'next')).toBeNull()
    expect(remoteAction(state({ phase: 'test' }), 'next')).toBeNull()
  })
  it('PageUp = mauvaise réponse seulement si quelqu’un a la main', () => {
    expect(remoteAction(buzzed(), 'prev')).toBe('wrong')
    expect(remoteAction(state({ phase: 'open' }), 'prev')).toBeNull()
    expect(remoteAction(state({ phase: 'closed' }), 'prev')).toBeNull()
  })
  it('rien pendant une pause', () => {
    expect(remoteAction(buzzed({ paused: true }), 'next')).toBeNull()
    expect(remoteAction(buzzed({ paused: true }), 'prev')).toBeNull()
  })
})

describe('actions proposées à l’animateur', () => {
  it('suivent la phase', () => {
    expect(availableActions(state({ phase: 'lobby' }))).toEqual(['test_start', 'new_round'])
    expect(availableActions(state({ phase: 'waiting' }))).toContain('open')
    expect(availableActions(buzzed())).toEqual(['right', 'wrong', 'cancel'])
    expect(availableActions(state({ phase: 'open', deadlineAt: iso(T0 + 15000) }))).toContain('timeout')
    expect(availableActions(state({ phase: 'open' }))).not.toContain('timeout')
  })
})

describe('ordre des états reçus', () => {
  it('ignore un état plus ancien ou identique', () => {
    expect(isNewer(state({ v: 11 }), state({ v: 10 }))).toBe(true)
    expect(isNewer(state({ v: 9 }), state({ v: 10 }))).toBe(false)
    expect(isNewer(state({ v: 10 }), state({ v: 10 }))).toBe(false)
    expect(isNewer(state(), null)).toBe(true)
  })
})

describe('écran du téléphone', () => {
  const me = (unit: string, extra: Partial<Parameters<typeof phoneView>[1]> = {}) => ({ unit, tested: false, myBuzz: null, ...extra })

  it('premier : celui qui a la main', () => {
    expect(phoneView(buzzed(), me('p:luna'), T0 + 100).screen).toBe('first')
  })
  it('suivant : rang et écart viennent de la file serveur', () => {
    expect(phoneView(buzzed(), me('p:chris'), T0 + 100)).toEqual({ screen: 'rank', rank: 2, gapMs: 140, leader: 'Luna' })
  })
  it('hors des 5 premiers : rang renvoyé par le buzz', () => {
    const view = phoneView(buzzed(), me('p:zoe', { myBuzz: { rank: 7, gapMs: 900, status: 'queued', attempt: 1 } }), T0 + 100)
    expect(view).toEqual({ screen: 'rank', rank: 7, gapMs: 900, leader: 'Luna' })
  })
  it('pas encore buzzé : encore possible pendant la fenêtre, trop tard après', () => {
    expect(phoneView(buzzed(), me('p:nina'), T0 + 1000).screen).toBe('open')
    expect(phoneView(buzzed(), me('p:nina'), T0 + 1600).screen).toBe('late')
  })
  it('verrouillage immédiat (fenêtre 0) : trop tard tout de suite', () => {
    expect(phoneView(buzzed({ windowMs: 0 }), me('p:nina'), T0 + 1).screen).toBe('late')
  })
  it('après une mauvaise réponse : le bloqué le voit, le suivant prend la main', () => {
    const after = buzzed({
      priority: { unit: 'p:chris', label: 'Chris' },
      queue: [q(1, 'p:luna', 'Luna', 'blocked', 0), q(2, 'p:chris', 'Chris', 'priority', 140)],
    })
    expect(phoneView(after, me('p:luna'), T0 + 5000).screen).toBe('blocked')
    expect(phoneView(after, me('p:chris'), T0 + 5000).screen).toBe('first')
  })
  it('réouverture : les bloqués restent bloqués, les autres peuvent buzzer', () => {
    const reopened = state({ phase: 'open', attempt: 2 })
    expect(phoneView(reopened, me('p:luna', { myBuzz: { rank: 1, gapMs: 0, status: 'blocked', attempt: 1 } }), T0).screen).toBe('blocked')
    expect(phoneView(reopened, me('p:nina'), T0).screen).toBe('open')
  })
  it('mode équipe : tous les membres partagent l’état de l’équipe', () => {
    const team = buzzed({ mode: 'team', priority: { unit: 't:table4', label: 'Table 4' }, queue: [q(1, 't:table4', 'Table 4', 'priority', 0)] })
    expect(phoneView(team, me('t:table4'), T0 + 10).screen).toBe('first')
    expect(phoneView(team, me('t:bretons'), T0 + 2000).screen).toBe('late')
  })
  it('test des buzzers, pause, fin de manche', () => {
    expect(phoneView(state({ phase: 'test' }), me('p:luna'), T0).screen).toBe('test')
    expect(phoneView(state({ phase: 'test' }), me('p:luna', { tested: true }), T0).screen).toBe('tested')
    expect(phoneView(buzzed({ paused: true }), me('p:luna'), T0).screen).toBe('paused')
    const won = buzzed({ phase: 'closed', outcome: 'won', winner: 'Luna' })
    expect(phoneView(won, me('p:luna'), T0).screen).toBe('won')
    expect(phoneView(won, me('p:chris'), T0).screen).toBe('done')
  })
  it('fin de fenêtre calculée sur l’heure du 1er buzz', () => {
    expect(windowEndsAt(buzzed())).toBe(T0 + 1500)
    expect(windowEndsAt(state())).toBeNull()
  })
})
