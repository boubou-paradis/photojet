// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// État public d'AnimaBingo pour la RÉGIE et le GRAND ÉCRAN (jamais les
// téléphones) : canal privé « bingo:<session> » (diffusé par la base, en
// réception seule) + relecture complète (/api/bingo/state) à l'abonnement,
// au retour sur l'onglet, au retour du réseau et toutes les 15 s par
// sécurité. Chaque état porte une version : un état plus ancien est ignoré.
// Un rechargement relit donc l'état exact, sans rien perdre.

import { useCallback, useEffect, useRef, useState } from 'react'
import { clockOffset } from '@/lib/affinity/clock'
import { bingoTopic } from '@/lib/bingo/constants'
import type { BingoPublicState } from '@/lib/bingo/types'
import { createClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

const SAFETY_REFRESH_MS = 15_000

export interface BingoChannel {
  state: BingoPublicState | null
  /** À ajouter à Date.now() pour obtenir l'heure du serveur. */
  clockOffsetMs: number
  /** Canal temps réel abonné. */
  connected: boolean
  /** Navigateur en ligne (dernière relecture réussie ou événement « online »). */
  online: boolean
  refresh: () => Promise<void>
  apply: (next: BingoPublicState) => void
}

/** Plus récent : partie arrêtée / relancée, autre partie, ou version supérieure. */
export function isNewerBingo(next: BingoPublicState, cur: BingoPublicState | null): boolean {
  if (!cur) return true
  if (next.active !== cur.active) return true
  if (!next.active || !cur.active) return (next.active === false && cur.active === false && next.held !== cur.held)
  if (next.gameId !== cur.gameId) return true
  return next.v > cur.v
}

export function useBingoChannel(
  sessionId: string | null | undefined,
  code: string | null | undefined,
  options: { getClient?: () => SupabaseClient } = {},
): BingoChannel {
  const getClient = options.getClient ?? createClient
  const [state, setState] = useState<BingoPublicState | null>(null)
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const [connected, setConnected] = useState(false)
  const [online, setOnline] = useState(true)
  const stateRef = useRef<BingoPublicState | null>(null)

  const apply = useCallback((next: BingoPublicState) => {
    if (!isNewerBingo(next, stateRef.current)) return
    stateRef.current = next
    setState(next)
  }, [])

  const refresh = useCallback(async () => {
    if (!code) return
    try {
      const startedAt = Date.now()
      const res = await fetch(`/api/bingo/state?code=${encodeURIComponent(code)}&t=${startedAt}`, { cache: 'no-store' })
      if (!res.ok) {
        setOnline(false)
        return
      }
      const data = (await res.json()) as BingoPublicState
      setOnline(true)
      setClockOffsetMs(clockOffset(data.serverNow, startedAt, Date.now()))
      const cur = stateRef.current
      // Relecture complète : elle fait foi, sauf diffusion plus récente arrivée pendant la requête.
      if (!cur || !data.active || !cur.active || data.gameId !== cur.gameId || data.v >= cur.v) {
        stateRef.current = data
        setState(data)
      }
    } catch {
      setOnline(false) // réseau coupé : on garde le dernier état connu
    }
  }, [code])

  useEffect(() => {
    if (!sessionId || !code) return
    const supabase = getClient()
    const channel = supabase
      .channel(bingoTopic(sessionId), { config: { private: true } })
      .on('broadcast', { event: 'state' }, ({ payload }) => apply(payload as BingoPublicState))
    channel.subscribe((status) => {
      const ok = status === 'SUBSCRIBED'
      setConnected(ok)
      if (ok) void refresh()
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onOnline = () => {
      setOnline(true)
      void refresh()
    }
    const onOffline = () => setOnline(false)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const timer = setInterval(() => void refresh(), SAFETY_REFRESH_MS)
    const first = setTimeout(() => void refresh(), 0)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      void supabase.removeChannel(channel)
    }
  }, [sessionId, code, apply, refresh, getClient])

  return { state, clockOffsetMs, connected, online, refresh, apply }
}
