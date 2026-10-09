'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz - le buzzer du joueur (téléphone).
// Équité : au toucher (pointerdown, pas click), la requête de buzz part
// D'ABORD, directement vers la base (fonction buzzer_buzz, sans passer par
// Vercel), puis l'animation locale démarre. Le rang n'est affiché qu'une
// fois renvoyé par le serveur. Connexion gardée chaude par un ping toutes
// les 20 s. Reprise après rechargement, coupure ou veille : /api/buzzer/me.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Buzzer, { type BuzzerVisualState } from '@/components/buzzer/Buzzer'
import PhoneFrame from '@/components/buzzer/phone/PhoneFrame'
import { useBuzzerChannel } from '@/hooks/useBuzzerChannel'
import { useWakeLock } from '@/hooks/useWakeLock'
import { BUZZER_PING_INTERVAL_MS } from '@/lib/buzzer/constants'
import { phoneView, windowEndsAt, type MyBuzz, type PhoneScreen } from '@/lib/buzzer/machine'
import { findStoredPlayerBySession, forgetPlayer, type StoredBuzzerPlayer } from '@/lib/buzzer/player-storage'
import type { BuzzerActiveState, BuzzerMe, BuzzResult } from '@/lib/buzzer/types'
import { createClient } from '@/lib/supabase'

type Gone = { title: string; text: string }

interface RoundBuzz extends MyBuzz {
  roundNo: number
}

/** Refus local d'un buzz (trop tard, bloqué) pour la manche et la tentative en cours. */
interface Rejection {
  roundNo: number
  attempt: number
  screen: 'late' | 'blocked'
}

const vibrate = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* non supporté : silencieux */
  }
}

const noopSubscribe = () => () => {}

const formatGap = (ms: number) => `${(ms / 1000).toFixed(2).replace('.', ',')} s`
const rankLabel = (rank: number) => (rank === 1 ? '1er' : `${rank}e`)

