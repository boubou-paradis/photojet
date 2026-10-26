import { describe, expect, it } from 'vitest'
import { countdownTickSecond, voteSoundCue, type VoteStepMark } from '../sounds'

const mark = (patch: Partial<VoteStepMark> = {}): VoteStepMark => ({ eventId: 'ev1', status: 'lobby', revealStep: 0, ...patch })

describe('voteSoundCue', () => {
  it('aucun son à la première lecture (F5)', () => {
    expect(voteSoundCue(null, mark({ status: 'open' }))).toBeNull()
  })

  it('nouveau scrutin : second tour ouvert directement → ouverture ; nouveau vote au lobby → rien', () => {
    expect(voteSoundCue(mark({ status: 'revealed', stepKind: 'tie' }), mark({ eventId: 'ev2', status: 'open' }))).toBe('open')
    expect(voteSoundCue(mark({ status: 'revealed', stepKind: 'winner' }), mark({ eventId: 'ev2', status: 'lobby' }))).toBeNull()
  })

  it('ouverture puis fermeture', () => {
    expect(voteSoundCue(mark(), mark({ status: 'open' }))).toBe('open')
    expect(voteSoundCue(mark({ status: 'open' }), mark({ status: 'closed' }))).toBe('close')
  })

  it('révélation : roulement, puis fanfare pour le gagnant', () => {
    expect(voteSoundCue(mark({ status: 'closed' }), mark({ status: 'revealed', stepKind: 'intro' }))).toBe('drumroll')
    expect(voteSoundCue(mark({ status: 'revealed', revealStep: 0 }), mark({ status: 'revealed', revealStep: 1, stepKind: 'place' }))).toBe('drumroll')
    expect(voteSoundCue(mark({ status: 'revealed', revealStep: 2 }), mark({ status: 'revealed', revealStep: 3, stepKind: 'winner' }))).toBe('winner')
    expect(voteSoundCue(mark({ status: 'revealed', revealStep: 0 }), mark({ status: 'revealed', revealStep: 1, stepKind: 'full' }))).toBe('winner')
    expect(voteSoundCue(mark({ status: 'revealed', revealStep: 0 }), mark({ status: 'revealed', revealStep: 1, stepKind: 'tie' }))).toBe('drumroll')
  })

  it('rien quand l’étape ne bouge pas, recule ou est vide', () => {
    expect(voteSoundCue(mark({ status: 'revealed', revealStep: 2 }), mark({ status: 'revealed', revealStep: 2, stepKind: 'winner' }))).toBeNull()
    expect(voteSoundCue(mark({ status: 'open' }), mark({ status: 'open' }))).toBeNull()
    expect(voteSoundCue(mark({ status: 'revealed', revealStep: 0 }), mark({ status: 'revealed', revealStep: 1, stepKind: 'empty' }))).toBeNull()
    expect(voteSoundCue(mark({ status: 'open' }), mark({ status: 'lobby' }))).toBeNull()
  })
})

describe('countdownTickSecond', () => {
  it('une valeur par seconde entière restante', () => {
    expect(countdownTickSecond(null)).toBeNull()
    expect(countdownTickSecond(0)).toBeNull()
    expect(countdownTickSecond(4200)).toBe(5)
    expect(countdownTickSecond(4000)).toBe(4)
    expect(countdownTickSecond(10)).toBe(1)
  })
})
