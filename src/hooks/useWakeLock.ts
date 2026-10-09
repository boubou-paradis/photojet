// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Écran maintenu allumé pendant la partie (Wake Lock). Demandé quand
// `active`, redemandé au retour sur l'onglet (le navigateur le relâche quand
// l'onglet est masqué), relâché à la sortie. Non supporté ou refusé :
// silencieux, ça ne bloque jamais le jeu.

import { useEffect } from 'react'

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

interface NavigatorWithWakeLock {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const nav = navigator as Navigator & NavigatorWithWakeLock
    if (!nav.wakeLock) return

    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    const request = async () => {
      try {
        const lock = await nav.wakeLock!.request('screen')
        if (cancelled) void lock.release().catch(() => {})
        else sentinel = lock
      } catch {
        /* refusé (batterie faible, onglet masqué…) : sans conséquence */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}
