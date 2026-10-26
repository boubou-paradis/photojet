import { describe, expect, it } from 'vitest'
import { availableActions, closingRemainingMs, displayOrder, isNewer, phoneScreen, remoteAction, remoteNeedsConfirm } from '../machine'
import type { VoteActiveState, VoteCandidate, VoteEvent } from '../types'

const T0 = Date.parse('2026-10-26T20:00:00.000Z')
const iso = (ms: number) => new Date(ms).toISOString()

const cand = (id: string, sortOrder: number): VoteCandidate => ({
  id, label: id, number: String(sortOrder + 1), description: null, imageUrl: null, emoji: null, color: null, sortOrder,
})

function event(patch: Partial<VoteEvent> = {}): VoteEvent {
  return {
    id: 'ev1', roundNo: 1, parentId: null, title: 'Miss Camping 2026', subtitle: null, intro: null, thanks: null,
    displayMode: 'photo', resultsMode: 'hidden', allowBlank: false, shuffle: true, countdownS: 10, revealMode: 'podium',
    status: 'lobby', closesAt: null, revealStep: 0, candidates: [cand('emma', 0), cand('luna', 1), cand('clara', 2)],
    ...patch,
  }
}

function state(ev: Partial<VoteEvent> | null = {}, patch: Partial<VoteActiveState> = {}): VoteActiveState {
  return { active: true, v: 5, event: ev === null ? null : event(ev), participants: 40, total: 0, results: null, serverNow: iso(T0), ...patch }
}

describe('actions de l’animateur', () => {
  it('une seule action principale à chaque étape', () => {
    expect(availableActions(state({ status: 'lobby' }), 3)[0]).toBe('open')
    expect(availableActions(state({ status: 'open' }), 3)).toEqual(['close'])
    expect(availableActions(state({ status: 'open', closesAt: iso(T0 + 7000) }), 3)).toEqual(['cancel_close'])
    expect(availableActions(state({ status: 'closed' }), 3)[0]).toBe('reveal')
    expect(availableActions(state({ status: 'revealed', revealStep: 1 }), 3)[0]).toBe('reveal_next')
    expect(availableActions(state({ status: 'revealed', revealStep: 3 }), 3)).toEqual(['second_round', 'new_vote'])
  })
  it('second tour et nouveau vote impossibles pendant le vote', () => {
    expect(availableActions(state({ status: 'open' }), 3)).not.toContain('second_round')
    expect(availableActions(state({ status: 'open' }), 3)).not.toContain('new_vote')
  })
})

describe('télécommande', () => {
  it('PageDown : ouvrir, fermer, révéler, étape suivante', () => {
    expect(remoteAction(state({ status: 'lobby' }), 3)).toBe('open')
    expect(remoteAction(state({ status: 'open' }), 3)).toBe('close')
    expect(remoteAction(state({ status: 'closed' }), 3)).toBe('reveal')
    expect(remoteAction(state({ status: 'revealed', revealStep: 0 }), 3)).toBe('reveal_next')
  })
  it('rien pendant le compte à rebours ni après la dernière étape', () => {
    expect(remoteAction(state({ status: 'open', closesAt: iso(T0 + 5000) }), 3)).toBeNull()
    expect(remoteAction(state({ status: 'revealed', revealStep: 3 }), 3)).toBeNull()
  })
  it('fermer demande un second appui, pas les autres actions', () => {
    expect(remoteNeedsConfirm('close')).toBe(true)
    expect(remoteNeedsConfirm('open')).toBe(false)
    expect(remoteNeedsConfirm('reveal_next')).toBe(false)
  })
})

