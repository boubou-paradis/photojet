'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot - régie de l'animateur. Avant le lancement : la bibliothèque
// d'énigmes du compte. Pendant : Direct (arbitrage), Préparation (équipes,
// jeux d'énigmes), Réglages. Tout passe par /api/demimot/admin (moteur +
// enregistrement sous contrôle de version) : cette page n'écrit rien
// elle-même. Elle fait avancer la partie à chaque échéance du moteur
// (lettre suivante, fin d'un délai) et intègre aussitôt un buzz reçu.
// F5 ou onglet fermé = PAUSE (rien n'est effacé). Effacement seulement sur
// « Quitter À Demi-Mot », ou quand un autre jeu est lancé.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, FileText, ListOrdered, Loader2, LogOut, Monitor, Play, Radio, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import RemoteControlBadge from '@/components/games/RemoteControlBadge'
import type { RemoteLegendData } from '@/components/games/RemoteLegend'
import { callAdmin, type AdminBody, type AdminResult, type Send } from '@/components/demimot/regie/api'
import { RegieDirect, regieStatus, windowOf } from '@/components/demimot/regie/RegieDirect'
import { RegiePrep } from '@/components/demimot/regie/RegiePrep'
import { RegieSettings } from '@/components/demimot/regie/RegieSettings'
import { themeCssVars, resolveTheme } from '@/components/demimot/themes'
import '@/components/demimot/demimot.css'
import { useDemiMotChannel } from '@/hooks/useDemiMotChannel'
import { useDemiMotSounds } from '@/hooks/useDemiMotSounds'
import { useLeaveGuard } from '@/hooks/useLeaveGuard'
import { useRemoteControl, useRemoteSwitch } from '@/hooks/useRemoteControl'
import { DEMIMOT_HEARTBEAT_INTERVAL_MS } from '@/lib/demimot/constants'
import type { RegieCommand } from '@/lib/demimot/validation'
import type { RegieView } from '@/lib/demimot/view'
import { createClient } from '@/lib/supabase'
import { fetchUserSession } from '@/lib/session-select'
import type { Session } from '@/types/database'
import { Fx3dPanel } from '@/components/fx3d/Fx3dPanel'

// Colonnes des autres jeux (À Demi-Mot s'efface si l'un d'eux est lancé après lui).
const OTHER_GAME_FLAGS = ['quiz_active', 'quiz_lobby_visible', 'lineup_active', 'wheel_active', 'mystery_photo_active', 'affinity_active', 'buzzer_active', 'vote_active'] as const
type OtherFlags = Record<(typeof OTHER_GAME_FLAGS)[number], boolean>
const readFlags = (row: Partial<Session>): OtherFlags =>
  Object.fromEntries(OTHER_GAME_FLAGS.map((flag) => [flag, row[flag] === true])) as OtherFlags

/** Relecture de sécurité des capitaines connectés (aucune écriture si rien ne change). */
const IDLE_TICK_MS = 10_000

type Tab = 'direct' | 'prep' | 'settings'

