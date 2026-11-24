// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// État public de la tombola pour la RÉGIE et le GRAND ÉCRAN (jamais les
// téléphones) : canal privé existant « bingo:<session> », événement
// « tombola » (diffusé par la base, réception seule) + relecture complète
// (/api/bingo/tombola/state) à l'abonnement, au retour sur l'onglet, au
// retour du réseau et toutes les 15 s. Un état plus ancien est ignoré.

import { useCallback, useEffect, useRef, useState } from 'react'
import { clockOffset } from '@/lib/affinity/clock'
import { bingoTopic } from '@/lib/bingo/constants'
import { isNewerTombola, type TombolaPublicState } from '@/lib/bingo/tombola'
import { createClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

const SAFETY_REFRESH_MS = 15_000
/** Distribution des tickets ouverte : compteur de tickets relu toutes les 3 s (lecture mise en cache 1 s). */
const OPEN_REFRESH_MS = 3_000

export interface TombolaChannel {
  state: TombolaPublicState | null
  clockOffsetMs: number
  online: boolean
  refresh: () => Promise<void>
  apply: (next: TombolaPublicState) => void
}

export function useTombolaChannel(
  sessionId: string | null | undefined,
  code: string | null | undefined,
  options: { getClient?: () => SupabaseClient } = {},
): TombolaChannel {
  const getClient = options.getClient ?? createClient
  const [state, setState] = useState<TombolaPublicState | null>(null)
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const [online, setOnline] = useState(true)
  const ref = useRef<TombolaPublicState | null>(null)

  const apply = useCallback((next: TombolaPublicState) => {
    if (!isNewerTombola(next, ref.current)) return
    ref.current = next
    setState(next)
  }, [])

  const refresh = useCallback(async () => {
    if (!code) return
    try {
      const startedAt = Date.now()
      const res = await fetch(`/api/bingo/tombola/state?code=${encodeURIComponent(code)}&t=${startedAt}`, { cache: 'no-store' })
      if (!res.ok) {
        setOnline(false)
        return
      }
      const data = (await res.json()) as TombolaPublicState
      setOnline(true)
      setClockOffsetMs(clockOffset(data.serverNow, startedAt, Date.now()))
      const cur = ref.current
      if (!cur || !data.active || !cur.active || data.tombolaId !== cur.tombolaId || data.v >= cur.v) {
        ref.current = data
        setState(data)
      }
    } catch {
      setOnline(false)
    }
  }, [code])

  useEffect(() => {
    if (!sessionId || !code) return
    const supabase = getClient()
    const channel = supabase
      .channel(`${bingoTopic(sessionId)}`, { config: { private: true } })
      .on('broadcast', { event: 'tombola' }, ({ payload }) => apply(payload as TombolaPublicState))
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') void refresh()
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

  // Un ticket téléphone ne déclenche pas de diffusion : tant que la distribution
  // est ouverte, on relit plus souvent pour que le compteur suive.
  const phonesOpen = !!(state?.active && state.phoneOpen)
  useEffect(() => {
    if (!phonesOpen || !code) return
    const t = setInterval(() => void refresh(), OPEN_REFRESH_MS)
    return () => clearInterval(t)
  }, [phonesOpen, code, refresh])

  return { state, clockOffsetMs, online, refresh, apply }
}
