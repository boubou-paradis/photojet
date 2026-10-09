'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz - inscription d'un joueur (téléphone). On y arrive par le QR de
// la session (/invite redirige ici tant qu'AnimaBuzz est en cours).
// Mode individuel : pseudo. Mode équipe : choix dans la liste de
// l'animateur, ou saisie libre s'il n'en a pas prévu.

import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import AnimaBuzzLogo from '@/components/buzzer/AnimaBuzzLogo'
import Buzzer from '@/components/buzzer/Buzzer'
import PhoneFrame from '@/components/buzzer/phone/PhoneFrame'
import { BUZZER_LIMITS } from '@/lib/buzzer/constants'
import { forgetPlayer, readStoredPlayer, storePlayer } from '@/lib/buzzer/player-storage'
import type { BuzzerMode, BuzzerState } from '@/lib/buzzer/types'

type Screen = 'checking' | 'form' | 'closed'

interface JoinResponse {
  error?: string
  suggestion?: string | null
  sessionId?: string
  playerId?: string
  token?: string
  nickname?: string | null
  team?: string | null
  unit?: string
}

export default function BuzzerJoinPage() {
  const params = useParams()
  const router = useRouter()
  const code = String(params.code ?? '')

  const [screen, setScreen] = useState<Screen>('checking')
  const [mode, setMode] = useState<BuzzerMode>('solo')
  const [teams, setTeams] = useState<string[]>([])
  const [nickname, setNickname] = useState('')
  const [team, setTeam] = useState('')
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
        const res = await fetch('/api/buzzer/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: stored.sessionId, playerId: stored.playerId, token: stored.token }),
        }).catch(() => null)
        if (res?.ok) {
          router.replace(`/buzzer/play/${stored.sessionId}`)
          return
        }
        if (res && (res.status === 403 || res.status === 410)) forgetPlayer(code)
      }

      const status = (await fetch(`/api/buzzer/status?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
        .then((r) => r.json())
        .catch(() => null)) as { live?: boolean; sessionId?: string | null } | null
      if (cancelled) return
      // Statut inconnu (réseau, base saturée) : on montre le formulaire, l'inscription
      // dira elle-même s'il n'y a pas de partie. « Pas de partie » seulement si c'est certain.
      if (status?.live === false) {
        setScreen('closed')
        return
      }
      if (status?.sessionId) {
        const state = (await fetch(`/api/buzzer/state?session=${status.sessionId}`, { cache: 'no-store' })
          .then((r) => r.json())
          .catch(() => null)) as BuzzerState | null
        if (cancelled) return
        if (state?.active) {
          setMode(state.mode)
          setTeams(state.teams)
        }
      }
      setScreen('form')
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
      const res = await fetch('/api/buzzer/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'solo' ? { code, nickname } : { code, team }),
      })
      const body = (await res.json().catch(() => ({}))) as JoinResponse
      if (!res.ok || !body.sessionId || !body.playerId || !body.token || !body.unit) {
        setError(body.error ?? 'Inscription impossible, réessaie.')
        setSuggestion(body.suggestion ?? null)
        if (res.status === 409 && !body.suggestion && body.error !== 'La partie est complète.') setScreen('closed')
        return
      }
      storePlayer(code, {
        sessionId: body.sessionId,
        playerId: body.playerId,
        token: body.token,
        unit: body.unit,
        label: body.nickname ?? body.team ?? nickname,
      })
      router.push(`/buzzer/play/${body.sessionId}`)
    } catch {
      setError('Connexion impossible. Vérifie ton réseau et réessaie.')
    } finally {
      setSubmitting(false)
    }
  }

  if (screen === 'checking') {
    return (
      <PhoneFrame>
        <div className="bzp-stage"><Loader2 className="h-8 w-8 animate-spin text-[#d4af37]" /></div>
      </PhoneFrame>
    )
  }

  if (screen === 'closed') {
    return (
      <PhoneFrame>
        <div className="bzp-stage"><Buzzer state="off" size="min(56cqw, 40dvh)" /></div>
        <div className="bzp-cap">
          <h1 className="dim">Aucune partie AnimaBuzz en cours</h1>
          <p>Attends que l’animateur lance la partie, puis rescanne le QR.</p>
          <a href={photosHref} className="bzp-link mt-3">Partager des photos</a>
        </div>
      </PhoneFrame>
    )
  }

  const canSubmit = mode === 'solo' ? nickname.trim().length > 0 : team.trim().length > 0

  return (
    <PhoneFrame>
      <form className="bzp-form" onSubmit={submit}>
        <Buzzer state="off" size="36cqw" />
        <AnimaBuzzLogo variant="small" subtitle size="12.5cqw" />

        {mode === 'solo' ? (
          <>
            <label htmlFor="bz-nick">Ton pseudo</label>
            <input
              id="bz-nick"
              className="bzp-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={BUZZER_LIMITS.nicknameMaxLength}
              autoComplete="nickname"
              autoCapitalize="words"
              enterKeyHint="go"
              placeholder="Luna"
              required
            />
          </>
        ) : teams.length > 0 ? (
          <>
            <span className="lbl" id="bz-team-lbl">Choisis ton équipe</span>
            <div className="bzp-teams" role="group" aria-labelledby="bz-team-lbl">
              {teams.map((t) => (
                <button key={t} type="button" aria-pressed={team === t} onClick={() => setTeam(t)}>{t}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label htmlFor="bz-team">Ton équipe</label>
            <input
              id="bz-team"
              className="bzp-input"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              maxLength={BUZZER_LIMITS.teamMaxLength}
              autoCapitalize="words"
              enterKeyHint="go"
              placeholder="Table 4"
              required
            />
          </>
        )}

        {error && (
          <p className="bzp-error" role="alert">
            {error}
            {suggestion && (
              <> Essaie <button type="button" onClick={() => { setNickname(suggestion); setError(null); setSuggestion(null) }}>{suggestion}</button> ?</>
            )}
          </p>
        )}

        <button type="submit" className="bzp-cta" disabled={submitting || !canSubmit}>
          {submitting ? 'Inscription…' : 'Je joue'}
        </button>
        <a href={photosHref} className="bzp-link">Je veux juste partager des photos</a>
      </form>
    </PhoneFrame>
  )
}
