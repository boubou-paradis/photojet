// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Raccourcis clavier de la régie (onglet Direct) : touche → commande, sans effet de bord.
// Entrée = le bouton principal de l'étape (énigme suivante, lancer la finale, départage).

import type { RegieCommand } from './validation'
import type { RegieView } from './view'

export interface ShortcutContext {
  /** Étape affichée en régie (voir regieStatus). */
  status: string
  round: RegieView['public']['round']
  display: RegieView['public']['display']
  /** Fenêtre du buzz en cours (arbitrage). */
  buzzWindowId: number
}

export function regieShortcut(key: string, c: ShortcutContext): RegieCommand | null {
  const k = key.toLowerCase()
  const { status, round: r } = c
  if (k === ' ' && status === 'ready') return { type: 'startReveal' }
  if (k === ' ' && status === 'paused') return { type: 'resume' }
  if (k === 'p' && ['revealing', 'final_window', 'answering', 'turn', 'ready'].includes(status)) return { type: 'pause' }
  if (k === 'p' && status === 'paused') return { type: 'resume' }
  if (k === 'v' && status === 'answering' && r?.buzz) return { type: 'judge', correct: true, windowId: c.buzzWindowId }
  if (k === 'x' && status === 'answering' && r?.buzz) return { type: 'judge', correct: false, windowId: c.buzzWindowId }
  if (k === 'a' && status === 'answering') return { type: 'cancelBuzz', windowId: c.buzzWindowId }
  if (k === 'l' && (status === 'revealing' || status === 'ready') && r?.mode === 'reveal') return { type: 'revealLetter' }
  if (k === 'c') return { type: 'display', display: c.display === 'standings' ? 'board' : 'standings' }
  if (k === 'n') return { type: 'display', display: c.display === 'black' ? 'board' : 'black' }
  if (k === 'enter') {
    if (status === 'resolved' && r) return { type: 'next', roundKey: r.key }
    if (status === 'final_intro') return { type: 'startFinale' }
    // Égalité en tête (après la finale) : bouton principal = énigme de départage.
    if (status === 'end_tie') return { type: 'tiebreak' }
  }
  return null
}
