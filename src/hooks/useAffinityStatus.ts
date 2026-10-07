// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Statut public de Matching (vraiment actif ? combien de joueurs, de
// réponses ?), lu sur /api/affinity/status. N'interroge le serveur que si
// `enabled` (la ligne sessions indique Matching actif) : aucune requête pour
// les autres jeux. Toutes les secondes pendant un vote (compteur de réponses),
// toutes les 3 s sinon. Donne aussi le décalage d'horloge avec le serveur.

import { useEffect, useState } from 'react'
import { clockOffset } from '@/lib/affinity/clock'
import type { AffinityStatus } from '@/lib/affinity/types'

export interface AffinityLiveStatus extends AffinityStatus {
  /** À ajouter à Date.now() pour obtenir l'heure du serveur. */
  clockOffsetMs: number
}

const OFF: AffinityLiveStatus = { live: false, phase: null, playerCount: 0, answeredCount: 0, serverNow: '', clockOffsetMs: 0 }
const FAST_MS = 1000
const SLOW_MS = 3000

export function useAffinityStatus(code: string | undefined, enabled: boolean): AffinityLiveStatus {
  const [status, setStatus] = useState<AffinityLiveStatus>(OFF)

  useEffect(() => {
    if (!code || !enabled) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      let next = SLOW_MS
      try {
        const startedAt = Date.now()
        const res = await fetch(`/api/affinity/status?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as AffinityStatus
          const offset = data.serverNow ? clockOffset(data.serverNow, startedAt, Date.now()) : 0
          if (!cancelled) setStatus({ ...data, clockOffsetMs: offset })
          if (data.phase === 'question') next = FAST_MS
        }
      } catch {
        /* réseau instable : on garde le dernier statut connu */
      }
      if (!cancelled) timer = setTimeout(load, next)
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
