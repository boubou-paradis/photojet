'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot - téléphone du capitaine : identité de l'équipe et grand
// buzzer. Le buzz est décidé par la base (demimot_buzz, sous verrou) :
// aucun succès optimiste, « À vous ! » n'apparaît qu'une fois accepté.
// Signal de présence toutes les 20 s (capitaine « connecté » sur l'écran).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PhoneScreen } from '@/components/demimot/PhoneScreen'
import '@/components/demimot/demimot.css'
import { useDemiMotChannel } from '@/hooks/useDemiMotChannel'
import { useWakeLock } from '@/hooks/useWakeLock'
import { findCaptainBySession, forgetCaptain, type StoredCaptain } from '@/lib/demimot/captain-storage'
import { DEMIMOT_PING_INTERVAL_MS } from '@/lib/demimot/constants'
import { DEMIMOT_SENT_TIMEOUT_MS, isSending, phoneStatus, type SentBuzz } from '@/lib/demimot/gate'
import type { PhoneStatus, PublicTeam } from '@/lib/demimot/view'
import { createPublicClient } from '@/lib/supabase'

const BUZZ_ERRORS: Record<string, string> = {
  not_captain: 'L’animateur a confié ton équipe à un autre téléphone.',
  paused: 'Partie en pause : attends la reprise.',
  closed: 'Le buzzer est fermé.',
  blocked: 'Ton équipe est bloquée pour cette énigme.',
  no_game: 'Cette partie est terminée.',
}

