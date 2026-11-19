'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo — régie de l'animateur. Toute la partie vit en base : cette page
// n'écrit rien elle-même (tout passe par /api/bingo/admin) et peut être
// fermée, rechargée ou perdre le réseau sans rien perdre. À la réouverture,
// elle relit l'état exact et reprend (bandeau « Partie reprise »).
// Un autre jeu lancé met AnimaBingo EN PAUSE (rien n'est effacé) : le bouton
// « Reprendre AnimaBingo » le remet à l'écran tel quel.
// Effacement : seulement « Nouvelle partie » ou « Quitter le jeu », chacun
// avec une double confirmation.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import RemoteControlBadge from '@/components/games/RemoteControlBadge'
import { Ball, Board } from '@/components/bingo/Ball'
import '@/components/bingo/bingo.css'
import { callAdmin, loadSnapshot, type AdminBody, type AdminResult } from '@/components/bingo/regie/api'
import { ClaimsPanel } from '@/components/bingo/regie/ClaimsPanel'
import { ConfirmDialog, type ConfirmRequest } from '@/components/bingo/regie/ConfirmDialog'
import { PaperPanel } from '@/components/bingo/regie/PaperPanel'
import { MusicBoard, MusicDeck, useMusicPlayer } from '@/components/bingo/regie/MusicDeck'
import { MusicPicker } from '@/components/bingo/regie/MusicPicker'
import { PlaylistLibrary } from '@/components/bingo/regie/PlaylistLibrary'
import { SettingsForm } from '@/components/bingo/regie/SettingsForm'
import { AUTO_ADVANCE_MS, RoundLabel, StepButton } from '@/components/bingo/regie/StepControl'
import { FormulaButton, FormulaPanel, FormulaPicker } from '@/components/bingo/regie/FormulaControl'
import { useBingoChannel } from '@/hooks/useBingoChannel'
import { useBingoVoice } from '@/hooks/useBingoVoice'
import { useLeaveGuard } from '@/hooks/useLeaveGuard'
import { useRemoteControl, useRemoteSwitch } from '@/hooks/useRemoteControl'
import { BINGO_HEARTBEAT_INTERVAL_MS, BINGO_PHASES, PHASE_LABELS } from '@/lib/bingo/constants'
import { currentPhase, inWords, lotInfo } from '@/lib/bingo/display'
import { normalizeLots } from '@/lib/bingo/formulas'
import type { PendingClaim, RegieMusic, RegieSnapshot } from '@/lib/bingo/server'
import type { LibraryPlaylist } from '@/lib/bingo/music-client'
import type { BingoPublicState, BingoSettings, Phase } from '@/lib/bingo/types'
import { DEFAULT_SETTINGS } from '@/lib/bingo/validation'
import { createClient } from '@/lib/supabase'
import { fetchUserSession } from '@/lib/session-select'
import type { Session } from '@/types/database'

/** Écart minimal entre deux boules imposé par la base. */
const MIN_GAP_MS = 2500
const LOST_TEXT = 'La partie en cours et tous les cartons seront perdus.'

type Live = Extract<BingoPublicState, { active: true }>
const isState = (x: unknown): x is BingoPublicState => !!x && typeof x === 'object' && 'active' in x && 'serverNow' in x

