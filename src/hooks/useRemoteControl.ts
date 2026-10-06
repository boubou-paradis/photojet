// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Pilotage des écrans animateur par télécommande de présentation ("clicker").
// Ces télécommandes simulent des touches clavier : on n'écoute que PageDown
// (avancer) et PageUp (reculer/pause). Jamais Échap, F5, Alt, P, Shift, flèches,
// Espace ni Entrée. La lettre B est reconnue seulement si une page fournit
// `onSecondary` (inactive en v1).
//
// Règles : aucun écouteur n'existe hors partie (`active` faux) → PageDown/PageUp
// défilent normalement et rien n'est jamais bloqué par preventDefault.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

const SWITCH_KEY = 'animajet-remote-control'
const DEBOUNCE_MS = 400   // anti double appui
const PHASE_LOCK_MS = 600 // verrou après tout changement de phase (ex. révélation automatique)

// Résultat d'un handler : rien, ou un nombre de ms de verrou supplémentaire
// (ex. décélération de la roue pendant laquelle aucun appui ne doit passer).
type RemoteAction = () => void | number | Promise<void | number>

interface RemoteControlOptions {
  /** Partie lancée ET interrupteur ON ET partie non terminée. Faux → aucun écouteur. */
  active: boolean
  /** Identifie la phase du jeu ; tout changement verrouille brièvement les appuis. */
  phase: string
  /** Modale maison ouverte (les modales n'ont pas de role="dialog"). */
  isBlocked?: () => boolean
  onNext?: RemoteAction
  onPrev?: RemoteAction
  onSecondary?: RemoteAction
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el.closest('[contenteditable=""],[contenteditable="true"]')) return true
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
}

export function useRemoteControl({ active, phase, isBlocked, onNext, onPrev, onSecondary }: RemoteControlOptions) {
  // Derniers handlers/états committés : jamais de closure périmée dans l'écouteur.
  const latest = useRef({ isBlocked, onNext, onPrev, onSecondary })
  useLayoutEffect(() => {
    latest.current = { isBlocked, onNext, onPrev, onSecondary }
  })

  const lockUntil = useRef(0)
  const busy = useRef(false)

  useEffect(() => {
    lockUntil.current = Math.max(lockUntil.current, Date.now() + PHASE_LOCK_MS)
  }, [phase])

  useEffect(() => {
    if (!active) return

    const run = async (action: RemoteAction) => {
      busy.current = true
      try {
        const extra = await action()
        if (typeof extra === 'number') lockUntil.current = Math.max(lockUntil.current, Date.now() + extra)
      } catch (err) {
        console.error('Télécommande : erreur dans l\'action', err)
      } finally {
        busy.current = false
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return

      const { isBlocked: blocked, onNext: next, onPrev: prev, onSecondary: second } = latest.current
      let action: RemoteAction | undefined
      if (e.key === 'PageDown') action = next ?? (() => {})
      else if (e.key === 'PageUp') action = prev ?? (() => {})
      else if (e.key === 'b' || e.key === 'B') action = second
      if (!action) return // touche non gérée (ou B inactive) : on ne la touche pas

      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return
      if (document.querySelector('[role="dialog"],[aria-modal="true"]') || blocked?.()) return

      // Partie en cours : la touche est à nous (PageDown/PageUp ne doivent pas défiler la page).
      e.preventDefault()
      if (e.repeat) return
      const now = Date.now()
      if (busy.current || now < lockUntil.current) return
      lockUntil.current = now + DEBOUNCE_MS
      void run(action)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])
}

// Interrupteur ON/OFF mémorisé (OFF par défaut). Store externe : pas de mismatch
// d'hydratation (snapshot serveur = OFF) et synchronisé entre onglets.
let memorySwitch = false // repli si localStorage est indisponible
const switchListeners = new Set<() => void>()

function readSwitch(): boolean {
  try {
    return window.localStorage.getItem(SWITCH_KEY) === 'on'
  } catch {
    return memorySwitch
  }
}

function subscribeSwitch(listener: () => void) {
  switchListeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    switchListeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useRemoteSwitch(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribeSwitch, readSwitch, () => false)

  const set = useCallback((value: boolean) => {
    memorySwitch = value
    try {
      window.localStorage.setItem(SWITCH_KEY, value ? 'on' : 'off')
    } catch { /* non mémorisé : valable jusqu'au rechargement */ }
    switchListeners.forEach((l) => l())
  }, [])

  return [on, set]
}

// true tant que la fenêtre a le focus clavier (les touches de la télécommande
// vont à la fenêtre active : après l'ouverture de /live, il faut recliquer ici).
export function useWindowFocus(): boolean {
  const [focused, setFocused] = useState(true)

  useEffect(() => {
    const update = () => setFocused(document.hasFocus())
    update()
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    return () => {
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
    }
  }, [])

  return focused
}
