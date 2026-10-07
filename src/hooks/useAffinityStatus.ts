// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Statut public de Matching (vraiment actif ? combien de joueurs ?), lu sur
// /api/affinity/status. N'interroge le serveur que si `enabled` (la ligne
// sessions indique Matching actif) : aucune requête pour les autres jeux.

import { useEffect, useState } from 'react'
import type { AffinityStatus } from '@/lib/affinity/types'

const OFF: AffinityStatus = { live: false, phase: null, playerCount: 0, answeredCount: 0 }
const POLL_MS = 3000

export function useAffinityStatus(code: string | undefined, enabled: boolean): AffinityStatus {
  const [status, setStatus] = useState<AffinityStatus>(OFF)

  useEffect(() => {
    if (!code || !enabled) return

    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/affinity/status?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as AffinityStatus
        if (!cancelled) setStatus(data)
      } catch {
        /* réseau instable : on garde le dernier statut connu */
      }
    }

    void load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [code, enabled])

  // Désactivé : statut « inactif » immédiat, sans attendre une requête.
  return code && enabled ? status : OFF
}