export default function DemiMotAdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [regie, setRegie] = useState<RegieView | null>(null)
  const [tab, setTab] = useState<Tab>('direct')

  const channel = useDemiMotChannel(active && session ? session.id : null)
  const { apply } = channel
  // Sons : joués ici (PC animateur), jamais sur les téléphones.
  const sounds = useDemiMotSounds(regie?.public ?? null, channel.clockOffsetMs)
  const { onEvents: playSounds } = sounds
  const activeRef = useRef(false)
  const baselineRef = useRef<OtherFlags | null>(null)
  /** Version (base) du dernier état reçu d'une action : au-delà, quelque chose a bougé sans nous (buzz, capitaine). */
  const runtimeV = useRef(0)

  useLeaveGuard(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  const goInactive = useCallback(() => {
    activeRef.current = false
    baselineRef.current = null
    setActive(false)
    setRegie(null)
    setTab('direct')
  }, [])

  const absorb = useCallback((result: AdminResult) => {
    if (result.state) {
      apply(result.state)
      if (result.state.v !== undefined) runtimeV.current = Math.max(runtimeV.current, result.state.v)
    }
    // Réponses dans le désordre (échéance + action) : jamais revenir à une vue plus ancienne.
    const next = result.regie
    if (next) setRegie((prev) => (!prev || next.v >= prev.v ? next : prev))
    playSounds(result.events)
  }, [apply, playSounds])

  const call = useCallback(async (body: AdminBody, quiet = false): Promise<AdminResult | null> => {
    if (!session) return null
    const result = await callAdmin(session.id, body)
    if (!result.ok) {
      if (result.status === 409 && result.code === 'no_game') {
        if (activeRef.current) toast.info('La partie À Demi-Mot n’existe plus (arrêtée ailleurs).')
        goInactive()
      } else if (!quiet) toast.error(result.error ?? 'Action impossible')
      return result
    }
    absorb(result)
    return result
  }, [session, absorb, goInactive])

  const send: Send = useCallback(async (cmd: RegieCommand, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return null
    return call({ action: 'command', command: cmd })
  }, [call])

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
        if (data.demimot_active) {
          // Signal de vie d'abord : il remet la partie en route (en pause si la régie était absente).
          const beat = await callAdmin(data.id, { action: 'heartbeat' })
          if (beat.ok) {
            const snap = await callAdmin(data.id, { action: 'snapshot' })
            if (cancelled) return
            if (snap.ok && snap.regie) {
              baselineRef.current = readFlags(data)
              absorb(snap)
              activeRef.current = true
              setActive(true)
              toast.success('Partie À Demi-Mot reprise')
            }
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
  const exitGame = useCallback(async (reason: 'quit' | 'other-game') => {
    if (!session) return
    const result = await callAdmin(session.id, { action: 'exit' })
    if (!result.ok && result.status !== 0) {
      toast.error(result.error ?? 'Impossible d’arrêter À Demi-Mot')
      return
    }
    goInactive()
    if (reason === 'other-game') toast.info('Un autre jeu a été lancé : À Demi-Mot s’est arrêté.')
    else toast.success('À Demi-Mot arrêté. Votre bibliothèque d’énigmes est gardée.')
  }, [session, goInactive])

  // ---------- Un autre jeu lancé après À Demi-Mot : il s'efface ----------
  useEffect(() => {
    if (!session?.id) return
    const id = session.id
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      if (!activeRef.current || !baselineRef.current) return
      const { data } = await supabase.from('sessions').select(OTHER_GAME_FLAGS.join(', ')).eq('id', id).single()
      if (!data) return
      const now = readFlags(data as Partial<Session>)
      if (OTHER_GAME_FLAGS.some((flag) => now[flag] && !baselineRef.current![flag])) void exitGame('other-game')
    }
    const row = supabase
      .channel(`demimot-admin-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${id}` }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => void check(), 150)
      })
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(row)
    }
  }, [session?.id, supabase, exitGame])

  // ---------- Signal de vie ----------
  useEffect(() => {
    if (!active || !session?.id) return
    const timer = setInterval(() => void call({ action: 'heartbeat' }, true), DEMIMOT_HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [active, session?.id, call])

  // ---------- Échéances du moteur : lettre suivante, fin d'un délai ----------
  const tick = useCallback(() => void call({ action: 'command', command: { type: 'tick' } }, true), [call])
  const dueAt = regie?.private.nextDueAt ?? null
  const offset = channel.clockOffsetMs
  useEffect(() => {
    if (!active || dueAt === null) return
    const wait = Math.max(0, dueAt - (Date.now() + offset)) + 40
    const timer = setTimeout(tick, wait)
    return () => clearTimeout(timer)
  }, [active, dueAt, offset, tick])
  useEffect(() => {
    if (!active) return
    const timer = setInterval(tick, IDLE_TICK_MS)
    return () => clearInterval(timer)
  }, [active, tick])

  // ---------- Diffusion reçue : buzz d'un capitaine, arrivée d'un capitaine… ----------
  const pubState = channel.state
  const regiePhase = regie?.public.phase
  useEffect(() => {
    if (!active || !pubState?.active || pubState.v === undefined || pubState.v <= runtimeV.current) return
    runtimeV.current = pubState.v
    // Buzz accepté par la base : le moteur l'intègre tout de suite (arrêt du dévoilement).
    if (pubState.gate?.state === 'buzzed' && regiePhase !== 'answering') tick()
    else void call({ action: 'snapshot' }, true)
  }, [active, pubState, regiePhase, tick, call])

  // ---------- Télécommande de présentation (même sens qu'AnimaBuzz) ----------
  // Une équipe a la main : Page précédente = bonne réponse, Page suivante =
  // mauvaise. Personne n'a la main : Page suivante = étape suivante, Page
  // précédente = révéler une lettre. B = classement. Annuler l'arbitrage :
  // souris seulement.
  const [remoteOn, setRemoteOn] = useRemoteSwitch()
  const status = regie ? regieStatus(regie) : 'off'
  const round = regie?.public.round ?? null
  // Une seule décision : exécutée par la touche ET affichée par la légende.
  const remoteActive = active && remoteOn && !!regie && tab === 'direct'
  const demiPrev: 'judge_right' | 'turn_right' | 'letter' | null =
    !regie ? null
      : status === 'answering' && round?.buzz ? 'judge_right'
        : status === 'turn' ? 'turn_right'
          : (status === 'revealing' || status === 'ready') && round?.mode === 'reveal' ? 'letter'
            : null
  const demiNext: 'judge_wrong' | 'turn_wrong' | 'start' | 'reveal' | 'resume' | 'next' | 'finale' | null =
    !regie ? null
      : status === 'answering' && round?.buzz ? 'judge_wrong'
        : status === 'turn' ? 'turn_wrong'
          : status === 'waiting' ? 'start'
            : status === 'ready' ? 'reveal'
              : status === 'paused' ? 'resume'
                : status === 'resolved' && round ? 'next'
                  : status === 'final_intro' ? 'finale'
                    : null
  useRemoteControl({
    active: remoteActive,
    phase: `${status}|${round?.key ?? ''}|${regie?.private.buzzWindowId ?? ''}`,
    onPrev: async () => {
      if (!regie) return
      if (demiPrev === 'judge_right') await send({ type: 'judge', correct: true, windowId: windowOf(regie) })
      else if (demiPrev === 'turn_right') await send({ type: 'solveTurn', correct: true })
      else if (demiPrev === 'letter') await send({ type: 'revealLetter' })
    },
    onNext: async () => {
      if (!regie) return
      if (demiNext === 'judge_wrong') await send({ type: 'judge', correct: false, windowId: windowOf(regie) })
      else if (demiNext === 'turn_wrong') await send({ type: 'solveTurn', correct: false })
      else if (demiNext === 'start') await send({ type: 'startGame' })
      else if (demiNext === 'reveal') await send({ type: 'startReveal' })
      else if (demiNext === 'resume') await send({ type: 'resume' })
      else if (demiNext === 'next' && round) await send({ type: 'next', roundKey: round.key })
      else if (demiNext === 'finale') await send({ type: 'startFinale' })
    },
    onSecondary: async () => {
      if (!regie) return
      await send({ type: 'display', display: regie.public.display === 'standings' ? 'board' : 'standings' })
    },
  })
  const remoteLegend: RemoteLegendData = {
    active: remoteActive,
    inactiveReason: active && tab !== 'direct' ? 'La télécommande agit dans l’onglet Direct.' : undefined,
    next: demiNext === 'judge_wrong' || demiNext === 'turn_wrong' ? 'mauvaise réponse'
      : demiNext === 'start' ? 'démarrer la partie'
        : demiNext === 'reveal' ? 'lancer le dévoilement'
          : demiNext === 'resume' ? 'reprendre'
            : demiNext === 'next' ? 'manche suivante'
              : demiNext === 'finale' ? 'lancer la finale'
                : null,
    prev: demiPrev === 'judge_right' || demiPrev === 'turn_right' ? 'bonne réponse' : demiPrev === 'letter' ? 'révéler une lettre' : null,
    secondary: !regie ? null : regie.public.display === 'standings' ? 'afficher le plateau' : 'afficher le classement',
  }

  async function launch() {
    if (!session) return
    setBusy(true)
    try {
      const result = await callAdmin(session.id, { action: 'launch' })
      if (!result.ok || !result.regie) {
        toast.error(result.error ?? 'Lancement impossible')
        return
      }
      baselineRef.current = readFlags({})
      runtimeV.current = 0
      absorb(result)
      activeRef.current = true
      setActive(true)
      setTab('direct')
      window.open(`/live/${session.code}`, 'photojet-live')
      toast.success('À Demi-Mot affiché sur l’écran géant')
    } finally {
      setBusy(false)
    }
  }

  async function quit() {
    if (!window.confirm('Quitter À Demi-Mot ? La partie en cours (équipes, scores) sera effacée. Votre bibliothèque d’énigmes est gardée.')) return
    setBusy(true)
    await exitGame('quit')
    setBusy(false)
  }

  const release = useCallback(async (teamId: string, name: string) => {
    if (!window.confirm(`Libérer le téléphone de ${name} ? Un autre téléphone pourra prendre l’équipe (points conservés).`)) return
    await call({ action: 'release', teamId })
  }, [call])

  function goBack() {
    if (!session) return
    if (activeRef.current) toast.info('À Demi-Mot reste en pause : rouvrez-le pour reprendre la partie.')
    router.push(`/admin/jeux?session=${session.id}`)
  }

  const notify = useCallback((text: string, kind: 'error' | 'info' = 'info') => (kind === 'error' ? toast.error(text) : toast.success(text)), [])

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

  const themeId = resolveTheme(regie?.settings.theme?.id)
  return (
    <div className="min-h-[calc(100dvh-var(--admin-chrome,95px))] bg-[#0b0b0d]">
      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={goBack} className="text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="h-4 w-px bg-white/10" />
            <div>
              <p className="text-white font-bold tracking-wide">À Demi-Mot</p>
              <p className="text-xs text-gray-500">{session.name} · session {session.code}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RemoteControlBadge enabled={remoteOn} onToggle={setRemoteOn} gameActive={active} finished={status === 'podium'} legend={remoteLegend} />
            <a href="/a-demi-mot-regles.pdf" target="_blank" rel="noopener noreferrer">
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
                <Button size="sm" onClick={quit} disabled={busy} className="bg-red-600 text-white font-semibold hover:bg-red-500 border border-red-400/60 shadow-[0_0_14px_rgba(220,38,38,0.45)]">
                  <LogOut className="h-4 w-4 mr-2" />
                  Quitter À Demi-Mot
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="dm" style={themeCssVars(themeId) as React.CSSProperties}>
        {active && regie ? (
          <div className="regie" data-testid="regie" data-phase={regie.public.phase} style={{ minHeight: 0 }}>
            <div className="regie-top">
              <div className="tabs" role="tablist" aria-label="Vues de la régie">
                <button role="tab" aria-selected={tab === 'direct'} onClick={() => setTab('direct')}><Radio size={15} /> Direct</button>
                <button role="tab" aria-selected={tab === 'prep'} onClick={() => setTab('prep')}><ListOrdered size={15} /> Préparation</button>
                <button role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')}><Settings size={15} /> Réglages</button>
              </div>
              <span className="spacer" />
              {/* Mode du plateau sur le grand écran (3D / 2D + raison) et « Réessayer la 3D » */}
              <Fx3dPanel code={session.code} game="demimot" />
              <span className={`pill ${channel.connected ? 'live' : 'warn'}`} data-testid="regie-online">
                <span className={`dot ${channel.connected ? 'on' : ''}`} /> {channel.connected ? 'Connecté' : 'Reconnexion…'}
              </span>
              <span className="pill gold" data-testid="regie-code">Code {session.code}</span>
            </div>
            {tab === 'direct' && <RegieDirect v={regie} send={send} onRelease={(id, name) => void release(id, name)} offset={offset} online />}
            {tab === 'prep' && <RegiePrep v={regie} send={send} notify={notify} />}
            {tab === 'settings' && <RegieSettings v={regie} send={send} notify={(t) => notify(t)} sounds={sounds} />}
          </div>
        ) : (
          <div className="regie" style={{ minHeight: 0 }}>
            <div className="regie-body" style={{ gridTemplateColumns: '1fr' }}>
              <div className="panel" data-testid="demimot-setup">
                <h3><Play size={14} /> Lancer À Demi-Mot</h3>
                <p className="regie-help">
                  Les lettres d’une expression se dévoilent une à une sur l’écran géant ; le capitaine de chaque équipe buzze sur son téléphone et répond à l’oral.
                  Le lancement affiche l’accueil et le QR code de la soirée ; équipes, énigmes et règles se préparent ensuite dans la régie.
                </p>
                <button className="btn primary xl" onClick={() => void launch()} disabled={busy} data-testid="launch">
                  <Play size={20} /> {busy ? 'Lancement…' : 'Afficher À Demi-Mot sur l’écran géant'}
                </button>
                <p className="why">Lancer À Demi-Mot arrête le jeu en cours sur l’écran géant.</p>
              </div>
            </div>
            <RegiePrep v={null} send={null} notify={notify} />
          </div>
        )}
      </div>
    </div>
  )
}