export default function BingoAdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [snap, setSnap] = useState<RegieSnapshot | null>(null)
  const [draft, setDraft] = useState<BingoSettings>(DEFAULT_SETTINGS)
  const [draftPhases, setDraftPhases] = useState<Phase[]>([...BINGO_PHASES])
  const [draftLots, setDraftLots] = useState<number[]>([1, 1, 1])
  const [busy, setBusy] = useState<string | null>(null)
  const [decidingId, setDecidingId] = useState<number | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  // Bandeau d'information passager : il ne reste pas affiché avec des chiffres périmés.
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 15_000)
    return () => clearTimeout(t)
  }, [banner])
  const [netLost, setNetLost] = useState(false)
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [formulaOpen, setFormulaOpen] = useState(false)
  const [autoSec, setAutoSec] = useState(8)
  const [now, setNow] = useState(() => Date.now())
  // Loto musical : mode choisi avant le lancement, playlist et bibliothèque du compte.
  const [mode, setMode] = useState<'numbers' | 'music'>('numbers')
  const [playlistId, setPlaylistId] = useState<string>('')
  const [playlists, setPlaylists] = useState<LibraryPlaylist[] | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)

  const channel = useBingoChannel(session?.id, session?.code)
  const { apply, clockOffsetMs: offset } = channel
  const state: BingoPublicState | null = channel.state ?? snap?.state ?? null
  const live: Live | null = state?.active ? state : null
  const held = !!snap?.held
  const settings = snap?.settings ?? null
  const phase = currentPhase(live)
  const hasGame = !!live
  const music: RegieMusic | null = live?.music ? snap?.music ?? null : null
  const titles = useMemo(() => (music ? music.tracks.map((t) => ({ t: t.title, a: t.artist })) : null), [music])
  // Tirage complet vu par la régie : le titre encore caché au public compte (vérification des cartons).
  const drawnFull = useMemo(
    () => (live && music && live.hidden && music.current ? [...live.drawn, music.current] : undefined),
    [live, music],
  )

  useLeaveGuard(hasGame)
  const soundOn = (settings ?? draft).voice !== 'off'
  const voice = useBingoVoice(held ? null : live, soundOn, offset)

  const notify = useCallback((text: string, kind: 'error' | 'info' = 'info') => (kind === 'error' ? toast.error(text) : toast.success(text)), [])

  // ---------- Lecture complète (demandes vérifiées, papier, pause) ----------
  const snapSeq = useRef(0)
  const refreshSnap = useCallback(async () => {
    if (!session) return
    const seq = ++snapSeq.current
    const r = await loadSnapshot(session.id)
    if (seq !== snapSeq.current) return // une lecture plus récente est partie
    if (r.status === 0) {
      setNetLost(true)
      return
    }
    if (!r.ok || !r.data) return
    setNetLost(false)
    setSnap(r.data)
    apply(r.data.state)
  }, [session, apply])

  const run = useCallback(async (body: AdminBody, opts: { quiet?: boolean; key?: string } = {}): Promise<AdminResult | null> => {
    if (!session) return null
    if (opts.key) setBusy(opts.key)
    try {
      const r = await callAdmin(session.id, body)
      if (!r.ok) {
        if (r.status === 0) setNetLost(true)
        if (r.code === 'no_game') {
          void refreshSnap()
          if (!opts.quiet) toast.info('Aucune partie AnimaBingo en cours.')
        } else if (!opts.quiet) toast.error(r.error ?? 'Action impossible')
        return r
      }
      setNetLost(false)
      if (isState(r.data)) apply(r.data)
      return r
    } finally {
      if (opts.key) setBusy(null)
    }
  }, [session, apply, refreshSnap])

  // ---------- Chargement : reprise exacte d'une partie en cours ----------
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
        if (!data) return
        const first = await loadSnapshot(data.id)
        if (cancelled || !first.ok || !first.data) {
          if (first.status === 0) setNetLost(true)
          return
        }
        let s = first.data
        if (s.state.active && !s.held) {
          // Signal de vie : la partie repart exactement où elle était (tirage auto en pause).
          await callAdmin(data.id, { action: 'heartbeat' })
          const again = await loadSnapshot(data.id)
          if (again.ok && again.data) s = again.data
        }
        if (cancelled) return
        setSnap(s)
        apply(s.state)
        if (s.settings) setDraft(s.settings)
        if (s.state.active) {
          setDraftPhases(s.state.phases)
          setDraftLots(normalizeLots(s.state.phases, s.state.lots))
          setAutoSec(Math.round(s.state.autoMs / 1000))
          if (!s.held && (s.state.count > 0 || s.state.status !== 'lobby')) {
            setBanner(`Partie reprise : ${s.state.count} boule${s.state.count > 1 ? 's' : ''} sortie${s.state.count > 1 ? 's' : ''}, ${s.state.players} joueur${s.state.players > 1 ? 's' : ''}. Rien n’a été perdu.`)
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

  // ---------- Chaque nouvel état : relecture des demandes (léger, propriétaire seul) ----------
  const stateKey = live ? `${live.gameId}|${live.v}` : state ? `off|${state.active}` : ''
  useEffect(() => {
    if (!session || !stateKey) return
    const t = setTimeout(() => void refreshSnap(), 200)
    return () => clearTimeout(t)
  }, [session, stateKey, refreshSnap])

  // ---------- Un autre jeu lancé ou arrêté : on relit (pause / reprise) ----------
  useEffect(() => {
    if (!session?.id) return
    const id = session.id
    let timer: ReturnType<typeof setTimeout> | undefined
    const row = supabase
      .channel(`bingo-admin-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${id}` }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => void refreshSnap(), 300)
      })
      .subscribe()
    const safety = setInterval(() => void refreshSnap(), 20_000)
    return () => {
      if (timer) clearTimeout(timer)
      clearInterval(safety)
      void supabase.removeChannel(row)
    }
  }, [session?.id, supabase, refreshSnap])

  // ---------- Signal de vie (30 s) + retour du réseau ----------
  const beat = useCallback(async () => {
    const r = await run({ action: 'heartbeat' }, { quiet: true })
    if (r?.ok && (r.data as { resumed?: boolean } | undefined)?.resumed) {
      setBanner('Connexion rétablie : la partie a repris exactement où elle était. Le tirage automatique reste en pause, relancez-le quand vous voulez.')
      void refreshSnap()
    }
  }, [run, refreshSnap])
  useEffect(() => {
    if (!hasGame || held) return
    const timer = setInterval(() => void beat(), BINGO_HEARTBEAT_INTERVAL_MS)
    const onOnline = () => void beat()
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', onOnline)
    }
  }, [hasGame, held, beat])

  // ---------- Tirage ----------
  const drawing = useRef(false)
  const draw = useCallback(async (fromAuto = false) => {
    if (!live || live.status !== 'running' || drawing.current) return
    drawing.current = true
    try {
      const r = await run({ action: 'draw', expect: live.count }, { quiet: true })
      if (r && !r.ok && !fromAuto) {
        if (r.code === 'too_fast') toast.info('Un instant : la boule précédente est encore à l’écran.')
        else if (r.code === 'empty') toast.info('Les 90 boules sont sorties.')
        else if (r.code !== 'no_game') toast.error(r.error ?? 'Tirage impossible')
      }
    } finally {
      drawing.current = false
    }
  }, [live, run])

  // Loto musical : révélation du titre (fin de l'extrait ou clic). Sans effet si déjà visible.
  const reveal = useCallback(async () => {
    await run({ action: 'reveal' }, { quiet: true })
    void refreshSnap()
  }, [run, refreshSnap])
  const player = useMusicPlayer(live, music, held, () => void reveal())

  // Tirage automatique : piloté par cette régie (fermée = plus de tirage, rien de perdu).
  const [autoRetry, setAutoRetry] = useState(0)
  const autoOn = !!live && !held && live.autoMode === 'auto' && live.status === 'running'
  const nextAt = autoOn && live ? (live.lastDrawAt ? Date.parse(live.lastDrawAt) - offset + live.autoMs : 0) : null
  useEffect(() => {
    if (nextAt === null) return
    const t = setTimeout(async () => {
      await draw(true)
      setAutoRetry((n) => n + 1) // si rien n'a bougé (réseau), on retente
    }, Math.max(1000, nextAt - Date.now())) // jamais plus d'un essai par seconde (réseau coupé)
    return () => clearTimeout(t)
  }, [nextAt, draw, autoRetry])
  useEffect(() => {
    if (!autoOn && !live?.lastDrawAt) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [autoOn, live?.lastDrawAt])

  const sinceLast = live?.lastDrawAt ? now - (Date.parse(live.lastDrawAt) - offset) : Infinity
  const tooSoon = sinceLast < MIN_GAP_MS

  const setAuto = useCallback((mode: 'manual' | 'auto' | 'paused') => run({ action: 'auto', mode, ms: autoSec * 1000 }, { key: 'auto' }), [run, autoSec])

  // Passage automatique (réglage « Auto 8 s ») : piloté par cette régie, la base
  // revérifie tout (étape gagnée, 8 s écoulées, aucune demande en attente, même étape).
  const autoAdvanceAt = !!live && !held && live.status === 'celebrating' && live.advance === 'auto' && live.pending === 0 && !!live.phaseDone
    ? (live.lastWinAt ? Date.parse(live.lastWinAt) - offset : Date.now()) + AUTO_ADVANCE_MS + 400
    : null
  const autoAdvanceKey = autoAdvanceAt === null || !live ? null : `${live.round}|${live.phaseIndex}|${autoAdvanceAt}`
  const [advanceRetry, setAdvanceRetry] = useState(0)
  useEffect(() => {
    if (autoAdvanceAt === null || !live) return
    const expect = live.phaseIndex
    const t = setTimeout(async () => {
      await run({ action: 'advance', expect }, { quiet: true })
      setAdvanceRetry((n) => n + 1) // réseau coupé : on retente
    }, Math.max(1000, autoAdvanceAt - Date.now()))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvanceKey, advanceRetry, run])

  // ---------- Décisions ----------
  const decide = useCallback(async (c: PendingClaim, accept: boolean) => {
    setDecidingId(c.id)
    const r = await run({ action: 'decide', claimId: c.id, accept })
    setDecidingId(null)
    if (r?.ok) {
      toast.success(accept ? `${c.name ?? 'Carton n° ' + c.serial} : ${PHASE_LABELS[c.phase].toLowerCase()} validée !` : 'Demande refusée.')
      void refreshSnap()
    }
  }, [run, refreshSnap])

  // ---------- Lancement / reprise / remise à zéro / sortie ----------
  async function launch() {
    if (!session) return
    // Une partie existante (reprise) garde son mode : la playlist n'est demandée qu'au premier lancement.
    const fresh = !snap?.state.active
    if (fresh && mode === 'music' && !playlistId) {
      toast.error('Choisissez une playlist prête à jouer (au moins 30 titres).')
      return
    }
    // Reprise : la formule choisie dans la régie reste celle de la base.
    const cur = snap?.state.active ? snap.state : null
    const phases = cur ? cur.phases : draftPhases
    const lots = cur ? normalizeLots(cur.phases, cur.lots) : normalizeLots(draftPhases, draftLots)
    const r = await run({ action: 'launch', settings: draft, phases, lots, ...(fresh && mode === 'music' ? { playlistId } : {}) }, { key: 'launch' })
    if (!r?.ok) return
    window.open(`/live/${session.code}`, 'photojet-live')
    if (isState(r.data) && r.data.active && r.data.resumedGame) {
      setBanner('AnimaBingo est de retour à l’écran : la partie reprend exactement où elle était.')
      toast.success('AnimaBingo repris')
    } else toast.success('AnimaBingo affiché sur l’écran géant')
    void refreshSnap()
  }

  // Nouvelle partie de la soirée : nouvelles boules, jetons vidés sur tous les
  // téléphones, MÊMES cartons pour tout le monde (téléphones et papier), personne
  // ne rescanne. Seul « Quitter AnimaBingo » efface les cartons.
  const askNewGame = () => {
    const playing = !!live && live.status !== 'finished' && live.count > 0
    setConfirmReq({
      title: 'Nouvelle partie ?',
      message: playing
        ? 'La partie en cours s’arrête. On repart avec toutes les boules, et les jetons sont vidés sur tous les téléphones.'
        : 'On repart avec toutes les boules, et les jetons sont vidés sur tous les téléphones.',
      note: 'Chacun garde ses cartons (téléphones et papier) : personne ne rescanne. Vous choisirez ensuite la formule de la nouvelle partie.',
      check: 'J’ai compris : nouvelles boules, mêmes cartons.',
      confirm: 'Lancer la nouvelle partie',
      onConfirm: async () => {
        const r = await run({ action: 'new_round' }, { key: 'new' })
        if (r?.ok) {
          setBanner(null)
          toast.success('Nouvelle partie prête : mêmes cartons pour tout le monde')
          void refreshSnap()
        }
      },
    })
  }

  const askQuit = () => setConfirmReq({
    title: 'Quitter AnimaBingo ?',
    message: LOST_TEXT,
    note: 'L’écran géant revient à l’accueil. Les cartons papier imprimés restent gardés avec la session.',
    check: 'J’ai compris : la partie en cours et tous les cartons seront perdus.',
    confirm: 'Quitter et effacer la partie',
    onConfirm: async () => {
      const r = await run({ action: 'exit' }, { key: 'exit' })
      if (r?.ok) {
        setBanner(null)
        toast.success('AnimaBingo arrêté.')
        void refreshSnap()
      }
    },
  })

  async function saveSettings(next: BingoSettings) {
    const r = await run({ action: 'settings', settings: next }, { key: 'settings' })
    if (r?.ok) {
      // Copie locale à jour tout de suite : un 2e appui rapide (touche B) part du bon réglage.
      setSnap((cur) => (cur ? { ...cur, settings: next } : cur))
      void refreshSnap()
    }
    return !!r?.ok
  }

  /** Bouton Son : voix et bruitages (les extraits du loto musical ont leur propre lecteur). */
  async function toggleSound() {
    const next = soundOn ? 'off' : 'tts'
    setDraft((d) => ({ ...d, voice: next }))
    if (settings && hasGame) await saveSettings({ ...settings, voice: next })
  }

  function goBack() {
    if (!session) return
    if (hasGame) toast.info('La partie AnimaBingo est gardée : rouvrez-la pour reprendre.')
    router.push(`/admin/jeux?session=${session.id}`)
  }

  // ---------- Télécommande : Page ↓ tirer · Page ↑ pause / reprise auto · B machine / tableau ----------
  const [remoteOn, setRemoteOn] = useRemoteSwitch()
  const status = live?.status ?? 'off'
  useRemoteControl({
    active: hasGame && !held && remoteOn && status !== 'finished',
    phase: `${status}|${live?.phaseIndex ?? ''}|${live?.round ?? ''}`,
    isBlocked: () => !!confirmReq || settingsOpen || formulaOpen,
    onNext: async () => {
      if (!live) return
      if (live.status === 'lobby') await run({ action: 'start' })
      else if (music && live.hidden) await reveal()
      else if (live.status === 'running') await draw()
      else if (live.status === 'celebrating' && live.pending === 0) {
        // Page ↓ = le gros bouton : continuer l'étape ou passer à la suivante.
        if (lotInfo(live).done) await run({ action: 'next_phase', expect: live.phaseIndex })
        else await run({ action: 'resume' })
      }
    },
    onPrev: async () => {
      if (!live) return
      if (music) return player.toggle()
      if (live.autoMode === 'auto') await setAuto('paused')
      else if (live.autoMode === 'paused') await setAuto('auto')
    },
    onSecondary: async () => {
      if (music) return player.replay()
      if (!settings) return
      // L'état diffusé en direct est plus frais que la copie de la régie.
      const shown = live?.display.screen ?? settings.public.screen
      await saveSettings({ ...settings, public: { ...settings.public, screen: shown === 'board' ? 'machine' : 'board' } })
    },
  })

  // ---------- Rendu ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0814] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" />
      </div>
    )
  }
  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0814] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Aucune session trouvée</p>
          <Button onClick={() => router.push('/admin/dashboard')}>Retour au dashboard</Button>
        </div>
      </div>
    )
  }

  const offline = netLost || !channel.online
  const paperBox = (
    <PaperPanel
      sessionId={session.id}
      title={session.name ?? ''}
      paper={snap?.paper ?? { count: 0, first: null, last: null }}
      state={live}
      onChanged={() => void refreshSnap()}
      notify={notify}
      askConfirm={setConfirmReq}
      canWin={!!live && !held && phase !== null && ['running', 'checking', 'celebrating'].includes(live.status)}
      titles={titles}
      drawnFull={drawnFull}
      compact={hasGame}
    />
  )

  // Le gros bouton ne remplace TIRER qu'après un gagnant validé ou en fin de partie.
  const stepButton = live && (live.status === 'celebrating' || live.status === 'finished') ? <StepButton live={live} held={held} busy={busy} run={run} offset={offset} onNewGame={askNewGame} /> : null
  const stepLinks = live ? <FormulaButton live={live} held={held} onOpen={() => setFormulaOpen(true)} /> : null
  // Avant la première boule, le tableau encore vide laisse la place au choix de la formule.
  const choosing = !!live && live.status === 'lobby' && live.count === 0

  return (
    <div className={`bgo regie${hasGame ? ' direct' : ''}`} data-testid="bingo-regie" data-status={status} data-held={held ? '1' : '0'}>
      <div className="rtop">
        <Button variant="ghost" size="sm" onClick={goBack} className="text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Ball n={live?.last ?? 77} size={30} label="AnimaBingo" />
        <h1 title={`AnimaBingo · Régie · session ${session.code}`}>AnimaBingo <span><span className="long">· Régie · session</span> · {session.code}</span></h1>
        {hasGame && (
          <>
            <span className={`chip ${offline ? 'bad' : ''}`} data-testid="regie-net"><i />{offline ? 'Connexion perdue…' : 'En ligne'}</span>
            <span className="chip"><b>{live!.players}</b> joueur{live!.players > 1 ? 's' : ''}</span>
            {live!.pending > 0 && <span className="chip warn" title="Demandes en attente de vérification"><i />{live!.pending} demande{live!.pending > 1 ? 's' : ''}</span>}
          </>
        )}
        <div className="right">
          <button
            className={`btn sm ${soundOn ? 'ghost' : 'danger'} sound-toggle`}
            onClick={() => void toggleSound()}
            aria-pressed={soundOn}
            title="Voix et bruitages de la régie (les extraits musicaux ne sont pas concernés)"
            data-testid="sound-toggle"
          >
            {soundOn ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
            {soundOn ? 'Son activé' : 'Son coupé'}
          </button>
          <RemoteControlBadge enabled={remoteOn} onToggle={setRemoteOn} gameActive={hasGame && !held} finished={status === 'finished'} />
          {hasGame && !held && (
            <>
              <button className="btn sm gold" onClick={() => window.open(`/live/${session.code}`, 'photojet-live')}>Écran géant</button>
              <button className="btn sm ghost" onClick={() => setSettingsOpen(true)} data-testid="open-settings">Réglages</button>
            </>
          )}
          {hasGame && (
            <>
              <button className="btn sm ghost" onClick={askNewGame} disabled={busy !== null} data-testid="new-game">Nouvelle partie</button>
              <button className="btn sm danger" onClick={askQuit} disabled={busy !== null} data-testid="quit">Quitter le jeu</button>
            </>
          )}
        </div>
      </div>

      {offline && hasGame && (
        <div className="banner bad" role="status" data-testid="banner-offline">
          Connexion perdue… La partie est en sécurité en base : rien n’est perdu, la régie se reconnecte toute seule.
        </div>
      )}
      {held && (
        <div className="banner warn" role="status" data-testid="banner-held">
          Un autre jeu est à l’écran : AnimaBingo est en pause. Boules, gagnants, joueurs et cartons sont gardés.
          <button className="btn gold" onClick={() => void launch()} disabled={busy !== null} data-testid="resume-bingo">
            {busy === 'launch' ? 'Reprise…' : '▶ Reprendre AnimaBingo'}
          </button>
        </div>
      )}
      {banner && !held && (
        <div className="banner info" role="status" data-testid="banner-resumed">
          {banner}
          <button className="btn sm ghost" onClick={() => setBanner(null)}>OK</button>
        </div>
      )}

      {!hasGame ? (
        <div className="setup" data-testid="bingo-setup">
          <div className="setup-left">
          <div className="box">
            <h3>Préparer le loto</h3>
            <p className="lead">
              Les joueurs scannent le QR code de la soirée et reçoivent leurs cartons sur leur téléphone. Vous tirez les boules ici,
              l’écran géant les montre à toute la salle. La formule (classique, quine suivie, carton plein…) se choisit dans la régie, avant chaque partie.
            </p>
            <MusicPicker
              mode={mode}
              onMode={setMode}
              playlists={playlists}
              onPlaylists={setPlaylists}
              playlistId={playlistId}
              onPlaylist={setPlaylistId}
              onOpenLibrary={() => setLibraryOpen(true)}
            />
            <button className="btn gold launch" onClick={() => void launch()} disabled={busy !== null} data-testid="launch">
              {busy === 'launch' ? 'Lancement…' : '▶ Afficher AnimaBingo sur l’écran géant'}
            </button>
            <p className="note" style={{ textAlign: 'center' }}>Lancer AnimaBingo met en pause le jeu en cours sur l’écran géant (sans rien effacer).</p>
          </div>
          {paperBox}
          </div>
          <div className="box setup-settings">
            <h3>Réglages de la soirée</h3>
            <SettingsForm settings={draft} onChange={setDraft} onTestVoice={voice.test} />
          </div>
        </div>
      ) : (
        <div className="rgrid">
          {music ? (
            <MusicDeck
              live={live!}
              music={music}
              held={held}
              busy={busy}
              tooSoon={tooSoon}
              player={player}
              onStart={() => void run({ action: 'start' }, { key: 'start' })}
              onDraw={() => void draw()}
              onReveal={() => void reveal()}
              step={stepButton}
              links={stepLinks}
            />
          ) : (
          <DrawColumn
            live={live!}
            held={held}
            busy={busy}
            tooSoon={tooSoon}
            autoSec={autoSec}
            setAutoSec={setAutoSec}
            nextIn={nextAt === null ? null : Math.max(0, nextAt - now)}
            onDraw={() => void draw()}
            onStart={() => void run({ action: 'start' }, { key: 'start' })}
            onAuto={(m) => void setAuto(m)}
            onInterval={(sec) => { if (live!.autoMode !== 'manual') void run({ action: 'auto', mode: live!.autoMode, ms: sec * 1000 }, { quiet: true }) }}
            step={stepButton}
            links={stepLinks}
          />
          )}
          {choosing
            ? <div className="col-center"><FormulaPicker live={live!} held={held} busy={busy} run={run} /></div>
            : <CenterColumn live={live!} music={music} drawnFull={drawnFull} />}
          <div className="col-right">
            <ClaimsPanel claims={snap?.claims ?? []} state={live} phase={phase} busyId={decidingId} offset={offset} onDecide={(c, a) => void decide(c, a)} titles={titles} drawnFull={drawnFull} />
            {!(snap?.claims?.length) && <WinnersBox live={live!} music={!!music} />}
            {paperBox}
          </div>
        </div>
      )}

      {settingsOpen && settings && live && (
        <SettingsModal
          initial={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={async (s) => { if (await saveSettings(s)) setSettingsOpen(false) }}
          onTestVoice={voice.test}
        />
      )}
      {formulaOpen && live && !held && (
        <FormulaPanel live={live} busy={busy} run={run} askConfirm={(r) => { setFormulaOpen(false); setConfirmReq(r) }} onClose={() => setFormulaOpen(false)} />
      )}
      {libraryOpen && (
        <PlaylistLibrary onClose={() => setLibraryOpen(false)} onChanged={setPlaylists} notify={notify} askConfirm={setConfirmReq} />
      )}
      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
    </div>
  )
}

// ------------------------------------------------------------------ colonnes

function DrawColumn({ live, held, busy, tooSoon, autoSec, setAutoSec, nextIn, onDraw, onStart, onAuto, onInterval, step, links }: {
  live: Live
  held: boolean
  busy: string | null
  tooSoon: boolean
  autoSec: number
  setAutoSec: (n: number) => void
  nextIn: number | null
  onDraw: () => void
  onStart: () => void
  onAuto: (m: 'manual' | 'auto' | 'paused') => void
  onInterval: (sec: number) => void
  /** À la place de TIRER : continuer / passer à l'étape suivante / nouvelle partie. */
  step: ReactNode
  links: ReactNode
}) {
  const locked = live.status === 'checking'
  const canDraw = !held && live.status === 'running' && live.count < 90
  let hint = <>Télécommande : <kbd>Page ↓</kbd> tirer · <kbd>Page ↑</kbd> pause auto · <kbd>B</kbd> machine / tableau</>
  if (held) hint = <>AnimaBingo est en pause (autre jeu à l’écran).</>
  else if (live.status === 'lobby') hint = <>Choisissez la formule, puis commencez quand la salle est prête.</>
  else if (locked) hint = <>Tirage bloqué pendant la vérification.</>
  else if (live.status === 'celebrating') hint = <>Gagnant validé : remettez le lot, puis continuez.</>
  else if (live.status === 'finished') hint = <>Partie terminée. Les joueurs gardent leurs cartons.</>
  else if (tooSoon) hint = <>La boule s’affiche à l’écran…</>

  const autoMode = live.autoMode
  const secLeft = nextIn === null ? null : Math.ceil(nextIn / 1000)
  return (
    <div className="box" data-testid="draw-column">
      <h2><span>Boule actuelle</span><span>{live.count ? `n° ${live.count}` : ''}</span></h2>
      <div className="current">
        <Ball n={live.last} size={116} />
        <div className="w gold-text" data-testid="last-words">{live.last ? inWords(live.last) : 'aucune boule'}</div>
      </div>
      {live.status === 'lobby' ? (
        <button className="draw" onClick={onStart} disabled={held || busy !== null} data-testid="start">
          <RoundLabel lines={['COMMENCER']} bottom="LA PARTIE" />
        </button>
      ) : step ?? (
        <button className="draw" onClick={onDraw} disabled={!canDraw || tooSoon} data-testid="draw" aria-label="Tirer la boule suivante">
          <RoundLabel lines={['TIRER']} bottom="BOULE SUIVANTE" />
        </button>
      )}
      {links}
      <div className="hint">{hint}</div>

      <div className="seg" role="group" aria-label="Mode de tirage">
        <button aria-pressed={autoMode === 'manual'} onClick={() => onAuto('manual')} disabled={held}>Manuel</button>
        <button aria-pressed={autoMode !== 'manual'} onClick={() => onAuto(autoMode === 'manual' ? 'auto' : autoMode)} disabled={held} data-testid="mode-auto">Automatique</button>
      </div>
      {autoMode !== 'manual' && (
        <>
          <div className="auto">
            <div className="ring" style={{ '--p': autoMode === 'paused' || secLeft === null ? '100%' : `${Math.min(100, (1 - (nextIn ?? 0) / live.autoMs) * 100)}%` } as CSSProperties}>
              {autoMode === 'paused' ? <b style={{ color: '#ffd28a' }}>II</b> : <b>{secLeft ?? '–'}</b>}
            </div>
            <div className="lbl">
              <b style={autoMode === 'paused' ? { color: '#ffd28a' } : undefined}>{autoMode === 'paused' ? 'AUTO EN PAUSE' : `AUTO — ${Math.round(live.autoMs / 1000)} s`}</b>
              <span>{autoMode === 'paused' ? (locked ? 'Demande à vérifier' : 'Reprenez quand vous voulez') : secLeft !== null ? `Prochaine boule dans ${secLeft} s` : 'En attente'}</span>
            </div>
            <button
              className={`btn sm ${autoMode === 'paused' ? 'amber' : 'gold'}`}
              onClick={() => onAuto(autoMode === 'paused' ? 'auto' : 'paused')}
              disabled={held || busy === 'auto'}
              data-testid="auto-toggle"
            >
              {autoMode === 'paused' ? '▶ REPRENDRE' : 'II PAUSE'}
            </button>
          </div>
          <div className="range">
            4 s
            <input
              type="range" min={4} max={20} step={1} value={autoSec} aria-label="Intervalle du tirage automatique (secondes)"
              onChange={(e) => setAutoSec(Number(e.target.value))}
              onPointerUp={(e) => {
                onInterval(autoSec)
                e.currentTarget.blur() // sinon la télécommande (Page ↑/↓) resterait captée par le curseur
              }}
              onKeyUp={() => onInterval(autoSec)}
            />
            20 s
          </div>
        </>
      )}
    </div>
  )
}

function CenterColumn({ live, music, drawnFull }: {
  live: Live
  music: RegieMusic | null
  drawnFull?: readonly number[]
}) {
  const hist = live.drawn.slice(-10, -1).reverse()
  const lot = lotInfo(live)
  const lotsOf = (i: number) => live.lots?.[i] ?? 1
  return (
    <div className="col-center">
      <div className="box center-box">
        <h2><span>Partie {live.round} · déroulé</span><span>{music ? `${(drawnFull ?? live.drawn).length} / ${music.tracks.length} morceaux` : `${live.count} / 90 sorties`}</span></h2>
        <div className="phases">
          {live.phases.map((p, i) => (
            <div key={p} className={`ph ${i < live.phaseIndex ? 'done' : i === live.phaseIndex ? 'now' : ''}`}>
              <small>{i < live.phaseIndex ? 'Jouée' : i === live.phaseIndex ? 'En cours' : i === live.phases.length - 1 ? 'Final' : 'Ensuite'}</small>
              <b>{PHASE_LABELS[p]}</b>
              {lotsOf(i) > 1 && (
                <em className="lotc" data-testid={i === live.phaseIndex ? 'regie-lot' : undefined}>
                  {i === live.phaseIndex ? `Lot ${lot.now} / ${lot.n}` : `${lotsOf(i)} lots`}
                </em>
              )}
            </div>
          ))}
        </div>
        {music ? (
          <MusicBoard music={music} drawn={drawnFull ?? live.drawn} />
        ) : (
          <>
            <Board drawn={live.drawn} last={live.last} className="rboard" />
            <div className="hist">
              <small>Historique</small>
              {hist.map((n) => <Ball key={n} n={n} size={32} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Gagnants de la partie (colonne de droite) : les plus récents, sans jamais défiler. */
function WinnersBox({ live, music }: { live: Live; music: boolean }) {
  const max = useFitCount()
  if (!live.winners.length) return null
  const lotsOf = (p: Phase) => live.lots?.[live.phases.indexOf(p)] ?? 1
  const list = [...live.winners].reverse()
  return (
    <div className="box winners" data-testid="winners">
      <h2><span>Gagnants · partie {live.round}</span><span>{live.winners.length}</span></h2>
      {list.slice(0, max).map((w, i) => (
        <div key={i} className="w">
          <b>{w.name ?? `Carton n° ${w.serial}`}</b>
          <span>{PHASE_LABELS[w.phase]}{w.lot && lotsOf(w.phase) > 1 ? ` · lot ${w.lot}` : ''} · {w.kind === 'paper' ? 'papier ' : ''}n° {w.serial} · {music ? 'morceau' : 'boule'} {w.drawCount}</span>
        </div>
      ))}
      {list.length > max && <div className="note">+ {list.length - max} gagnant{list.length - max > 1 ? 's' : ''} plus tôt dans la partie</div>}
    </div>
  )
}

/** Nombre de gagnants affichables selon la hauteur de l'écran (pas de défilement). */
function useFitCount() {
  const [h, setH] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight))
  useEffect(() => {
    const on = () => setH(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return h < 850 ? 4 : h < 1000 ? 7 : 10
}

function SettingsModal({ initial, onClose, onSave, onTestVoice }: {
  initial: BingoSettings
  onClose: () => void
  onSave: (s: BingoSettings) => Promise<void>
  onTestVoice: () => void
}) {
  const [s, setS] = useState(initial)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="bgo-modal" role="dialog" aria-modal="true" aria-label="Réglages d’AnimaBingo" data-testid="settings-modal">
      <div className="card bgo" style={{ width: 'min(640px, 100%)', boxShadow: '0 0 0 1px rgba(139,77,255,.3), 0 30px 60px rgba(0,0,0,.6)' }}>
        <h4>Réglages de la soirée</h4>
        <p className="note" style={{ marginTop: 0 }}>Les cartons déjà distribués ne changent pas ; le nombre de cartons s’applique aux nouveaux joueurs. La formule se change avec le bouton « Formule » de la régie.</p>
        <SettingsForm settings={s} onChange={setS} onTestVoice={onTestVoice} />
        <div className="acts">
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn gold" disabled={saving} onClick={async () => { setSaving(true); await onSave(s); setSaving(false) }} data-testid="save-settings">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
