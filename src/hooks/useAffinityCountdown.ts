// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Secondes restantes d'un vote Matching, calées sur l'heure du serveur.
// `null` quand il n'y a pas de chrono (infini).

import { useEffect, useState } from 'react'
import { secondsLeft } from '@/lib/affinity/clock'

export function useAffinityCountdown(deadline: string | null | undefined, offsetMs: number): number | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!deadline) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [deadline])

  return secondsLeft(deadline, offsetMs, now)
}
