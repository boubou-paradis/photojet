// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Statut public d'AnimaBuzz (vraiment en direct ? combien de joueurs,
// de buzzers testés ? derniers inscrits), lu sur /api/buzzer/status.
// N'interroge le serveur que si `enabled` (la ligne sessions indique
// AnimaBuzz lancé) : aucune requête pour les autres jeux. Toutes les 3 s.

import { useEffect, useState } from 'react'

export interface BuzzerLiveStatus {
  live: boolean
  sessionId: string | null
  phase: string | null
  playerCount: number
  testedCount: number
  recent: string[]
}

const OFF: BuzzerLiveStatus = { live: false, sessionId: null, phase: null, playerCount: 0, testedCount: 0, recent: [] }
const POLL_MS = 3000

export function useBuzzerStatus(code: string | undefined, enabled: boolean): BuzzerLiveStatus {
  const [status, setStatus] = useState<BuzzerLiveStatus>(OFF)

  useEffect(() => {
    if (!code || !enabled) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      try {
        const res = await fetch(`/api/buzzer/status?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as Partial<BuzzerLiveStatus>
          if (!cancelled) {
            setStatus({
              live: data.live === true,
              sessionId: data.sessionId ?? null,
              phase: data.phase ?? null,
              playerCount: data.playerCount ?? 0,
              testedCount: data.testedCount ?? 0,
              recent: Array.isArray(data.recent) ? data.recent : [],
            })
          }
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

  // Désactivé : statut « inactif » immédiat, sans attendre une requête.
  return code && enabled ? status : OFF
}
