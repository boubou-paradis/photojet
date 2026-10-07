'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching - inscription d'un joueur (téléphone). On y arrive par le QR de la
// session (/invite redirige ici tant que Matching est en cours).

import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import PhoneShell, { serif } from '@/components/affinity/PhoneShell'
import { AFFINITY_LIMITS } from '@/lib/affinity/constants'
import { forgetPlayer, readStoredPlayer, storePlayer } from '@/lib/affinity/player-storage'
import type { AffinityStatus } from '@/lib/affinity/types'

type Screen = 'checking' | 'form' | 'closed'

export default function MatchingJoinPage() {
  const params = useParams()
  const router = useRouter()
  const code = String(params.code ?? '')

  const [screen, setScreen] = useState<Screen>('checking')
  const [nickname, setNickname] = useState('')
  const [table, setTable] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const photosHref = `/invite/${encodeURIComponent(code)}?photos=1`

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Déjà inscrit sur ce téléphone : on reprend directement la partie.
      const stored = readStoredPlayer(code)
      if (stored) {
        const res = await fetch('/api/affinity/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: stored.sessionId, playerId: stored.playerId, token: stored.token }),
        }).catch(() => null)
        if (res?.ok) {
          router.replace(`/matching/play/${stored.sessionId}`)
          return
        }
        if (res && (res.status === 403 || res.status === 410)) forgetPlayer(code)
      }

      const status = (await fetch(`/api/affinity/status?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
        .then((r) => r.json())
        .catch(() => null)) as AffinityStatus | null
      if (cancelled) return
      setScreen(status?.live && status.phase !== 'finished' ? 'form' : 'closed')
    })()
    return () => {
      cancelled = true
    }
  }, [code, router])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuggestion(null)
    try {
      const res = await fetch('/api/affinity/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, nickname, table, consent }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        suggestion?: string | null
        sessionId?: string
        playerId?: string
        token?: string
        nickname?: string
      }
      if (!res.ok || !body.sessionId || !body.playerId || !body.token) {
        setError(body.error ?? 'Inscription impossible, réessaie.')
        setSuggestion(body.suggestion ?? null)
        if (res.status === 409 && !body.suggestion) setScreen('closed')
        return
      }
      storePlayer(code, { sessionId: body.sessionId, playerId: body.playerId, token: body.token, nickname: body.nickname ?? nickname })
      router.push(`/matching/play/${body.sessionId}`)
    } catch {
      setError('Connexion impossible. Vérifie ton réseau et réessaie.')
    } finally {
      setSubmitting(false)
    }
  }

  if (screen === 'checking') {
    return (
      <PhoneShell>
        <div className="m-auto"><Loader2 className="h-8 w-8 animate-spin text-[#d4af37]" /></div>
      </PhoneShell>
    )
  }

  if (screen === 'closed') {
    return (
      <PhoneShell>
        <div className="my-auto text-center">
          <h1 className="text-[26px] font-extrabold leading-tight" style={serif}>Aucune partie Matching en cours</h1>
          <p className="text-[#9a94b5] mt-3">Attends que l&apos;animateur lance la partie, puis rescanne le QR.</p>
        </div>
        <a href={photosHref} className="block text-center text-sm text-[#9a94b5] underline underline-offset-4">
          Partager des photos
        </a>
      </PhoneShell>
    )
  }

  return (
    <PhoneShell>
      <form onSubmit={submit} className="flex-1 flex flex-col">
        <h1 className="text-[28px] font-extrabold leading-tight mt-7" style={serif}>Découvrez vos points communs</h1>
        <p className="text-[15px] text-[#9a94b5] mt-2.5">
          Réponds aux questions comme tu veux. À la fin, tu verras qui a répondu comme toi.
        </p>

        <label htmlFor="aff-nickname" className="block text-sm font-semibold mt-6 mb-1.5">Ton pseudo</label>
        <input
          id="aff-nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={AFFINITY_LIMITS.nicknameMaxLength}
          autoComplete="nickname"
          required
          className="w-full text-[17px] bg-white/[.06] border border-white/[.14] rounded-[14px] px-4 py-3.5 focus:outline-none focus:border-[#d4af37]"
        />

        <label htmlFor="aff-table" className="block text-sm font-semibold mt-5 mb-1.5">
          Ta table <span className="font-normal text-[#9a94b5]">(facultatif)</span>
        </label>
        <input
          id="aff-table"
          value={table}
          onChange={(e) => setTable(e.target.value)}
          maxLength={AFFINITY_LIMITS.tableMaxLength}
          placeholder="Ex. 8"
          inputMode="text"
          className="w-full text-[17px] bg-white/[.06] border border-white/[.14] rounded-[14px] px-4 py-3.5 placeholder:text-[#9a94b5]/60 focus:outline-none focus:border-[#d4af37]"
        />

        <label className="flex gap-3 mt-5 text-sm leading-snug text-[#cfc9e4] cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="flex-none w-6 h-6 mt-0.5 accent-[#d4af37]"
          />
          <span>
            J&apos;accepte d&apos;apparaître dans le Top 5 des autres participants
            <span className="block text-[12.5px] text-[#9a94b5] mt-1">Facultatif. Tu joues et tu reçois tes résultats dans tous les cas.</span>
          </span>
        </label>

        {error && (
          <div className="mt-5 text-sm text-orange-300" role="alert">
            {error}
            {suggestion && (
              <button type="button" onClick={() => { setNickname(suggestion); setError(null); setSuggestion(null) }} className="block mt-2 text-[#f4d03f] font-semibold underline underline-offset-4">
                Prendre « {suggestion} »
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-auto pt-6 w-full"
        >
          <span className="flex items-center justify-center gap-2 w-full text-[18px] font-extrabold text-[#0a0a14] rounded-2xl py-[18px] bg-gradient-to-b from-[#f4d03f] to-[#d4af37]">
            {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
            Rejoindre la partie
          </span>
        </button>
        <a href={photosHref} className="block text-center mt-3.5 text-sm text-[#9a94b5] underline underline-offset-4">
          Je veux juste partager des photos
        </a>
      </form>
    </PhoneShell>
  )
}