export default function BuzzerPlayPage() {
  const params = useParams()
  const sessionId = String(params.sessionId ?? '')

  // Joueur gardé sur ce téléphone (lu côté client seulement ; chaîne stable pour React).
  const storedJson = useSyncExternalStore(
    noopSubscribe,
    () => {
      const found = findStoredPlayerBySession(sessionId)
      return found ? JSON.stringify({ ...found.player, code: found.code }) : ''
    },
    () => null,
  )
  const player = useMemo<(StoredBuzzerPlayer & { code: string }) | null>(() => (storedJson ? JSON.parse(storedJson) : null), [storedJson])
  const [meError, setMeError] = useState<Gone | null>(null)
  const [tested, setTested] = useState(false)
  const [myBuzz, setMyBuzz] = useState<RoundBuzz | null>(null)
  const [rejection, setRejection] = useState<Rejection | null>(null)
  const [sending, setSending] = useState(false)
  const [, setTick] = useState(0)

  const channel = useBuzzerChannel(player ? sessionId : null)
  const { refresh, apply } = channel
  const state = channel.state?.active ? channel.state : null

  const buzzerRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)
  const rttRef = useRef<number | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // ---------- Identité et reprise ----------
  const loadMe = useCallback(async (stored: StoredBuzzerPlayer) => {
    try {
      const res = await fetch('/api/buzzer/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: stored.sessionId, playerId: stored.playerId, token: stored.token }),
      })
      const body = (await res.json().catch(() => ({}))) as Partial<BuzzerMe> & { error?: string }
      if (res.status === 403 || res.status === 410) {
        setMeError({ title: res.status === 410 ? 'La partie est terminée' : 'Tu ne fais plus partie du jeu', text: body.error ?? '' })
        return
      }
      if (!res.ok || !body.state) return
      setTested(body.tested === true)
      apply(body.state)
      if (body.state.active && body.myRound) setMyBuzz({ ...body.myRound, roundNo: body.state.roundNo })
    } catch {
      /* réseau : le canal et la prochaine relecture rattraperont */
    }
  }, [apply])

  useEffect(() => {
    if (player) void loadMe(player)
  }, [player, loadMe])

  // Fin de partie : pas d'inscription sur ce téléphone, joueur refusé, ou partie quittée par l'animateur.
  const gone: Gone | null =
    storedJson === '' ? { title: 'Rejoins la partie', text: 'Scanne le QR code affiché sur l’écran géant.' }
    : meError ?? (channel.state && !channel.state.active ? { title: 'La partie est terminée', text: 'Merci d’avoir joué !' } : null)

  const isGone = gone !== null
  useEffect(() => {
    if (isGone && player) forgetPlayer(player.code)
  }, [isGone, player])

  // J'avais la main et elle est passée à un autre : je relis ma place (bloqué ou non).
  const lastPriority = useRef<string | null>(null)
  useEffect(() => {
    if (!state || !player) return
    const now = state.priority?.unit ?? null
    if (lastPriority.current === player.unit && now !== player.unit && state.phase !== 'closed') void loadMe(player)
    lastPriority.current = now
  }, [state, player, loadMe])

  // ---------- Confort : écran allumé, vibration à l'ouverture, ping ----------
  useWakeLock(!!player && !isGone)

  const lastPhase = useRef<string | null>(null)
  useEffect(() => {
    if (!state) return
    if (state.phase === 'open' && lastPhase.current !== 'open') vibrate(20)
    lastPhase.current = state.phase
  }, [state])

  useEffect(() => {
    if (!player || isGone) return
    let cancelled = false
    const ping = async () => {
      const started = performance.now()
      try {
        await supabase.rpc('buzzer_ping', { p_session_id: player.sessionId, p_player_id: player.playerId, p_token: player.token, p_rtt_ms: rttRef.current })
        if (!cancelled) rttRef.current = Math.round(performance.now() - started)
      } catch {
        /* réseau instable : réessayé au prochain ping */
      }
    }
    void ping()
    const timer = setInterval(ping, BUZZER_PING_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [player, isGone, supabase])

  // Fin de la fenêtre de buzz : l'écran passe de « ouvert » à « trop tard » à l'heure serveur.
  useEffect(() => {
    if (!state || state.phase !== 'buzzed') return
    const end = windowEndsAt(state)
    if (end === null) return
    const wait = end - (Date.now() + channel.clockOffsetMs)
    if (wait < 0) return
    const timer = setTimeout(() => setTick((t) => t + 1), wait + 50)
    return () => clearTimeout(timer)
  }, [state, channel.clockOffsetMs])

  // ---------- Le buzz ----------
  const sendBuzz = useCallback(async (current: BuzzerActiveState) => {
    if (!player) return
    let result: BuzzResult | null = null
    // Renvoi du MÊME buzz en cas de coupure : le serveur redonne le même rang.
    for (let attempt = 0; attempt < 3 && !result; attempt++) {
      const { data, error } = await supabase.rpc('buzzer_buzz', { p_session_id: player.sessionId, p_player_id: player.playerId, p_token: player.token })
      if (!error && data) result = data as BuzzResult
      else await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
    }
    sendingRef.current = false
    setSending(false)
    if (!result) {
      void refresh()
      return
    }
    if (result.ok && result.kind === 'test') {
      setTested(true)
      vibrate(40)
      return
    }
    if (result.ok) {
      setMyBuzz({ rank: result.rank, gapMs: result.gapMs, status: result.first ? 'priority' : 'queued', attempt: current.attempt, roundNo: current.roundNo })
      vibrate(result.first ? [80, 60, 180] : 40)
      return
    }
    if (result.reason === 'too_late' || result.reason === 'closed') setRejection({ roundNo: current.roundNo, attempt: current.attempt, screen: 'late' })
    else if (result.reason === 'blocked') setRejection({ roundNo: current.roundNo, attempt: current.attempt, screen: 'blocked' })
    else if (result.reason === 'removed' || result.reason === 'unknown_player' || result.reason === 'no_game') void loadMe(player)
    void refresh()
  }, [player, supabase, refresh, loadMe])

  const serverNow = Date.now() + channel.clockOffsetMs
  let view = state && player
    ? phoneView(state, { unit: player.unit, tested, myBuzz: myBuzz && myBuzz.roundNo === state.roundNo ? myBuzz : null }, serverNow)
    : null
  if (view && state && rejection && rejection.roundNo === state.roundNo && rejection.attempt === state.attempt && (view.screen === 'open' || view.screen === 'late')) {
    view = { screen: rejection.screen }
  }

  const canPress = view?.screen === 'open' || view?.screen === 'test'

  function onPress(e: React.PointerEvent) {
    e.preventDefault()
    if (!canPress || !state || sendingRef.current) return
    sendingRef.current = true
    // 1. La requête part tout de suite…
    void sendBuzz(state)
    // 2. …puis le retour local, sans attendre le serveur.
    const el = buzzerRef.current
    if (el) {
      el.classList.remove('is-press')
      void el.offsetWidth
      el.classList.add('is-press')
      setTimeout(() => el.classList.remove('is-press'), 170)
    }
    vibrate(30)
    if (view?.screen === 'open') setSending(true)
  }

  // ---------- Rendu ----------
  const me = player?.label ?? null

  if (gone) {
    return (
      <PhoneFrame me={me}>
        <div className="bzp-stage"><Buzzer state="late" size="min(56cqw, 40dvh)" /></div>
        <div className="bzp-cap">
          <h1 className="dim">{gone.title}</h1>
          {gone.text && <p>{gone.text}</p>}
          {player && <a href={`/invite/${encodeURIComponent(player.code)}?photos=1`} className="bzp-link mt-3">Partager des photos</a>}
        </div>
      </PhoneFrame>
    )
  }

  if (!state || !view) {
    return (
      <PhoneFrame me={me}>
        <div className="bzp-stage"><Loader2 className="h-8 w-8 animate-spin text-[#d4af37]" /></div>
      </PhoneFrame>
    )
  }

  const team = state.mode === 'team'
  const screen: PhoneScreen | 'sent' = sending ? 'sent' : view.screen
  const copy = screenCopy(screen, { team, rank: view.rank, gapMs: view.gapMs, leader: view.leader, reopened: state.attempt > 1 })

  return (
    <PhoneFrame me={me}>
      <span className={`bzp-pill ${copy.pill[0]}`} role="status"><i />{copy.pill[1]}</span>
      <div className="bzp-stage">
        <Buzzer ref={buzzerRef} state={copy.buzzer} label={copy.label} size="min(72cqw, 44dvh)" />
        <div
          className="bzp-hit"
          role="button"
          tabIndex={canPress ? 0 : -1}
          aria-label={canPress ? 'Buzzer' : 'Buzzer inactif'}
          aria-disabled={!canPress}
          onPointerDown={onPress}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && canPress && state) {
              e.preventDefault()
              onPress(e as unknown as React.PointerEvent)
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      <div className="bzp-cap" aria-live="polite">
        <h1 className={copy.tone}>{copy.title}</h1>
        <p dangerouslySetInnerHTML={{ __html: copy.text }} />
      </div>
    </PhoneFrame>
  )
}

function screenCopy(
  s: PhoneScreen | 'sent',
  ctx: { team: boolean; rank?: number; gapMs?: number; leader?: string; reopened: boolean },
): { buzzer: BuzzerVisualState; label?: string; pill: [string, string]; title: string; tone: '' | 'gold' | 'dim'; text: string } {
  const leader = ctx.leader ? escapeHtml(ctx.leader) : 'le premier'
  switch (s) {
    case 'paused':
      return { buzzer: 'off', pill: ['', 'Pause'], title: 'Partie en pause', tone: 'dim', text: 'L’animateur revient dans un instant.' }
    case 'lobby':
      return { buzzer: 'off', pill: ['gold', 'Inscrit'], title: ctx.team ? 'Ton équipe est inscrite !' : 'Tu es inscrit !', tone: 'gold', text: 'Prépare-toi, la partie va commencer.' }
    case 'test':
      return { buzzer: 'test', pill: ['gold', 'Test des buzzers'], title: 'Teste ton buzzer', tone: '', text: 'Appuie une fois sur le buzzer.' }
    case 'tested':
      return { buzzer: 'tested', pill: ['gold', 'Test des buzzers'], title: 'Ton buzzer fonctionne', tone: 'gold', text: 'Attends le début de la partie.' }
    case 'waiting':
      return { buzzer: 'off', pill: ['', 'Buzzers fermés'], title: 'Prépare-toi', tone: 'dim', text: 'L’animateur va ouvrir les buzzers.' }
    case 'open':
      return { buzzer: 'open', pill: ['on', ctx.reopened ? 'Buzzers réouverts' : 'Buzzers ouverts'], title: ctx.reopened ? 'Buzzers réouverts' : 'À toi de jouer', tone: '', text: 'Appuie n’importe où sur le buzzer.' }
    case 'sent':
      return { buzzer: 'sent', pill: ['on', 'Buzz envoyé'], title: 'Buzz envoyé', tone: '', text: 'On vérifie qui était le plus rapide…' }
    case 'first':
      return { buzzer: 'win', label: '1er', pill: ['gold', '1er buzz'], title: ctx.team ? 'Ton équipe est 1re !' : 'Tu es premier !', tone: 'gold', text: 'Réponds à voix haute.' }
    case 'rank': {
      const rank = ctx.rank ?? 2
      const gap = ctx.gapMs !== undefined ? `<b>+${formatGap(ctx.gapMs)}</b> derrière ${leader}. ` : ''
      const hint = rank === 2 ? `Si ${leader} se trompe, c’est à toi.` : 'Reste prêt, la main peut tourner.'
      return { buzzer: 'rank', label: rankLabel(rank), pill: ['', 'Dans la file'], title: ctx.team ? `Ton équipe est ${rankLabel(rank)}` : `Tu es ${rankLabel(rank)}`, tone: '', text: gap + hint }
    }
    case 'late':
      return { buzzer: 'late', pill: ['', 'Buzzers fermés'], title: 'Trop tard !', tone: 'dim', text: 'Attends la prochaine manche.' }
    case 'blocked':
      return { buzzer: 'wrong', pill: ['amber', 'Réponse donnée'], title: 'Réponse donnée', tone: 'dim', text: 'Tu ne peux plus buzzer pour cette manche.' }
    case 'won':
      return { buzzer: 'win', label: '✓', pill: ['gold', 'Bonne réponse'], title: 'Bravo, c’est gagné !', tone: 'gold', text: 'Prépare-toi pour la manche suivante.' }
    case 'done':
      return { buzzer: 'off', pill: ['', 'Manche terminée'], title: 'Manche terminée', tone: 'dim', text: 'Prépare-toi pour la suivante.' }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
}
