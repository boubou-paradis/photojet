// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Statut public d'AnimaBingo, lu sur /api/bingo/status. N'interroge le serveur
// que si `enabled` (la ligne sessions indique AnimaBingo lancé) : aucune
// requête pour les autres jeux. Toutes les 3 s.
// `present` : la partie existe et aucun autre jeu n'est lancé, même si la
// régie est en panne. Le grand écran la garde alors affichée (« en pause »)
// au lieu de revenir au diaporama : une partie ne disparaît jamais d'un coup.

import { useEffect, useState } from 'react'

export interface BingoLiveStatus {
  live: boolean
  present: boolean
  sessionId: string | null
}

const OFF: BingoLiveStatus = { live: false, present: false, sessionId: null }
const POLL_MS = 3000

export function useBingoStatus(code: string | undefined, enabled: boolean): BingoLiveStatus {
  const [status, setStatus] = useState<BingoLiveStatus>(OFF)

  useEffect(() => {
    if (!code || !enabled) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      try {
        const res = await fetch(`/api/bingo/status?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as Partial<BingoLiveStatus>
          if (!cancelled) setStatus({ live: data.live === true, present: data.present === true, sessionId: data.sessionId ?? null })
        }
      } catch {
        /* réseau instable : on garde le dernier statut connu */
      }
      if (!cancelled) timer = setTimeout(load, POLL_MS)
    }

    void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [code, enabled])

  return code && enabled ? status : OFF
}