export default function DemiMotPlayPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = String(params.sessionId ?? '')
  const [captain, setCaptain] = useState<StoredCaptain | null>(null)
  const [missing, setMissing] = useState(false)
  const [revoked, setRevoked] = useState(false)
  const [sent, setSent] = useState<SentBuzz | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const supabase = useMemo(() => createPublicClient(), [])
  const channel = useDemiMotChannel(captain ? sessionId : null, { getClient: createPublicClient })
  const { refresh } = channel
  useWakeLock(true)

  // Identité gardée sur ce téléphone, puis vérification (remplacé ? partie finie ?).
  useEffect(() => {
    const stored = findCaptainBySession(sessionId)
    let cancelled = false
    ;(async () => {
      if (!stored) {
        if (!cancelled) setMissing(true)
        return
      }
      const res = await fetch('/api/demimot/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: stored.sessionId, teamId: stored.teamId, token: stored.token }),
      }).catch(() => null)
      if (cancelled) return
      if (res?.status === 410) {
        forgetCaptain(stored.code)
        router.replace(`/invite/${encodeURIComponent(stored.code)}`)
        return
      }
      if (res?.status === 403) {
        forgetCaptain(stored.code)
        setRevoked(true)
      }
      setCaptain(stored)
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, router])

  // Présence du capitaine (capitaine « connecté » sur l'écran et en régie).
  useEffect(() => {
    if (!captain || revoked) return
    let stopped = false
    const ping = async () => {
      const { data } = await supabase.rpc('demimot_ping', { p_session_id: captain.sessionId, p_team_id: captain.teamId, p_token: captain.token, p_rtt_ms: null })
      if (stopped) return
      if (data && (data as { ok?: boolean }).ok === false) {
        // Plus capitaine (remplacé, ou partie relancée) : on vérifie.
        const res = await fetch('/api/demimot/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: captain.sessionId, teamId: captain.teamId, token: captain.token }),
        }).catch(() => null)
        if (res?.status === 403) setRevoked(true)
        if (res?.status === 410) router.replace(`/invite/${encodeURIComponent(captain.code)}`)
      }
    }
    void ping()
    const timer = setInterval(() => void ping(), DEMIMOT_PING_INTERVAL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [captain, revoked, supabase, router])

  const state = channel.state
  const view = state?.active ? state.view : undefined
  const gate = state?.active ? state.gate : undefined
  const teamId = captain?.teamId ?? null
  const team: PublicTeam | null = view?.teams.find((t) => t.id === teamId) ?? null
  // Numéro de l'équipe (le même que sur l'écran géant et la page de choix).
  const teamNumber = view ? view.teams.findIndex((t) => t.id === teamId) + 1 || undefined : undefined

  // Partie arrêtée par l'animateur (ou autre jeu lancé) : retour au QR de la soirée.
  useEffect(() => {
    if (captain && state && !state.active) router.replace(`/invite/${encodeURIComponent(captain.code)}`)
  }, [captain, state, router])

  // Chrono « À vous ! » : rafraîchi 4 fois par seconde seulement quand il sert.
  const answering = view?.phase === 'answering' && view.round?.buzz?.teamId === teamId
  useEffect(() => {
    if (!answering) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [answering])

  // « Envoi… » ne vaut que pour l'énigme et la fenêtre de buzz où il a été envoyé,
  // et jamais plus de quelques secondes (réseau muet) : le bouton ne reste pas figé.
  const gateWindow = gate?.window ?? null
  const roundKey = view?.round?.key ?? null
  useEffect(() => {
    if (!sent) return
    const t = setTimeout(() => setSent((cur) => (cur === sent ? null : cur)), Math.max(0, sent.at + DEMIMOT_SENT_TIMEOUT_MS - Date.now()))
    return () => clearTimeout(t)
  }, [sent])

  let status: PhoneStatus = phoneStatus(state ?? null, team ? teamId : null)
  if (revoked) status = 'revoked'
  else if (!state) status = 'connecting'
  // L'expiration est faite par le minuteur ci-dessus (qui vide `sent`) : rendu pur, sans horloge.
  else if (status === 'open' && isSending(sent, gateWindow, roundKey, sent?.at ?? 0)) status = 'sent'

  // Vibration quand l'équipe obtient la main.
  const prev = useRef<PhoneStatus | null>(null)
  useEffect(() => {
    if (status === 'accepted' && prev.current !== 'accepted') navigator.vibrate?.([60, 40, 120])
    prev.current = status
  }, [status])

  const buzz = useCallback(async () => {
    if (!captain || !gate || gate.state !== 'open') return
    const win = gate.window
    const mine: SentBuzz = { roundKey, window: win, at: Date.now() }
    setSent(mine)
    setNotice(null)
    navigator.vibrate?.(30)
    const { data, error } = await supabase.rpc('demimot_buzz', { p_session_id: captain.sessionId, p_team_id: captain.teamId, p_token: captain.token, p_window: win })
    const result = (data ?? {}) as { ok?: boolean; reason?: string }
    if (error || !result.ok) {
      setSent((cur) => (cur === mine ? null : cur))
      if (result.reason === 'not_captain') setRevoked(true)
      else if (result.reason && result.reason !== 'taken' && result.reason !== 'stale') setNotice(BUZZ_ERRORS[result.reason] ?? 'Buzz non pris en compte.')
      else if (error) setNotice('Réseau instable : buzz non pris en compte.')
    }
    // Le résultat (la main, ou une autre équipe) arrive par le canal ; relecture par sécurité.
    void refresh()
  }, [captain, gate, roundKey, supabase, refresh])

  if (missing) {
    return (
      <div className="dm">
        <main className="home">
          <div className="home-card">
            <div className="title-3d" style={{ fontSize: 34 }}>À Demi-Mot</div>
            <h2 style={{ marginTop: 22 }}>Équipe introuvable sur ce téléphone</h2>
            <p className="home-note">Scannez à nouveau le QR code affiché sur l’écran pour choisir votre équipe.</p>
          </div>
        </main>
      </div>
    )
  }

  const deadline = answering ? view?.round?.buzz?.deadline ?? null : null
  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - (now + channel.clockOffsetMs)) / 1000)) : null
  const fallbackTeam: PublicTeam = { id: teamId ?? '-', name: captain?.teamName || 'Équipe', color: '#888888', score: 0, connected: false, blocked: false }

  return (
    <div className="dm" data-testid="demimot-play">
      <PhoneScreen
        status={status}
        team={team ?? (status === 'connecting' ? null : fallbackTeam)}
        teamNumber={teamNumber}
        otherTeamName={gate?.teamName ?? undefined}
        secondsLeft={secondsLeft}
        online={channel.connected}
        onBuzz={() => void buzz()}
      />
      {revoked && captain && (
        <p style={{ textAlign: 'center', marginTop: 12 }}>
          <a className="btn" href={`/demimot/join/${encodeURIComponent(captain.code)}`}>Choisir une équipe libre</a>
        </p>
      )}
      {notice && (
        <p className="phone-notice" role="alert" onClick={() => setNotice(null)}>
          {notice}
        </p>
      )}
    </div>
  )
}
