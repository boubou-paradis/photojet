// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// État public d'AnimaVote, tenu à jour par un canal privé diffusé par la base
// (réception seule) :
//  - « vote:<session> » pour les téléphones (étapes, jamais de résultat) ;
//  - « vote-live:<session> » pour l'écran géant et l'animateur (étapes ET
//    totaux à chaque bulletin, selon le mode choisi).
// Chaque message porte une version : un état plus ancien est ignoré. On
// relit l'état complet (`load`) à l'abonnement (le canal privé met ~1 s à
// recevoir après SUBSCRIBED), au retour sur l'onglet, au retour du réseau et
// toutes les 30 s par sécurité. Donne aussi le décalage d'horloge serveur.

import { useCallback, useEffect, useRef, useState } from 'react'
import { voteLiveTopic, voteTopic } from '@/lib/vote/constants'
import { isNewer } from '@/lib/vote/machine'
import type { VoteState } from '@/lib/vote/types'
import { clockOffset } from '@/lib/affinity/clock'
import { createClient } from '@/lib/supabase'

const SAFETY_REFRESH_MS = 30_000
// Rattrapage après l'abonnement : le canal privé ne reçoit qu'au bout d'environ 1 s.
const LATE_REFRESH_MS = 1500

export type VoteAudience = 'phone' | 'screen'

export interface VoteChannel {
  state: VoteState | null
  /** À ajouter à Date.now() pour obtenir l'heure du serveur. */
  clockOffsetMs: number
  connected: boolean
  refresh: () => Promise<void>
  /** Applique un état reçu d'une réponse d'action (s'il est plus récent). */
  apply: (next: VoteState) => void
}

/** Lecture de l'écran géant (sans identité). */
async function loadScreenState(sessionId: string): Promise<VoteState | null> {
  const res = await fetch(`/api/vote/state?session=${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
  return res.ok ? ((await res.json()) as VoteState) : null
}

/**
 * @param load lecture complète pour les téléphones (/api/vote/me, qui donne
 * aussi MON bulletin) ; par défaut, lecture de l'écran géant.
 */
export function useVoteChannel(
  sessionId: string | null | undefined,
  audience: VoteAudience,
  load?: () => Promise<VoteState | null>,
): VoteChannel {
  const [state, setState] = useState<VoteState | null>(null)
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const [connected, setConnected] = useState(false)
  const stateRef = useRef<VoteState | null>(null)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  const apply = useCallback((next: VoteState) => {
    if (!isNewer(next, stateRef.current)) return
    stateRef.current = next
    setState(next)
  }, [])

  const refresh = useCallback(async () => {
    if (!sessionId) return
    try {
      const startedAt = Date.now()
      const data = await (loadRef.current ? loadRef.current() : loadScreenState(sessionId))
      if (!data) return
      setClockOffsetMs(clockOffset(data.serverNow, startedAt, Date.now()))
      // Relecture complète : elle fait foi, même à version égale (vote quitté puis relancé).
      const cur = stateRef.current
      if (!cur || !data.active || !cur.active || data.v >= cur.v || data.serverNow > cur.serverNow) {
        if (cur?.active && data.active && data.v === cur.v && data.event?.id === cur.event?.id && data.total < cur.total) return
        stateRef.current = data
        setState(data)
      }
    } catch {
      /* réseau instable : on garde le dernier état connu */
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const supabase = createClient()
    const topic = audience === 'phone' ? voteTopic(sessionId) : voteLiveTopic(sessionId)
    let late: ReturnType<typeof setTimeout> | undefined
    const channel = supabase
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'state' }, ({ payload }) => apply(payload as VoteState))
      .subscribe((status) => {
        const ok = status === 'SUBSCRIBED'
        setConnected(ok)
        if (ok) {
          void refresh()
          if (late) clearTimeout(late)
          late = setTimeout(() => void refresh(), LATE_REFRESH_MS)
        }
      })

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onOnline = () => void refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    const timer = setInterval(() => void refresh(), SAFETY_REFRESH_MS)
    const first = setTimeout(() => void refresh(), 0)

    return () => {
      clearTimeout(first)
      if (late) clearTimeout(late)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      void supabase.removeChannel(channel)
    }
  }, [sessionId, audience, apply, refresh])

  return { state, clockOffsetMs, connected, refresh, apply }
}
