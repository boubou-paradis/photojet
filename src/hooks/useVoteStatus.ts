// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Statut public d'AnimaVote (vraiment en direct ?), lu sur /api/vote/status.
// N'interroge le serveur que si `enabled` (la ligne sessions indique
// AnimaVote lancé) : aucune requête pour les autres jeux. Toutes les 3 s.

import { useEffect, useState } from 'react'

export interface VoteLiveStatus {
  live: boolean
  sessionId: string | null
}

const OFF: VoteLiveStatus = { live: false, sessionId: null }
const POLL_MS = 3000

export function useVoteStatus(code: string | undefined, enabled: boolean): VoteLiveStatus {
  const [status, setStatus] = useState<VoteLiveStatus>(OFF)

  useEffect(() => {
    if (!code || !enabled) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      try {
        const res = await fetch(`/api/vote/status?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as Partial<VoteLiveStatus>
          if (!cancelled) setStatus({ live: data.live === true, sessionId: data.sessionId ?? null })
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