describe('ordre des états reçus', () => {
  it('une étape plus récente remplace, une plus ancienne est ignorée', () => {
    expect(isNewer(state({}, { v: 6 }), state({}, { v: 5 }))).toBe(true)
    expect(isNewer(state({}, { v: 4 }), state({}, { v: 5 }))).toBe(false)
  })
  it('à étape égale, le compteur de bulletins ne recule jamais', () => {
    expect(isNewer(state({}, { total: 12 }), state({}, { total: 11 }))).toBe(true)
    expect(isNewer(state({}, { total: 10 }), state({}, { total: 11 }))).toBe(false)
  })
  it('totaux d’un autre scrutin à version égale : ignorés', () => {
    expect(isNewer(state({ id: 'ev2' }, { total: 50 }), state({}, { total: 3 }))).toBe(false)
  })
})

describe('écran du téléphone', () => {
  it('attente avant l’ouverture', () => {
    expect(phoneScreen(state({ status: 'lobby' }), null, T0)).toBe('waiting')
    expect(phoneScreen(state(null), null, T0)).toBe('waiting')
    expect(phoneScreen({ active: false, serverNow: iso(T0) }, null, T0)).toBe('waiting')
  })
  it('choix pendant le vote, y compris pendant le compte à rebours', () => {
    expect(phoneScreen(state({ status: 'open' }), null, T0)).toBe('choose')
    expect(phoneScreen(state({ status: 'open', closesAt: iso(T0 + 3000) }), null, T0)).toBe('choose')
  })
  it('compte à rebours écoulé : vote terminé', () => {
    expect(phoneScreen(state({ status: 'open', closesAt: iso(T0 - 1) }), null, T0)).toBe('closed')
  })
  it('déjà voté : verrouillé, même après la fermeture', () => {
    const ballot = { eventId: 'ev1', candidateId: 'emma', blank: false }
    expect(phoneScreen(state({ status: 'open' }), ballot, T0)).toBe('voted')
    expect(phoneScreen(state({ status: 'revealed' }), ballot, T0)).toBe('voted')
  })
  it('arrivée après la fermeture : vote terminé', () => {
    expect(phoneScreen(state({ status: 'closed' }), null, T0)).toBe('closed')
  })
  it('second tour : le bulletin du 1er tour ne bloque pas le nouveau scrutin', () => {
    const ballot = { eventId: 'ev1', candidateId: 'emma', blank: false }
    expect(phoneScreen(state({ id: 'ev2', roundNo: 2, parentId: 'ev1', status: 'open' }), ballot, T0)).toBe('choose')
  })
})

describe('compte à rebours', () => {
  it('temps restant selon l’heure serveur', () => {
    expect(closingRemainingMs(state({ status: 'open', closesAt: iso(T0 + 7000) }), T0)).toBe(7000)
    expect(closingRemainingMs(state({ status: 'open', closesAt: iso(T0 - 5) }), T0)).toBe(0)
    expect(closingRemainingMs(state({ status: 'open' }), T0)).toBeNull()
  })
})

describe('ordre des candidats sur le téléphone', () => {
  const list = Array.from({ length: 8 }, (_, i) => cand(`c${i}`, i))
  it('sans mélange : ordre de l’éditeur', () => {
    expect(displayOrder([...list].reverse(), false, 'x').map((c) => c.id)).toEqual(list.map((c) => c.id))
  })
  it('mélange stable pour un même téléphone et un même scrutin', () => {
    const a = displayOrder(list, true, 'participant-1:ev1').map((c) => c.id)
    expect(displayOrder(list, true, 'participant-1:ev1').map((c) => c.id)).toEqual(a)
    expect([...a].sort()).toEqual(list.map((c) => c.id).sort())
  })
  it('mélange différent d’un téléphone à l’autre', () => {
    const seen = new Set(Array.from({ length: 10 }, (_, i) => displayOrder(list, true, `p${i}:ev1`).map((c) => c.id).join()))
    expect(seen.size).toBeGreaterThan(1)
  })
  it('ne modifie pas la liste reçue', () => {
    const copy = [...list]
    displayOrder(list, true, 'p:ev')
    expect(list).toEqual(copy)
  })
})
