'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching - écran du joueur (téléphone). Ne reçoit que ses propres données
// (/api/affinity/me) et l'état public de la partie (ligne sessions).
// Phase 2 : écran d'attente du lobby. Questions, révélation et Top 5 ensuite.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import PhoneShell, { serif } from '@/components/affinity/PhoneShell'
import { findStoredPlayerBySession, forgetPlayer, type StoredAffinityPlayer } from '@/lib/affinity/player-storage'
import type { AffinityPhase } from '@/lib/affinity/types'
import { createClient } from '@/lib/supabase'

interface MeState {
  nickname: string
  table: string | null
  phase: AffinityPhase
}

type Screen = { kind: 'loading' } | { kind: 'over' } | { kind: 'ready'; me: MeState }
type StoredEntry = { code: string; player: StoredAffinityPlayer }

const noopSubscribe = () => () => {}

export default function MatchingPlayPage() {
  const params = useParams()
  const sessionId = String(params.sessionId ?? '')
  const supabase = createClient()

  const [screen, setScreen] = useState<Screen>({ kind: 'loading' })

  // Joueur gardé sur ce téléphone (localStorage). Instantané en texte pour
  // rester stable entre deux rendus ; `null` au rendu serveur, '' si absent.
  const storedRaw = useSyncExternalStore(
    noopSubscribe,
    () => {
      const found = findStoredPlayerBySession(sessionId)
      return found ? JSON.stringify(found) : ''
    },
    () => null,
  )
  const stored = useMemo(() => (storedRaw ? (JSON.parse(storedRaw) as StoredEntry) : null), [storedRaw])

  const refresh = useCallback(async (entry: StoredEntry) => {
    const res = await fetch('/api/affinity/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, playerId: entry.player.playerId, token: entry.player.token }),
    }).catch(() => null)
    if (!res) return // réseau coupé : on garde l'écran actuel
    if (res.status === 403 || res.status === 410) {
      forgetPlayer(entry.code)
      setScreen({ kind: 'over' })
      return
    }
    if (!res.ok) return
    setScreen({ kind: 'ready', me: (await res.json()) as MeState })
  }, [sessionId])

  // Changements de phase : realtime sur la ligne publique de la session, puis
  // relecture de l'état du joueur (jamais les données des autres). La
  // première lecture se fait à l'abonnement.
  useEffect(() => {
    if (!stored) return
    const channel = supabase
      .channel(`affinity-player-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        () => void refresh(stored),
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') void refresh(stored)
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [stored, sessionId, supabase, refresh])

  if (storedRaw === '' || screen.kind === 'over') {
    return (
      <PhoneShell>
        <div className="my-auto text-center">
          <h1 className="text-[26px] font-extrabold leading-tight" style={serif}>
            {screen.kind === 'over' ? 'Cette partie est terminée' : 'Tu n\'es pas encore inscrit'}
          </h1>
          <p className="text-[#9a94b5] mt-3">Rescanne le QR de la soirée pour rejoindre la partie.</p>
        </div>
      </PhoneShell>
    )
  }

  if (screen.kind === 'loading') {
    return (
      <PhoneShell>
        <div className="m-auto"><Loader2 className="h-8 w-8 animate-spin text-[#d4af37]" /></div>
      </PhoneShell>
    )
  }

  const { me } = screen
  return (
    <PhoneShell>
      <div className="my-auto text-center">
        <div className="relative w-[120px] h-20 mx-auto mb-6" aria-hidden="true">
          <i className="absolute top-0 left-0 w-20 h-20 rounded-full border-[3px] border-[#d4af37] motion-safe:animate-pulse" />
          <i className="absolute top-0 left-10 w-20 h-20 rounded-full border-[3px] border-[#8b5cf6] motion-safe:animate-pulse" />
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#86efac] bg-[#86efac]/[.08] border border-[#86efac]/25 rounded-full px-3.5 py-1.5">
          Inscription validée ✓
        </span>
        <h1 className="text-[28px] font-extrabold leading-tight mt-5" style={serif}>
          {me.phase === 'lobby' ? 'Tu es inscrit, la partie va commencer' : 'La partie a commencé'}
        </h1>
        <p className="mt-5 text-[15px] text-[#cfc9e4]">
          Tu joues sous le pseudo <b className="text-[#f4efe3]">{me.nickname}</b>{me.table ? `, table ${me.table}` : ''}.
        </p>
        <p className="mt-2.5 text-[15px] text-[#9a94b5]">Garde cette page ouverte : les questions arrivent ici.</p>
      </div>
    </PhoneShell>
  )
}
