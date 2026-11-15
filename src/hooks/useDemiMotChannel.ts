// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// État public d'une partie À Demi-Mot, tenu à jour par le canal privé
// « demimot:<session> » (diffusé par la base, en réception seule). Même
// principe qu'AnimaBuzz : chaque message porte une version, un état plus
// ancien que celui affiché est ignoré ; relecture complète
// (/api/demimot/state) à l'abonnement, au retour sur l'onglet, au retour du
// réseau et toutes les 30 s par sécurité. Donne aussi le décalage d'horloge.

import { useCallback, useEffect, useRef, useState } from 'react'
import { clockOffset } from '@/lib/affinity/clock'
import { demimotTopic } from '@/lib/demimot/constants'
import type { DemiMotPublicState } from '@/lib/demimot/gate'
import { createClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

const SAFETY_REFRESH_MS = 30_000

export interface DemiMotChannel {
  state: DemiMotPublicState | null
  /** À ajouter à Date.now() pour obtenir l'heure du serveur. */
  clockOffsetMs: number
  connected: boolean
  refresh: () => Promise<void>
  /** Applique un état reçu d'une réponse d'action (s'il est plus récent). */
  apply: (next: DemiMotPublicState) => void
}

/** Plus récent : autre partie, partie arrêtée/relancée, ou version supérieure. */
export function isNewerDemiMot(next: DemiMotPublicState, cur: DemiMotPublicState | null): boolean {
  if (!cur) return true
  if (next.active !== cur.active) return true
  if (!next.active) return false
  if (next.gameId !== cur.gameId) return true
  return (next.v ?? 0) > (cur.v ?? 0)
}

// Sur /live, passer le client des canaux permanents de la page (voir useBuzzerChannel).
export function useDemiMotChannel(sessionId: string | null | undefined, options: { getClient?: () => SupabaseClient } = {}): DemiMotChannel {
  const getClient = options.getClient ?? createClient
  const [state, setState] = useState<DemiMotPublicState | null>(null)
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const [connected, setConnected] = useState(false)
  const stateRef = useRef<DemiMotPublicState | null>(null)

  const apply = useCallback((next: DemiMotPublicState) => {
    if (!isNewerDemiMot(next, stateRef.current)) return
    stateRef.current = next
    setState(next)
  }, [])

  const refresh = useCallback(async () => {
    if (!sessionId) return
    try {
      const startedAt = Date.now()
      const res = await fetch(`/api/demimot/state?session=${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as DemiMotPublicState
      setClockOffsetMs(clockOffset(data.serverNow, startedAt, Date.now()))
      const cur = stateRef.current
      // Relecture complète : elle fait foi, sauf diffusion plus récente arrivée pendant la requête.
      if (!cur || !data.active || !cur.active || data.gameId !== cur.gameId || (data.v ?? 0) >= (cur.v ?? 0)) {
        stateRef.current = data
        setState(data)
      }
    } catch {
      /* réseau instable : on garde le dernier état connu */
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const supabase = getClient()
    const channel = supabase
      .channel(demimotTopic(sessionId), { config: { private: true } })
      .on('broadcast', { event: 'state' }, ({ payload }) => apply(payload as DemiMotPublicState))
    channel.subscribe((status) => {
      const ok = status === 'SUBSCRIBED'
      setConnected(ok)
      if (ok) void refresh()
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
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      void supabase.removeChannel(channel)
    }
  }, [sessionId, apply, refresh, getClient])

  return { state, clockOffsetMs, connected, refresh, apply }
}
