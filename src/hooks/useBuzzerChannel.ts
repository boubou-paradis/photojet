// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// État public d'une partie AnimaBuzz, tenu à jour par le canal privé
// « buzzer:<session> » (diffusé par la base, en réception seule).
// Chaque message porte une version : un état plus ancien que celui affiché
// est ignoré (les messages peuvent arriver dans le désordre). On relit
// l'état complet (/api/buzzer/state) à l'abonnement, au retour sur l'onglet,
// au retour du réseau et toutes les 30 s par sécurité : jamais à chaque message.
// Donne aussi le décalage d'horloge avec le serveur.
// `withPrep` : suit aussi les manches préparées (événement « prep » du même
// canal, relu dans la même requête). Sans cette option : comportement inchangé.

import { useCallback, useEffect, useRef, useState } from 'react'
import { buzzerTopic } from '@/lib/buzzer/constants'
import { isNewer } from '@/lib/buzzer/machine'
import { isNewerPrep, type PrepState } from '@/lib/buzzer/prep-flow'
import type { BuzzerState } from '@/lib/buzzer/types'
import { clockOffset } from '@/lib/affinity/clock'
import { createClient } from '@/lib/supabase'

const SAFETY_REFRESH_MS = 30_000

export interface BuzzerChannel {
  state: BuzzerState | null
  /** À ajouter à Date.now() pour obtenir l'heure du serveur. */
  clockOffsetMs: number
  connected: boolean
  /** Relecture immédiate de l'état (après une action, un buzz refusé…). */
  refresh: () => Promise<void>
  /** Applique un état reçu d'une réponse d'action (s'il est plus récent). */
  apply: (next: BuzzerState) => void
  /** Manches préparées (option `withPrep` seulement, sinon null). */
  prep: PrepState | null
  applyPrep: (next: PrepState) => void
}

export function useBuzzerChannel(sessionId: string | null | undefined, options: { withPrep?: boolean } = {}): BuzzerChannel {
  const withPrep = options.withPrep === true
  const [state, setState] = useState<BuzzerState | null>(null)
  const [prep, setPrep] = useState<PrepState | null>(null)
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const [connected, setConnected] = useState(false)
  const stateRef = useRef<BuzzerState | null>(null)
  const prepRef = useRef<PrepState | null>(null)

  const apply = useCallback((next: BuzzerState) => {
    if (!isNewer(next, stateRef.current)) return
    stateRef.current = next
    setState(next)
  }, [])

  const applyPrep = useCallback((next: PrepState) => {
    if (!isNewerPrep(next, prepRef.current)) return
    prepRef.current = next
    setPrep(next)
  }, [])

  const refresh = useCallback(async () => {
    if (!sessionId) return
    try {
      const startedAt = Date.now()
      const res = await fetch(`/api/buzzer/state?session=${encodeURIComponent(sessionId)}${withPrep ? '&prep=1' : ''}`, { cache: 'no-store' })
      if (!res.ok) return
      const { prep: prepData, ...rest } = (await res.json()) as BuzzerState & { prep?: PrepState }
      const data = rest as BuzzerState
      setClockOffsetMs(clockOffset(data.serverNow, startedAt, Date.now()))
      // Même règle que l'état : une diffusion plus récente arrivée pendant la requête est gardée.
      const cur = prepRef.current
      if (prepData && (!cur || !prepData.active || !cur.active || prepData.v >= cur.v || prepData.serverNow > cur.serverNow)) {
        prepRef.current = prepData
        setPrep(prepData)
      }
      // Relecture complète : elle fait foi, même à version égale (partie quittée puis relancée).
      if (!stateRef.current || !data.active || !stateRef.current.active || data.v >= stateRef.current.v || data.serverNow > stateRef.current.serverNow) {
        stateRef.current = data
        setState(data)
      }
    } catch {
      /* réseau instable : on garde le dernier état connu */
    }
  }, [sessionId, withPrep])

  useEffect(() => {
    if (!sessionId) return
    const supabase = createClient()
    let channel = supabase
      .channel(buzzerTopic(sessionId), { config: { private: true } })
      .on('broadcast', { event: 'state' }, ({ payload }) => apply(payload as BuzzerState))
    if (withPrep) channel = channel.on('broadcast', { event: 'prep' }, ({ payload }) => applyPrep(payload as PrepState))
    channel.subscribe((status) => {
        const ok = status === 'SUBSCRIBED'
        setConnected(ok)
        // Abonné (ou réabonné après une coupure) : on rattrape ce qu'on a pu manquer.
        if (ok) void refresh()
      })

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onOnline = () => void refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    const timer = setInterval(() => void refresh(), SAFETY_REFRESH_MS)
    // Première lecture sans attendre l'abonnement (hors du corps de l'effet).
    const first = setTimeout(() => void refresh(), 0)

    return () => {
      clearTimeout(first)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      void supabase.removeChannel(channel)
    }
  }, [sessionId, withPrep, apply, applyPrep, refresh])

  return { state, clockOffsetMs, connected, refresh, apply, prep: withPrep ? prep : null, applyPrep }
}
