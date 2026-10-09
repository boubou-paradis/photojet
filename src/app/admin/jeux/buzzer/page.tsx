'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz - page animateur. Une seule page, un gros bouton principal qui
// change selon l'état. Toutes les décisions passent par /api/buzzer/admin
// (fonction SQL sous verrou) ; cette page n'écrit rien elle-même.
// F5 ou onglet fermé = PAUSE (rien n'est effacé) : la partie reprend à la
// réouverture. Effacement seulement sur « Quitter AnimaBuzz ».

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, FileText, Loader2, Monitor, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import AnimaBuzzLogo from '@/components/buzzer/AnimaBuzzLogo'
import Buzzer, { type BuzzerVisualState } from '@/components/buzzer/Buzzer'
import { buzzerFontVars } from '@/components/buzzer/fonts'
import SoundsPanel from '@/components/buzzer/SoundsPanel'
import { BUZZER_CSS } from '@/components/buzzer/styles'
import AmbianceMusicControls from '@/components/affinity/AmbianceMusicControls'
import RemoteControlBadge from '@/components/games/RemoteControlBadge'
import { useAmbianceMusic } from '@/hooks/useAmbianceMusic'
import { useBuzzerSounds } from '@/hooks/useBuzzerSounds'
import { useRemoteControl, useRemoteSwitch } from '@/hooks/useRemoteControl'
import { useBuzzerChannel } from '@/hooks/useBuzzerChannel'
import { useLeaveGuard } from '@/hooks/useLeaveGuard'
import {
  BUZZER_DEFAULT_TIMER_S,
  BUZZER_DEFAULT_WINDOW_MS,
  BUZZER_HEARTBEAT_INTERVAL_MS,
  BUZZER_LIMITS,
  BUZZER_TIMERS_S,
  BUZZER_WINDOWS_MS,
} from '@/lib/buzzer/constants'
import { remoteAction, type GameAction } from '@/lib/buzzer/machine'
import type { BuzzerActiveState, BuzzerAdminPlayer, BuzzerMode, BuzzerRoundSummary, BuzzerState } from '@/lib/buzzer/types'
import { createClient } from '@/lib/supabase'
import { fetchUserSession } from '@/lib/session-select'
import type { Session } from '@/types/database'

type AdminAction = 'launch' | 'exit' | 'heartbeat' | 'snapshot' | 'settings' | 'remove_player' | GameAction

interface AdminResult {
  ok: boolean
  status: number
  error?: string
  state?: BuzzerState
  players?: BuzzerAdminPlayer[]
  rounds?: BuzzerRoundSummary[]
}

const OTHER_GAME_FLAGS = ['quiz_active', 'quiz_lobby_visible', 'lineup_active', 'wheel_active', 'mystery_photo_active', 'affinity_active'] as const
type OtherFlags = Record<(typeof OTHER_GAME_FLAGS)[number], boolean>
const readFlags = (row: Partial<Session>): OtherFlags =>
  Object.fromEntries(OTHER_GAME_FLAGS.map((flag) => [flag, row[flag] === true])) as OtherFlags

const SNAPSHOT_MS = 4000

const windowLabel = (ms: number) => (ms === 0 ? 'Verrouillage immédiat' : `Fenêtre ${(ms / 1000).toString().replace('.', ',')} s`)
const timerLabel = (s: number | null) => (s === null ? 'Sans chrono' : `Chrono ${s} s`)
const formatGap = (ms: number) => (ms === 0 ? '0,00 s' : `+${(ms / 1000).toFixed(2).replace('.', ',')} s`)

async function callAdmin(sessionId: string, action: AdminAction, args: Record<string, unknown> = {}): Promise<AdminResult> {
  try {
    const res = await fetch('/api/buzzer/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action, args }),
    })
    const body = (await res.json().catch(() => ({}))) as Omit<AdminResult, 'ok' | 'status'>
    return { ...body, ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0, error: 'Connexion impossible, réessayez.' }
  }
}

