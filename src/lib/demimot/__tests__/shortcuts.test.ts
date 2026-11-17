// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Raccourcis de la régie : Entrée doit agir à chaque étape où un bouton principal l'affiche.
import { describe, expect, it } from 'vitest'
import { regieShortcut, type ShortcutContext } from '../shortcuts'

const round = { key: 'finale-1-3', mode: 'reveal', buzz: null } as unknown as ShortcutContext['round']
const ctx = (status: string, extra: Partial<ShortcutContext> = {}): ShortcutContext => ({ status, round, display: 'board', buzzWindowId: 7, ...extra })

describe('touche Entrée en régie', () => {
  it('énigme terminée (finale comprise) → énigme suivante / fin de partie', () => {
    expect(regieShortcut('Enter', ctx('resolved'))).toEqual({ type: 'next', roundKey: 'finale-1-3' })
  })
  it('égalité en tête après la finale → énigme de départage', () => {
    expect(regieShortcut('Enter', ctx('end_tie'))).toEqual({ type: 'tiebreak' })
  })
  it('présentation de la finale → lancer la finale', () => {
    expect(regieShortcut('Enter', ctx('final_intro', { round: null }))).toEqual({ type: 'startFinale' })
  })
  it('sans effet pendant le jeu et au podium (Nouvelle partie demande une confirmation)', () => {
    for (const s of ['ready', 'revealing', 'final_window', 'answering', 'paused', 'podium', 'waiting']) expect(regieShortcut('Enter', ctx(s))).toBeNull()
  })
})

describe('autres raccourcis inchangés', () => {
  it('Espace, V, X, A, C', () => {
    expect(regieShortcut(' ', ctx('ready'))).toEqual({ type: 'startReveal' })
    const buzzing = ctx('answering', { round: { ...round!, buzz: { teamId: 't', deadline: 1, totalMs: 1 } } })
    expect(regieShortcut('v', buzzing)).toEqual({ type: 'judge', correct: true, windowId: 7 })
    expect(regieShortcut('X', buzzing)).toEqual({ type: 'judge', correct: false, windowId: 7 })
    expect(regieShortcut('a', buzzing)).toEqual({ type: 'cancelBuzz', windowId: 7 })
    expect(regieShortcut('c', ctx('resolved'))).toEqual({ type: 'display', display: 'standings' })
  })
})