export default function BuzzerAdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [players, setPlayers] = useState<BuzzerAdminPlayer[]>([])
  const [rounds, setRounds] = useState<BuzzerRoundSummary[]>([])
  const [lastBeat, setLastBeat] = useState<number | null>(null)

  // Réglages avant le lancement.
  const [mode, setMode] = useState<BuzzerMode>('solo')
  const [teamsText, setTeamsText] = useState('')
  const [windowMs, setWindowMs] = useState<number>(BUZZER_DEFAULT_WINDOW_MS)
  const [timerS, setTimerS] = useState<number | null>(BUZZER_DEFAULT_TIMER_S)

  const channel = useBuzzerChannel(active && session ? session.id : null)
  const { apply } = channel
  const state = active && channel.state?.active ? channel.state : null

  const activeRef = useRef(false)
  // État des autres jeux au lancement : AnimaBuzz ne se coupe que sur un
  // passage de faux à vrai APRÈS son lancement (pas sur un drapeau bloqué).
  const baselineRef = useRef<OtherFlags | null>(null)

  useLeaveGuard(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  // Sons (sono du PC) et musique d'ambiance (même module que Matching).
  // Jamais deux sources en même temps : la musique se coupe à l'ouverture
  // des buzzers et reprend à la manche suivante si elle jouait.
  const sounds = useBuzzerSounds()
  const music = useAmbianceMusic()
  const musicWasPlaying = useRef(false)
  const lastSeen = useRef<{ phase: string; roundNo: number; attempt: number; priority: string | null } | null>(null)
  const playSound = sounds.play
  const pauseMusic = music.pause
  const toggleMusic = music.toggle
  const musicPlaying = music.playing
  useEffect(() => {
    if (!state) {
      lastSeen.current = null
      return
    }
    const prev = lastSeen.current
    const now = { phase: state.phase, roundNo: state.roundNo, attempt: state.attempt, priority: state.priority?.unit ?? null }
    lastSeen.current = now
    // Premier état reçu (chargement, reprise après F5) : aucun son.
    if (!prev || (prev.phase === now.phase && prev.roundNo === now.roundNo && prev.attempt === now.attempt && prev.priority === now.priority)) return

    if (now.phase === 'open' && prev.phase !== 'open') {
      if (musicPlaying) {
        musicWasPlaying.current = true
        pauseMusic()
      }
      // Réouverture après une mauvaise réponse : le son de la mauvaise réponse suffit.
      playSound(prev.phase === 'buzzed' ? 'wrong' : 'open')
    } else if (now.phase === 'buzzed' && prev.phase !== 'buzzed') {
      playSound('buzz')
    } else if (now.phase === 'buzzed' && prev.priority !== now.priority) {
      playSound('wrong')
    } else if (now.phase === 'closed' && prev.phase !== 'closed') {
      if (state.outcome === 'won') playSound('right')
      else if (prev.phase === 'buzzed') playSound('wrong')
    } else if (now.phase === 'waiting' && now.roundNo !== prev.roundNo) {
      playSound('round')
      if (musicWasPlaying.current) {
        musicWasPlaying.current = false
        toggleMusic()
      }
    }
  }, [state, playSound, pauseMusic, toggleMusic, musicPlaying])

  const applySnapshot = useCallback((result: AdminResult) => {
    if (result.state) apply(result.state)
    if (result.players) setPlayers(result.players)
    if (result.rounds) setRounds(result.rounds)
  }, [apply])

  // ---------- Chargement : reprise d'une partie en cours (après F5) ----------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        const data = await fetchUserSession(supabase, user.id, searchParams.get('session'))
        if (cancelled) return
        setSession(data)
        if (data.buzzer_active) {
          // Signal de vie d'abord : il lève une éventuelle pause.
          const beat = await callAdmin(data.id, 'heartbeat')
          if (beat.ok) {
            const snap = await callAdmin(data.id, 'snapshot')
            if (cancelled) return
            baselineRef.current = readFlags(data)
            applySnapshot(snap)
            setActive(true)
            setLastBeat(Date.now())
            toast.success('Partie AnimaBuzz reprise')
          }
        }
      } catch {
        toast.error('Erreur lors du chargement de la session')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- Sortie ----------
  const exitBuzzer = useCallback(async (reason: 'quit' | 'other-game') => {
    if (!session) return
    const result = await callAdmin(session.id, 'exit')
    if (!result.ok && result.status !== 0) {
      toast.error(result.error ?? 'Impossible d’arrêter AnimaBuzz')
      return
    }
    activeRef.current = false
    baselineRef.current = null
    setActive(false)
    setPlayers([])
    setRounds([])
    if (reason === 'other-game') toast.info('Un autre jeu a été lancé : AnimaBuzz s’est arrêté.')
    else toast.success('AnimaBuzz arrêté. Les joueurs et l’historique ont été effacés.')
  }, [session])

  // ---------- Un autre jeu lancé après AnimaBuzz : il s'efface ----------
  useEffect(() => {
    if (!session?.id) return
    const sessionId = session.id
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      if (!activeRef.current || !baselineRef.current) return
      const { data } = await supabase.from('sessions').select(OTHER_GAME_FLAGS.join(', ')).eq('id', sessionId).single()
      if (!data) return
      const now = readFlags(data as Partial<Session>)
      if (OTHER_GAME_FLAGS.some((flag) => now[flag] && !baselineRef.current![flag])) void exitBuzzer('other-game')
    }
    const channelRow = supabase
      .channel(`buzzer-admin-${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => void check(), 150)
      })
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channelRow)
    }
  }, [session?.id, supabase, exitBuzzer])

  // ---------- Signal de vie (table hors realtime) et relecture des joueurs ----------
  useEffect(() => {
    if (!active || !session?.id) return
    const sessionId = session.id
    const beat = async () => {
      const result = await callAdmin(sessionId, 'heartbeat')
      if (result.status === 409) {
        // Plus de partie côté serveur (purge, autre onglet) : on s'aligne.
        activeRef.current = false
        setActive(false)
        return
      }
      if (result.ok) {
        setLastBeat(Date.now())
        if (result.state && 'active' in result.state) apply(result.state)
      }
    }
    const snap = async () => applySnapshot(await callAdmin(sessionId, 'snapshot'))
    const beatTimer = setInterval(beat, BUZZER_HEARTBEAT_INTERVAL_MS)
    const snapTimer = setInterval(snap, SNAPSHOT_MS)
    return () => {
      clearInterval(beatTimer)
      clearInterval(snapTimer)
    }
  }, [active, session?.id, apply, applySnapshot])

  // ---------- Actions ----------
  const act = useCallback(async (action: AdminAction, args: Record<string, unknown> = {}, quiet = false) => {
    if (!session) return null
    if (!quiet) setBusy(true)
    try {
      const result = await callAdmin(session.id, action, args)
      if (!result.ok) {
        if (!quiet) toast.error(result.error ?? 'Action impossible')
        return result
      }
      if (result.state) apply(result.state)
      // File, joueurs et historique relus tout de suite (sans attendre la relecture périodique).
      void callAdmin(session.id, 'snapshot').then(applySnapshot)
      return result
    } finally {
      if (!quiet) setBusy(false)
    }
  }, [session, apply, applySnapshot])

  // Fin de la fenêtre après le 1er buzz : relecture de la file complète (suivants et écarts).
  const windowEnd = state?.phase === 'buzzed' && state.firstBuzzAt ? Date.parse(state.firstBuzzAt) + state.windowMs : null
  const sessionIdForWindow = session?.id
  useEffect(() => {
    if (windowEnd === null || !sessionIdForWindow) return
    const wait = Math.max(0, windowEnd - (Date.now() + channel.clockOffsetMs)) + 300
    const timer = setTimeout(() => void callAdmin(sessionIdForWindow, 'snapshot').then(applySnapshot), wait)
    return () => clearTimeout(timer)
  }, [windowEnd, sessionIdForWindow, channel.clockOffsetMs, applySnapshot])

  // Fin du chrono : l'animateur fait foi (la base revérifie l'heure).
  const deadlineAt = state?.phase === 'open' ? state.deadlineAt : null
  const offset = channel.clockOffsetMs
  useEffect(() => {
    if (!deadlineAt) return
    const wait = Math.max(0, Date.parse(deadlineAt) - (Date.now() + offset)) + 150
    const timer = setTimeout(() => void act('timeout', {}, true), wait)
    return () => clearTimeout(timer)
  }, [deadlineAt, offset, act])

  // Télécommande de présentation : PageDown = action logique suivante,
  // PageUp = mauvaise réponse. Jamais quitter, retirer ni rien de destructif.
  const [remoteOn, setRemoteOn] = useRemoteSwitch()
  useRemoteControl({
    active: active && remoteOn && !!state,
    phase: state ? `${state.phase}|${state.roundNo}|${state.attempt}|${state.priority?.unit ?? ''}` : 'off',
    onNext: async () => {
      if (!state) return
      const action = remoteAction(state, 'next')
      if (action) await act(action)
    },
    onPrev: async () => {
      if (!state) return
      const action = remoteAction(state, 'prev')
      if (action) await act(action)
    },
  })

  async function launch() {
    if (!session) return
    const teams = mode === 'team' ? teamsText.split('\n').map((t) => t.trim()).filter(Boolean) : []
    setBusy(true)
    try {
      const result = await callAdmin(session.id, 'launch', { mode, teams, windowMs, timerS })
      if (!result.ok) {
        toast.error(result.error ?? 'Lancement impossible')
        return
      }
      baselineRef.current = readFlags({})
      activeRef.current = true
      if (result.state) apply(result.state)
      setPlayers([])
      setRounds([])
      setActive(true)
      setLastBeat(Date.now())
      window.open(`/live/${session.code}`, 'photojet-live')
      toast.success('Lobby AnimaBuzz affiché sur l’écran géant')
    } finally {
      setBusy(false)
    }
  }

  async function quit() {
    if (!window.confirm('Quitter AnimaBuzz ? Les joueurs, la file et l’historique de la soirée seront effacés.')) return
    setBusy(true)
    await exitBuzzer('quit')
    setBusy(false)
  }

  async function removePlayer(p: BuzzerAdminPlayer) {
    if (!window.confirm(`Retirer « ${p.label} » de la partie ? Il ne pourra plus buzzer.`)) return
    const result = await act('remove_player', { playerId: p.id })
    if (result?.ok) setPlayers((list) => list.filter((x) => x.id !== p.id))
  }

  function goBack() {
    if (!session) return
    if (activeRef.current) toast.info('AnimaBuzz reste en pause : rouvrez-le pour reprendre la partie.')
    router.push(`/admin/jeux?session=${session.id}`)
  }

  // ---------- Rendu ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Aucune session trouvée</p>
          <Button onClick={() => router.push('/admin/dashboard')}>Retour au dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-[#0D0D0F] ${buzzerFontVars}`}>
      <style>{BUZZER_CSS}</style>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={goBack} className="text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="h-4 w-px bg-white/10" />
            <div>
              <AnimaBuzzLogo variant="small" subtitle={false} size="22px" />
              <p className="text-xs text-gray-500 mt-1">{session.name} · session {session.code}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RemoteControlBadge enabled={remoteOn} onToggle={setRemoteOn} gameActive={active} />
            <a href="/animabuzz-regles.pdf" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-[#D4AF37] hover:text-[#F4D03F] border border-[#D4AF37]/30 hover:border-[#D4AF37]">
                <FileText className="h-4 w-4 mr-2" />
                Notice
              </Button>
            </a>
            {active && (
              <>
                <Button size="sm" onClick={() => window.open(`/live/${session.code}`, 'photojet-live')} className="bg-[#D4AF37] text-[#1A1A1E] hover:bg-[#F4D03F]">
                  <Monitor className="h-4 w-4 mr-2" />
                  Écran géant
                </Button>
                <Button size="sm" variant="ghost" onClick={quit} disabled={busy} className="text-gray-300 border border-white/10 hover:text-white">
                  Quitter AnimaBuzz
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 sm:px-8 py-6">
        {active && state ? (
          <>
          <GamePanel
            state={state}
            players={players}
            rounds={rounds}
            busy={busy}
            lastBeat={lastBeat}
            onAction={(a) => void act(a)}
            onSettings={(args) => void act('settings', args)}
            onRemove={removePlayer}
          />
          <div className="mt-4 grid lg:grid-cols-2 gap-4 items-start">
            <SoundsPanel sounds={sounds} />
            <AmbianceMusicControls music={music} inGame />
          </div>
          </>
        ) : active ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" /></div>
        ) : (
          <SetupPanel
            mode={mode}
            setMode={setMode}
            teamsText={teamsText}
            setTeamsText={setTeamsText}
            windowMs={windowMs}
            setWindowMs={setWindowMs}
            timerS={timerS}
            setTimerS={setTimerS}
            busy={busy}
            onLaunch={launch}
            extras={<><SoundsPanel sounds={sounds} /><AmbianceMusicControls music={music} /></>}
          />
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------
// Réglages avant le lancement
// ---------------------------------------------------------------------

interface SetupPanelProps {
  mode: BuzzerMode
  setMode: (m: BuzzerMode) => void
  teamsText: string
  setTeamsText: (t: string) => void
  windowMs: number
  setWindowMs: (n: number) => void
  timerS: number | null
  setTimerS: (n: number | null) => void
  busy: boolean
  onLaunch: () => void
  /** Sons et musique d'ambiance, réglables avant le lancement. */
  extras?: React.ReactNode
}

function SetupPanel(p: SetupPanelProps) {
  const teamCount = p.teamsText.split('\n').map((t) => t.trim()).filter(Boolean).length
  const tooMany = teamCount > BUZZER_LIMITS.maxTeams
  const modeCard = (m: BuzzerMode) => (
    <label key={m} className={`cursor-pointer rounded-xl border p-4 flex flex-col ${p.mode === m ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'}`}>
      <input type="radio" name="bz-mode" value={m} checked={p.mode === m} onChange={() => p.setMode(m)} className="sr-only" />
      <span className="text-white font-semibold">{m === 'solo' ? 'Individuel' : 'Équipe'}</span>
      <span className="text-sm text-[#9a94b5] mt-1">
        {m === 'solo' ? 'Chaque joueur choisit un pseudo.' : 'Chaque téléphone choisit son équipe. Le premier qui appuie fait buzzer toute l’équipe.'}
      </span>
    </label>
  )

  return (
    <div className="space-y-6">
      {/* Réglages (même disposition que le Quiz et Matching : pleine largeur) */}
      <section className="card-gold rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 flex items-center justify-center border border-[#D4AF37]/30 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            <Buzzer state="off" size="34px" mini />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">AnimaBuzz</h2>
            <p className="text-[#6B6B70] text-sm">Le buzzer live · réglages de la partie</p>
          </div>
        </div>
        <p className="text-xs text-[#9a94b5] mt-3">
          Les téléphones des invités deviennent des buzzers. Vous posez les questions comme vous voulez (au micro, en blind test, sur PowerPoint), AnimaBuzz donne la parole au plus rapide.
        </p>

        <fieldset className="mt-5">
          <legend className="text-white font-semibold mb-2">Mode de jeu</legend>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modeCard('solo')}
            {modeCard('team')}
            <div className="flex flex-col">
              <label htmlFor="bz-window" className="text-sm text-gray-300 font-semibold">Après le 1er buzz</label>
              <select id="bz-window" value={p.windowMs} onChange={(e) => p.setWindowMs(Number(e.target.value))} className="mt-2 w-full rounded-xl bg-[#1A1A1E] border border-white/10 p-3 text-white text-sm">
                {BUZZER_WINDOWS_MS.map((w) => <option key={w} value={w}>{windowLabel(w)}{w === BUZZER_DEFAULT_WINDOW_MS ? ' (conseillé)' : ''}</option>)}
              </select>
              <p className="text-xs text-[#9a94b5] mt-1">La fenêtre classe aussi les suivants : en cas de mauvaise réponse, le 2e prend la main.</p>
            </div>
            <div className="flex flex-col">
              <label htmlFor="bz-timer" className="text-sm text-gray-300 font-semibold">Chrono à l’ouverture</label>
              <select id="bz-timer" value={p.timerS ?? ''} onChange={(e) => p.setTimerS(e.target.value === '' ? null : Number(e.target.value))} className="mt-2 w-full rounded-xl bg-[#1A1A1E] border border-white/10 p-3 text-white text-sm">
                {BUZZER_TIMERS_S.map((t) => <option key={t ?? 'none'} value={t ?? ''}>{timerLabel(t)}</option>)}
              </select>
              <p className="text-xs text-[#9a94b5] mt-1">Modifiable entre deux manches.</p>
            </div>
          </div>
        </fieldset>

        {p.mode === 'team' && (
          <div className="mt-5">
            <label htmlFor="bz-teams" className="text-white font-semibold">Liste des équipes <span className="text-[#9a94b5] font-normal">(facultatif, une par ligne)</span></label>
            <textarea
              id="bz-teams"
              value={p.teamsText}
              onChange={(e) => p.setTeamsText(e.target.value)}
              rows={4}
              placeholder={'Table 1\nTable 2\nLes Bretons'}
              className="mt-2 w-full rounded-xl bg-[#1A1A1E] border border-white/10 focus:border-[#D4AF37] outline-none p-3 text-white text-sm"
            />
            <p className={`text-xs mt-1 ${tooMany ? 'text-orange-300' : 'text-[#9a94b5]'}`}>
              {teamCount === 0 ? 'Sans liste, chaque joueur tape le nom de son équipe (« Table 4 » et « table4 » sont la même).' : `${teamCount} équipe${teamCount > 1 ? 's' : ''}${tooMany ? ` : ${BUZZER_LIMITS.maxTeams} au maximum` : ''}`}
            </p>
          </div>
        )}
      </section>

      {p.extras}

      <button
        onClick={p.onLaunch}
        disabled={p.busy || tooMany}
        className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {p.busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
        Lancer AnimaBuzz et afficher le lobby
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------
// Partie en cours
// ---------------------------------------------------------------------

interface GamePanelProps {
  state: BuzzerActiveState
  players: BuzzerAdminPlayer[]
  rounds: BuzzerRoundSummary[]
  busy: boolean
  lastBeat: number | null
  onAction: (a: GameAction) => void
  onSettings: (args: { windowMs?: number; timerS?: number | null }) => void
  onRemove: (p: BuzzerAdminPlayer) => void
}

const primaryClass = 'w-full py-4 rounded-xl text-lg disabled:opacity-60'
const goldBtn = `${primaryClass} bg-gradient-to-b from-[#fbe7a3] to-[#D4AF37] text-[#0a0a14]`
const violetBtn = `${primaryClass} bg-gradient-to-b from-[#b16cff] to-[#7c3aed] text-white`
const smallBtn = 'px-3 py-2 rounded-lg text-sm border border-white/10 text-gray-200 hover:border-[#D4AF37]/40 disabled:opacity-40'
const displayFont = { fontFamily: 'var(--font-bz-display), "Arial Black", sans-serif' } as const

function GamePanel({ state, players, rounds, busy, lastBeat, onAction, onSettings, onRemove }: GamePanelProps) {
  const online = players.filter((p) => p.online).length
  const testedCount = players.filter((p) => p.tested).length
  const canEditSettings = ['lobby', 'test', 'waiting', 'closed'].includes(state.phase)

  let visual: BuzzerVisualState = 'off'
  let title = ''
  let subtitle = ''
  let controls: React.ReactNode = null

  switch (state.phase) {
    case 'lobby':
      title = 'Lobby'
      subtitle = `${players.length} inscrit${players.length > 1 ? 's' : ''}, buzzers fermés`
      controls = (
        <>
          <button className={goldBtn} style={displayFont} disabled={busy} onClick={() => onAction('new_round')}>Commencer la 1re manche</button>
          <div className="flex flex-wrap gap-2"><button className={smallBtn} disabled={busy} onClick={() => onAction('test_start')}>Tester les buzzers</button></div>
        </>
      )
      break
    case 'test':
      visual = 'test'
      title = 'Test des buzzers'
      subtitle = `${testedCount} / ${players.length} buzzers testés`
      controls = (
        <>
          <button className={goldBtn} style={displayFont} disabled={busy} onClick={() => onAction('test_stop')}>Terminer le test</button>
          <div className="flex flex-wrap gap-2"><button className={smallBtn} disabled={busy} onClick={() => onAction('new_round')}>Passer directement à la manche</button></div>
        </>
      )
      break
    case 'waiting':
      title = 'Fermés'
      subtitle = `Manche ${state.roundNo} · ${online} joueur${online > 1 ? 's' : ''} en ligne`
      controls = (
        <>
          <button className={goldBtn} style={displayFont} disabled={busy} onClick={() => onAction('open')}>Ouvrir les buzzers</button>
          <div className="flex flex-wrap gap-2">
            <button className={smallBtn} disabled={busy} onClick={() => onAction('test_start')}>Tester les buzzers</button>
            <button className={smallBtn} disabled={busy} onClick={() => onAction('cancel')}>Annuler la manche</button>
          </div>
        </>
      )
      break
    case 'open':
      visual = 'open'
      title = state.attempt > 1 ? 'Réouverts' : 'Ouverts'
      subtitle = state.deadlineAt ? 'Chrono en cours · personne n’a encore buzzé' : 'Personne n’a encore buzzé'
      controls = (
        <>
          <button className={violetBtn} style={displayFont} disabled>En attente d’un buzz…</button>
          <div className="flex flex-wrap gap-2"><button className={smallBtn} disabled={busy} onClick={() => onAction('cancel')}>Annuler la manche</button></div>
        </>
      )
      break
    case 'buzzed':
      visual = 'win'
      title = state.priority ? `${state.priority.label} a la main` : 'Buzz reçu'
      subtitle = `Manche ${state.roundNo}`
      controls = (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button className="py-4 rounded-xl bg-[#34d399] text-[#06281c] disabled:opacity-60" style={displayFont} disabled={busy || !state.priority} onClick={() => onAction('right')}>Bonne réponse</button>
            <button className="py-4 rounded-xl bg-[#fbbf24] text-[#2b1702] disabled:opacity-60" style={displayFont} disabled={busy || !state.priority} onClick={() => onAction('wrong')}>Mauvaise réponse</button>
          </div>
          <div className="flex flex-wrap gap-2"><button className={smallBtn} disabled={busy} onClick={() => onAction('cancel')}>Annuler la manche</button></div>
        </>
      )
      break
    case 'closed':
      visual = state.outcome === 'won' ? 'tested' : 'late'
      title = state.outcome === 'won' ? `${state.winner ?? ''} gagne la manche` : state.outcome === 'cancelled' ? 'Manche annulée' : 'Manche sans réponse'
      subtitle = `Manche ${state.roundNo} terminée`
      controls = (
        <>
          <button className={goldBtn} style={displayFont} disabled={busy} onClick={() => onAction('new_round')}>Nouvelle manche</button>
          <div className="flex flex-wrap gap-2"><button className={smallBtn} disabled={busy} onClick={() => onAction('test_start')}>Tester les buzzers</button></div>
        </>
      )
      break
  }

  const rtts = players.map((p) => p.rttMs).filter((n): n is number => n !== null).sort((a, b) => a - b)
  const median = rtts.length ? rtts[Math.floor(rtts.length / 2)] : null
  const slow = players.filter((p) => p.rttMs !== null && p.rttMs > 400)

  return (
    <div className="space-y-4">
      {state.paused && (
        <p className="rounded-xl border border-orange-500/40 bg-orange-500/10 text-orange-200 text-sm px-4 py-3">Reprise en cours… les buzz étaient en pause.</p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-3 py-1 rounded-full border border-white/10 text-[#B0B0B5]">{state.mode === 'team' ? 'Équipe' : 'Individuel'}</span>
        {canEditSettings ? (
          <>
            <select aria-label="Fenêtre après le 1er buzz" value={state.windowMs} onChange={(e) => onSettings({ windowMs: Number(e.target.value) })} className="px-3 py-1 rounded-full bg-[#1A1A1E] border border-white/10 text-[#B0B0B5]">
              {BUZZER_WINDOWS_MS.map((w) => <option key={w} value={w}>{windowLabel(w)}</option>)}
            </select>
            <select aria-label="Chrono" value={state.timerS ?? ''} onChange={(e) => onSettings({ timerS: e.target.value === '' ? null : Number(e.target.value) })} className="px-3 py-1 rounded-full bg-[#1A1A1E] border border-white/10 text-[#B0B0B5]">
              {BUZZER_TIMERS_S.map((t) => <option key={t ?? 'none'} value={t ?? ''}>{timerLabel(t)}</option>)}
            </select>
          </>
        ) : (
          <>
            <span className="px-3 py-1 rounded-full border border-white/10 text-[#B0B0B5]">{windowLabel(state.windowMs)}</span>
            <span className="px-3 py-1 rounded-full border border-white/10 text-[#B0B0B5]">{timerLabel(state.timerS)}</span>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-[1.25fr_1fr_1fr] gap-4">
        <section className="card-gold rounded-xl p-4 flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-4">
            <Buzzer state={visual} size="84px" mini label={state.phase === 'buzzed' ? '1er' : undefined} />
            <div className="min-w-0">
              <p className="text-white text-lg truncate" style={displayFont}>{title}</p>
              <p className="text-sm text-[#9a94b5]">{subtitle}</p>
            </div>
          </div>
          {controls}
        </section>

        <section className="card-gold rounded-xl p-4 flex flex-col gap-3 min-w-0">
          <h2 className="text-xs uppercase tracking-wider text-[#9a94b5] font-semibold">File de la manche</h2>
          {state.queue.length === 0 ? (
            <p className="text-sm text-[#9a94b5]">{state.phase === 'open' ? 'En attente du premier buzz.' : 'La file apparaîtra ici après le premier buzz.'}</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {state.queue.map((q) => (
                <li
                  key={q.unit}
                  className={`grid grid-cols-[22px_1fr_auto] items-center gap-2 px-3 py-2 rounded-lg border tabular-nums ${q.status === 'priority' || q.status === 'won' ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-transparent bg-white/5'} ${q.status === 'blocked' ? 'opacity-50 line-through' : ''}`}
                >
                  <span className="text-[#D4AF37]" style={displayFont}>{q.rank}</span>
                  <span className="text-white truncate">{q.label}</span>
                  <span className="text-sm text-[#9a94b5]">{formatGap(q.gapMs)}</span>
                </li>
              ))}
            </ol>
          )}
          <h2 className="text-xs uppercase tracking-wider text-[#9a94b5] font-semibold mt-2">Historique</h2>
          {rounds.length === 0 ? (
            <p className="text-sm text-[#9a94b5]">Aucune manche jouée.</p>
          ) : (
            <ul className="text-sm divide-y divide-white/5 max-h-56 overflow-y-auto">
              {rounds.map((r) => (
                <li key={r.roundNo} className="flex justify-between gap-2 py-1.5">
                  <span className="text-gray-300">Manche {r.roundNo}</span>
                  <span className={r.outcome === 'won' ? 'text-[#34d399]' : 'text-[#9a94b5]'}>
                    {r.outcome === 'won' ? `✓ ${r.winner}` : r.outcome === 'cancelled' ? 'Annulée' : r.outcome === 'no_answer' ? 'Sans réponse' : 'En cours'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-gold rounded-xl p-4 flex flex-col gap-3 min-w-0">
          <h2 className="text-xs uppercase tracking-wider text-[#9a94b5] font-semibold">
            Joueurs · {online} en ligne{players.length - online > 0 ? `, ${players.length - online} hors ligne` : ''}
          </h2>
          {players.length === 0 ? (
            <p className="text-sm text-[#9a94b5]">Aucun joueur inscrit pour l’instant.</p>
          ) : (
            <ul className="text-sm max-h-72 overflow-y-auto divide-y divide-white/5">
              {players.map((p) => (
                <li key={p.id} className={`flex items-center gap-2 py-1.5 ${p.online ? 'text-gray-200' : 'text-[#9a94b5]'}`}>
                  <i className={`w-2 h-2 rounded-full ${p.online ? 'bg-[#34d399]' : 'bg-slate-600'}`} />
                  <span className="truncate">{p.label}{p.online ? '' : ' · hors ligne'}</span>
                  <button className="ml-auto text-xs border border-white/10 rounded-md px-2 py-0.5 hover:border-red-400/50 hover:text-red-300" onClick={() => onRemove(p)}>Retirer</button>
                </li>
              ))}
            </ul>
          )}
          <details className="text-sm text-[#9a94b5]">
            <summary className="cursor-pointer font-semibold">Panneau technique</summary>
            <div className="pt-2 flex flex-col gap-1">
              <span>Latence médiane : {median === null ? '—' : `${median} ms`}</span>
              <span>Téléphones lents (&gt; 400 ms) : {slow.length === 0 ? 'aucun' : slow.map((p) => p.label).join(', ')}</span>
              <span>Dernier signal de vie : {lastBeat ? new Date(lastBeat).toLocaleTimeString('fr-FR') : '—'}</span>
            </div>
          </details>
        </section>
      </div>
    </div>
  )
}
