'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo · Tombola — régie de l'animateur. Toute la tombola vit en base :
// cette page n'écrit rien elle-même (tout passe par /api/bingo/tombola/admin)
// et peut être fermée, rechargée ou perdre le réseau sans rien perdre.
// Un seul jeu AnimaBingo à la fois : si un loto existe, il faut le quitter.
// Aucun défilement (1366×768 et 1920×1080) : les listes s'adaptent à la hauteur.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import RemoteControlBadge from '@/components/games/RemoteControlBadge'
import type { RemoteLegendData } from '@/components/games/RemoteLegend'
import { Ball } from '@/components/bingo/Ball'
import { MachineSwitch } from '@/components/bingo/regie/MachineSwitch'
import '@/components/bingo/bingo.css'
import '@/components/bingo/tombola/tombola.css'
import { ConfirmDialog, type ConfirmRequest } from '@/components/bingo/regie/ConfirmDialog'
import { useTombolaChannel } from '@/hooks/useTombolaChannel'
import { useLeaveGuard } from '@/hooks/useLeaveGuard'
import { useRemoteControl, useRemoteSwitch } from '@/hooks/useRemoteControl'
import { BINGO_HEARTBEAT_INTERVAL_MS } from '@/lib/bingo/constants'
import {
  TOMBOLA_MAX_RANGES, isPhoneTicket, lotsGiven, normalizeRanges, overlapsPhones, phoneStartAfter, rangesCount, rangesText,
  type TombolaDraw, type TombolaLive, type TombolaPublicState,
} from '@/lib/bingo/tombola'
import type { TombolaCommand, TombolaSnapshot } from '@/lib/bingo/tombola-server'
import { createClient } from '@/lib/supabase'
import { fetchUserSession } from '@/lib/session-select'
import type { Session } from '@/types/database'

/** Écart minimal entre deux numéros imposé par la base. */
const MIN_GAP_MS = 2500
const SOUND_KEY = 'animabingo-tombola-son'

type Result<T = unknown> = { ok: boolean; status: number; data?: T; error?: string; code?: string }

async function request<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init })
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) return { ok: false, status: res.status, error: (json.error as string) ?? 'Action impossible', code: json.code as string | undefined }
    return { ok: true, status: res.status, data: json as T }
  } catch {
    return { ok: false, status: 0, error: 'Connexion perdue, réessayez.' }
  }
}

const isState = (x: unknown): x is TombolaPublicState => !!x && typeof x === 'object' && 'active' in x && 'serverNow' in x

/** Annonces de Claire (ElevenLabs), jouées sur ce PC seulement. */
function useTombolaVoice(on: boolean) {
  const clips = useRef<Record<string, HTMLAudioElement>>({})
  useEffect(() => {
    for (const id of ['tombola-numero', 'tombola-absent']) {
      const a = new Audio(`/sounds/bingo/voix-claire/annonces/${id}.mp3`)
      a.preload = 'auto'
      clips.current[id] = a
    }
  }, [])
  return useCallback((id: 'tombola-numero' | 'tombola-absent') => {
    if (!on) return
    const a = clips.current[id]
    if (!a) return
    try {
      a.currentTime = 0
      void a.play().catch(() => { /* lecture refusée : l'animateur lit lui-même */ })
    } catch { /* idem */ }
  }, [on])
}

export default function TombolaRegiePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [snap, setSnap] = useState<TombolaSnapshot | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [netLost, setNetLost] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null)
  const [markReq, setMarkReq] = useState<{ draw: TombolaDraw; outcome: 'absent' | 'already' } | null>(null)
  const [paperOpen, setPaperOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  // Préparation
  const [draftPaper, setDraftPaper] = useState<[number | '', number | ''][]>([[1, 250]])
  const [draftPhones, setDraftPhones] = useState(true)

  useEffect(() => {
    try { setSoundOn(localStorage.getItem(SOUND_KEY) !== 'off') } catch { /* stockage bloqué */ }
  }, [])
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 15_000)
    return () => clearTimeout(t)
  }, [banner])

  const channel = useTombolaChannel(session?.id, session?.code)
  const { apply, clockOffsetMs: offset, refresh } = channel
  const state = channel.state ?? snap?.state ?? null
  const live: TombolaLive | null = state?.active ? state : null
  const held = !!snap?.held && !!live
  const hasGame = !!live
  const say = useTombolaVoice(soundOn)
  useLeaveGuard(hasGame)

  const refreshSnap = useCallback(async () => {
    if (!session) return
    const r = await request<TombolaSnapshot>(`/api/bingo/tombola/admin?sessionId=${encodeURIComponent(session.id)}`)
    if (r.status === 0) return setNetLost(true)
    if (!r.ok || !r.data) return
    setNetLost(false)
    setSnap(r.data)
    apply(r.data.state)
  }, [session, apply])

  const run = useCallback(async (body: TombolaCommand, opts: { quiet?: boolean; key?: string } = {}): Promise<Result | null> => {
    if (!session) return null
    if (opts.key) setBusy(opts.key)
    try {
      const r = await request('/api/bingo/tombola/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, ...body }),
      })
      if (!r.ok) {
        if (r.status === 0) setNetLost(true)
        if (r.code === 'no_game') void refreshSnap()
        if (!opts.quiet) toast.error(r.error ?? 'Action impossible')
        return r
      }
      setNetLost(false)
      if (isState(r.data)) apply(r.data)
      return r
    } finally {
      if (opts.key) setBusy(null)
    }
  }, [session, apply, refreshSnap])

  // ---------- Chargement : reprise exacte ----------
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
        const url = `/api/bingo/tombola/admin?sessionId=${encodeURIComponent(data.id)}`
        let first = await request<TombolaSnapshot>(url)
        if (cancelled || !first.ok || !first.data) {
          if (first.status === 0) setNetLost(true)
          return
        }
        if (first.data.state.active && !first.data.held) {
          await request('/api/bingo/tombola/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: data.id, action: 'heartbeat' }) })
          const again = await request<TombolaSnapshot>(url)
          if (again.ok && again.data) first = again
        }
        if (cancelled || !first.data) return
        setSnap(first.data)
        apply(first.data.state)
        const s = first.data.state
        if (s.active) {
          setDraftPaper(s.paper.length ? s.paper : [])
          setDraftPhones(s.phoneFrom !== null)
          if (!first.data.held && (s.draws.length > 0 || s.phoneCount > 0)) {
            setBanner(`Tombola reprise : ${lotsGiven(s)} lot${lotsGiven(s) > 1 ? 's' : ''} attribué${lotsGiven(s) > 1 ? 's' : ''}, ${s.left} numéro${s.left > 1 ? 's' : ''} dans la machine. Rien n’a été perdu.`)
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

  // Un autre jeu lancé ou arrêté : on relit (pause / reprise).
  useEffect(() => {
    if (!session?.id) return
    const id = session.id
    let timer: ReturnType<typeof setTimeout> | undefined
    const row = supabase
      .channel(`tombola-admin-${id}`)
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

  // Signal de vie (30 s) + retour du réseau.
  const beat = useCallback(async () => {
    const r = await run({ action: 'heartbeat' }, { quiet: true })
    if (r?.ok && (r.data as { resumed?: boolean } | undefined)?.resumed) {
      setBanner('Connexion rétablie : la tombola a repris exactement où elle était.')
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

  // Fin du suspense (0,9 s) : relecture pour afficher le numéro.
  const revealAt = live?.hidden && live.lastDrawAt ? Date.parse(live.lastDrawAt) + 900 - offset : null
  useEffect(() => {
    if (revealAt === null) return
    const t = setTimeout(() => void refresh(), Math.max(50, revealAt - Date.now() + 150))
    return () => clearTimeout(t)
  }, [revealAt, refresh])
  useEffect(() => {
    if (!live?.lastDrawAt) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [live?.lastDrawAt])
  const tooSoon = !!live?.lastDrawAt && now - (Date.parse(live.lastDrawAt) - offset) < MIN_GAP_MS

  // ---------- Tirage ----------
  const drawing = useRef(false)
  const drawnCount = live ? live.draws.length + (live.hidden ? 1 : 0) : 0
  const canDraw = !!live && !held && live.left > 0 && !tooSoon
  const draw = useCallback(async () => {
    if (!live || held || drawing.current) return
    drawing.current = true
    try {
      const r = await run({ action: 'draw', expect: drawnCount }, { quiet: true })
      if (r?.ok) say('tombola-numero')
      else if (r) {
        if (r.code === 'too_fast') toast.info('Un instant : le numéro précédent est encore à l’écran.')
        else toast.error(r.error ?? 'Tirage impossible')
      }
    } finally {
      drawing.current = false
    }
  }, [live, held, run, drawnCount, say])

  const mark = useCallback(async (d: TombolaDraw, outcome: 'winner' | 'absent' | 'already') => {
    const r = await run({ action: 'mark', seq: d.seq, outcome }, { key: 'mark' })
    if (r?.ok) {
      if (outcome === 'absent') say('tombola-absent')
      toast.success(outcome === 'winner' ? `n° ${d.n} remis gagnant` : `n° ${d.n} retiré`)
    }
  }, [run, say])

  // ---------- Lancement / reprise / fin ----------
  const cleanPaper = useMemo(
    () => normalizeRanges(draftPaper.filter(([a, b]) => a !== '' && b !== '') as [number, number][]),
    [draftPaper],
  )
  const draftInvalid = draftPaper.some(([a, b]) => a === '' || b === '' || a < 1 || b > 9999 || a > b)
  const draftFrom = draftPhones ? phoneStartAfter(cleanPaper) : null

  async function launch() {
    if (!session) return
    if (!live) {
      if (draftInvalid) return void toast.error('Vérifiez les plages de tickets papier (du plus petit au plus grand, de 1 à 9999).')
      if (!cleanPaper.length && !draftPhones) return void toast.error('Ajoutez des tickets papier ou activez les tickets téléphone.')
      if (draftPhones && draftFrom === null) return void toast.error('Plus de place pour les tickets téléphone (numéros jusqu’à 9999).')
    }
    const r = await run({ action: 'launch', paper: live ? live.paper : cleanPaper, phoneFrom: live ? live.phoneFrom : draftFrom }, { key: 'launch' })
    if (!r?.ok) return
    window.open(`/live/${session.code}`, 'photojet-live')
    toast.success(live ? 'Tombola reprise à l’écran' : 'Tombola affichée sur l’écran géant')
    void refreshSnap()
  }

  const askEnd = () => setConfirmReq({
    title: 'Terminer la tombola ?',
    message: 'La tombola est effacée : numéros sortis, gagnants et tickets téléphone.',
    note: 'L’écran géant revient à l’accueil. Notez les gagnants avant si besoin.',
    check: 'J’ai compris : la tombola sera effacée.',
    confirm: 'Terminer et effacer la tombola',
    onConfirm: async () => {
      const r = await run({ action: 'exit' }, { key: 'exit' })
      if (r?.ok) {
        setBanner(null)
        toast.success('Tombola terminée.')
        void refreshSnap()
      }
    },
  })

  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off') } catch { /* stockage bloqué */ }
  }

  function goBack() {
    if (!session) return
    if (hasGame) toast.info('La tombola est gardée : rouvrez-la pour reprendre.')
    router.push(`/admin/jeux?session=${session.id}`)
  }

  // ---------- Télécommande : Page ↓ = tirer ----------
  const [remoteOn, setRemoteOn] = useRemoteSwitch()
  const remoteActive = hasGame && !held && remoteOn
  const remoteBlocked = () => !!confirmReq || !!markReq || paperOpen
  useRemoteControl({
    active: remoteActive,
    phase: `${live?.tombolaId ?? ''}|${drawnCount}`,
    isBlocked: remoteBlocked,
    onNext: async () => {
      if (canDraw) await draw()
    },
  })
  const remoteLegend: RemoteLegendData = {
    active: remoteActive,
    blocked: remoteBlocked(),
    inactiveReason: held ? 'La tombola est en pause (autre jeu à l’écran).' : undefined,
    next: live && live.left > 0 ? 'tirer un numéro' : null,
    prev: null,
    secondary: null,
  }

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
  const last = live && !live.hidden ? live.draws[live.draws.length - 1] ?? null : null
  return (
    <div className="bgo tmb-regie" data-testid="tombola-regie" data-held={held ? '1' : '0'}>
      <div className="rtop">
        <Button variant="ghost" size="sm" onClick={goBack} className="text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1>AnimaBingo · <em>Tombola</em> <span>· session {session.code}</span></h1>
        {hasGame && <span className={`chip ${offline ? 'bad' : ''}`} data-testid="regie-net"><i />{offline ? 'Connexion perdue…' : held ? 'En pause' : 'Écran géant en direct'}</span>}
        <div className="right">
          <button className={`btn sm ${soundOn ? 'ghost' : 'danger'} sound-toggle`} onClick={toggleSound} aria-pressed={soundOn} title="Annonces de Claire sur ce PC" data-testid="sound-toggle">
            {soundOn ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
            {soundOn ? 'Voix activée' : 'Voix coupée'}
          </button>
          <RemoteControlBadge enabled={remoteOn} onToggle={setRemoteOn} gameActive={hasGame && !held} legend={remoteLegend} compactLegend />
          {hasGame && !held && <button className="btn sm gold" onClick={() => window.open(`/live/${session.code}`, 'photojet-live')}>Écran géant</button>}
          {hasGame && <button className="btn sm danger" onClick={askEnd} disabled={busy !== null} data-testid="end">Terminer la tombola</button>}
        </div>
      </div>

      {offline && hasGame && <div className="banner bad" role="status">Connexion perdue… La tombola est en sécurité en base : rien n’est perdu, la régie se reconnecte toute seule.</div>}
      {held && (
        <div className="banner warn" role="status" data-testid="banner-held">
          Un autre jeu est à l’écran : la tombola est en pause. Numéros, gagnants et tickets sont gardés.
          <button className="btn gold" onClick={() => void launch()} disabled={busy !== null} data-testid="resume">{busy === 'launch' ? 'Reprise…' : '▶ Reprendre la tombola'}</button>
        </div>
      )}
      {banner && !held && (
        <div className="banner info" role="status" data-testid="banner-resumed">
          {banner}
          <button className="btn sm ghost" onClick={() => setBanner(null)}>OK</button>
        </div>
      )}

      {!live ? (
        <Setup
          sessionId={session.id}
          lotoRunning={!!snap?.lotoRunning}
          paper={draftPaper}
          onPaper={setDraftPaper}
          phones={draftPhones}
          onPhones={setDraftPhones}
          phoneFrom={draftFrom}
          invalid={draftInvalid}
          busy={busy}
          onLaunch={() => void launch()}
        />
      ) : (
        <div className="tmb-grid">
          <div>
            <div className="box">
              <h2><span>Tirage</span><span>{lotsGiven(live)} lot{lotsGiven(live) > 1 ? 's' : ''} attribué{lotsGiven(live) > 1 ? 's' : ''}</span></h2>
              <button className="btn gold tmb-draw-btn" onClick={() => void draw()} disabled={!canDraw || busy !== null} data-testid="draw">
                {live.left === 0 ? 'Tous les numéros sont sortis' : live.hidden ? 'Tirage…' : '🎟 Tirer un numéro'}
              </button>
              <div className="tmb-small" data-testid="left">
                {live.left} numéro{live.left > 1 ? 's' : ''} dans la machine · lot suivant : <b>Lot {lotsGiven(live) + 1}</b>
              </div>
              <div className="tmb-small">Télécommande : <kbd>Page ↓</kbd> tirer</div>
            </div>
            <div className="box">
              <h2><span>Dernier numéro sorti</span></h2>
              {last ? (
                <>
                  <div className="tmb-last" data-testid="last">
                    <Ball n={last.n} size={70} />
                    <div>
                      <div className="n">n° {last.n}</div>
                      <div className={`lot ${last.o === 'winner' ? '' : 'off'}`}>
                        {last.o === 'winner' ? `Lot ${last.lot}` : last.o === 'absent' ? 'Absent (retiré)' : 'Déjà gagnant (retiré)'}
                        {' · '}{isPhoneTicket(live, last.n) ? 'ticket téléphone' : 'ticket papier'}
                      </div>
                    </div>
                  </div>
                  <div className="tmb-acts">
                    {last.o === 'winner' ? (
                      <>
                        <button className="btn no" onClick={() => setMarkReq({ draw: last, outcome: 'absent' })} disabled={held || busy !== null} data-testid="mark-absent">Absent</button>
                        <button className="btn no" onClick={() => setMarkReq({ draw: last, outcome: 'already' })} disabled={held || busy !== null} data-testid="mark-already">Déjà gagnant</button>
                      </>
                    ) : (
                      <button className="btn ghost full" onClick={() => void mark(last, 'winner')} disabled={held || busy !== null} data-testid="mark-winner">Annuler : remettre gagnant</button>
                    )}
                  </div>
                  <div className="tmb-small">À la souris uniquement, avec confirmation. Le numéro est retiré et le lot est remis en jeu.</div>
                </>
              ) : (
                <div className="tmb-small">{live.hidden ? 'Le numéro s’affiche…' : 'Aucun numéro pour le moment.'}</div>
              )}
            </div>
          </div>

          <div className="box tmb-center">
            <CenterBoard live={live} last={last} />
          </div>

          <div>
            <div className="box">
              <h2><span>Tickets</span></h2>
              <div className="tmb-rows">
                <div><span>Papier</span><b data-testid="paper-ranges">{rangesText(live.paper)}</b></div>
                {live.phoneFrom !== null && <div><span>Téléphone (à partir du n° {live.phoneFrom})</span><b data-testid="phone-count">{live.phoneCount} ticket{live.phoneCount > 1 ? 's' : ''}</b></div>}
                <div><span>Total dans la tombola</span><b data-testid="total">{live.total}</b></div>
                <div><span>Encore dans la machine</span><b>{live.left}</b></div>
              </div>
              <button className="btn sm ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => setPaperOpen(true)} disabled={held} data-testid="edit-paper">
                {live.draws.length || live.hidden ? '+ Ajouter des tickets papier' : 'Modifier les tickets papier'}
              </button>
              {(live.draws.length > 0 || live.hidden) && <div className="tmb-small">Tirage commencé : on peut ajouter des plages, jamais en retirer.</div>}
              <div className="tmb-machine" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                <span className="tmb-small" style={{ margin: 0 }}>Machine du grand écran (ce PC)</span>
                <MachineSwitch />
              </div>
            </div>
            {live.phoneFrom !== null && (
              <div className="box">
                <h2><span>Tickets téléphone</span></h2>
                <div className="tmb-phone-from" data-testid="phone-from">Tickets téléphone à partir du n° {live.phoneFrom}</div>
                <div className="tmb-rows" style={{ marginTop: 6 }}>
                  <div><span>Distribution</span><b className={live.phoneOpen ? 'open' : 'closed'} data-testid="phone-open">{live.phoneOpen ? 'Ouverte' : 'Fermée'}</b></div>
                </div>
                <button
                  className={`btn sm ${live.phoneOpen ? 'ghost' : 'gold'}`}
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={() => void run({ action: 'phones', open: !live.phoneOpen }, { key: 'phones' })}
                  disabled={held || busy !== null}
                  data-testid="toggle-phones"
                >
                  {live.phoneOpen ? 'Fermer la distribution' : 'Rouvrir (retardataires)'}
                </button>
                <div className="tmb-small">Fermée automatiquement au premier tirage. Un téléphone qui recharge retrouve toujours son numéro.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {markReq && (
        <MarkDialog
          req={markReq}
          lot={markReq.draw.lot}
          onCancel={() => setMarkReq(null)}
          onConfirm={async () => {
            const r = markReq
            setMarkReq(null)
            await mark(r.draw, r.outcome)
          }}
        />
      )}
      {paperOpen && live && (
        <PaperDialog
          live={live}
          onClose={() => setPaperOpen(false)}
          onSave={async (paper) => {
            const phoneFrom = live.phoneFrom === null ? null : live.phoneCount > 0 ? live.phoneFrom : phoneStartAfter(paper)
            const r = await run({ action: 'config', paper, phoneFrom }, { key: 'config' })
            if (r?.ok) {
              setPaperOpen(false)
              toast.success('Tickets papier enregistrés')
            }
          }}
        />
      )}
      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
    </div>
  )
}

// ------------------------------------------------------------------ préparation

function Setup({ sessionId, lotoRunning, paper, onPaper, phones, onPhones, phoneFrom, invalid, busy, onLaunch }: {
  sessionId: string
  lotoRunning: boolean
  paper: [number | '', number | ''][]
  onPaper: (p: [number | '', number | ''][]) => void
  phones: boolean
  onPhones: (on: boolean) => void
  phoneFrom: number | null
  invalid: boolean
  busy: string | null
  onLaunch: () => void
}) {
  const router = useRouter()
  return (
    <div className="tmb-setup" data-testid="tombola-setup">
      <div className="box">
        <h2><span>Préparer AnimaBingo</span></h2>
        <div className="tmb-pick" role="group" aria-label="Jeu">
          <button type="button" aria-pressed="false" onClick={() => router.push(`/admin/jeux/bingo?session=${sessionId}`)}><b>Loto</b><span>Cartons de 15 numéros : quine, double quine, carton plein.</span></button>
          <button type="button" aria-pressed="false" onClick={() => router.push(`/admin/jeux/bingo?session=${sessionId}`)}><b>Loto musical</b><span>Les titres d’une playlist à la place des numéros.</span></button>
          <button type="button" aria-pressed="true"><b>Tombola</b><span>Tickets numérotés, un lot par numéro tiré.</span></button>
        </div>
        {lotoRunning && (
          <div className="banner warn" style={{ margin: '0 0 12px' }} data-testid="loto-running">
            Un loto est en cours sur cette session : quittez-le d’abord (régie du loto, « Quitter le jeu »).
            <button className="btn sm gold" onClick={() => router.push(`/admin/jeux/bingo?session=${sessionId}`)}>Régie du loto</button>
          </div>
        )}
        <h2 style={{ marginTop: 6 }}><span>Tickets papier distribués</span></h2>
        <RangesEditor paper={paper} onPaper={onPaper} />
        {invalid && <div className="tmb-err">Chaque plage va du plus petit au plus grand numéro, de 1 à 9999.</div>}
        <button className="btn gold" style={{ width: '100%', marginTop: 16 }} onClick={onLaunch} disabled={busy !== null || lotoRunning} data-testid="launch">
          {busy === 'launch' ? 'Lancement…' : '▶ Afficher la tombola sur l’écran géant'}
        </button>
        <p className="tmb-small">Lancer la tombola met en pause le jeu en cours sur l’écran géant (sans rien effacer).</p>
      </div>
      <div className="box">
        <h2><span>Tickets sur téléphone</span></h2>
        <label className="tmb-switch">
          <input type="checkbox" checked={phones} onChange={(e) => onPhones(e.target.checked)} data-testid="phones-on" />
          Chaque invité qui scanne le QR reçoit un ticket
        </label>
        {phones && phoneFrom !== null && <div className="tmb-phone-from" data-testid="setup-phone-from">Tickets téléphone à partir du n° {phoneFrom}</div>}
        {phones && phoneFrom === null && <div className="tmb-err">Plus de place pour les tickets téléphone (numéros jusqu’à 9999).</div>}
        <p className="tmb-small" style={{ textAlign: 'left' }}>
          Un seul ticket par téléphone, jamais en conflit avec le papier (toujours après, à la centaine suivante).
          La distribution se ferme au premier tirage ; vous pourrez la rouvrir pour les retardataires.
        </p>
        <p className="tmb-small" style={{ textAlign: 'left' }}>
          AnimaJet fournit l’outil de tirage : l’organisateur reste responsable de sa tombola et du respect de la réglementation.
        </p>
      </div>
    </div>
  )
}

function RangesEditor({ paper, onPaper }: { paper: [number | '', number | ''][]; onPaper: (p: [number | '', number | ''][]) => void }) {
  const num = (v: string): number | '' => (v === '' ? '' : Math.max(0, Math.min(9999, Math.floor(Number(v) || 0))))
  return (
    <div className="tmb-ranges">
      {paper.map(([a, b], i) => (
        <div className="tmb-range" key={i}>
          du
          <input inputMode="numeric" autoComplete="off" name={`plage-debut-${i}`} aria-label={`Plage ${i + 1} : premier numéro`} value={a} onChange={(e) => onPaper(paper.map((r, j) => (j === i ? [num(e.target.value), r[1]] : r)))} data-testid={`range-from-${i}`} />
          au
          <input inputMode="numeric" autoComplete="off" name={`plage-fin-${i}`} aria-label={`Plage ${i + 1} : dernier numéro`} value={b} onChange={(e) => onPaper(paper.map((r, j) => (j === i ? [r[0], num(e.target.value)] : r)))} data-testid={`range-to-${i}`} />
          <button type="button" className="btn sm ghost" onClick={() => onPaper(paper.filter((_, j) => j !== i))} aria-label={`Retirer la plage ${i + 1}`}>✕</button>
        </div>
      ))}
      {paper.length < TOMBOLA_MAX_RANGES && (
        <button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => onPaper([...paper, ['', '']])} data-testid="add-range">+ Ajouter une plage</button>
      )}
      <div className="tmb-small" style={{ textAlign: 'left' }}>{rangesCount(paper.filter(([a, b]) => a !== '' && b !== '') as [number, number][])} tickets papier</div>
    </div>
  )
}

// ------------------------------------------------------------------ centre

function useRows() {
  const [h, setH] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight))
  useEffect(() => {
    const on = () => setH(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return h < 850 ? 4 : h < 1000 ? 6 : 8
}

function CenterBoard({ live, last }: { live: TombolaLive; last: TombolaDraw | null }) {
  const rows = useRows()
  const winners = live.draws.filter((d) => d.o === 'winner')
  const shown = winners.slice(-rows * 6)
  const out = live.draws.filter((d) => d.o !== 'winner').slice(-8)
  const hero = last ?? null
  return (
    <>
      <div className="tmb-big">
        <Ball n={hero?.n ?? null} size={120} />
        <div>
          <div className="lbl">{hero ? (hero.o === 'winner' ? 'LOT' : 'RETIRÉ') : 'LOT'}</div>
          <div className="v gold-text" data-testid="center-lot">{hero ? (hero.o === 'winner' ? hero.lot : hero.o === 'absent' ? 'Absent' : 'Déjà gagnant') : '–'}</div>
        </div>
      </div>
      <h2><span>Gagnants</span><span>dans l’ordre des lots</span></h2>
      <div className="tmb-wgrid" data-testid="winners">
        {shown.map((w) => (
          <div key={w.seq} className={`w ${hero && w.seq === hero.seq ? 'now' : ''}`}><small>Lot {w.lot}</small><b>{w.n}</b></div>
        ))}
      </div>
      {winners.length > shown.length && <div className="tmb-out">Les {shown.length} derniers lots · {winners.length - shown.length} plus tôt</div>}
      {out.length > 0 && (
        <div className="tmb-out" data-testid="removed">
          Retirés (ne comptent pas comme un lot) :{' '}
          {out.map((d) => <s key={d.seq}>n° {d.n} · {d.o === 'absent' ? 'absent' : 'déjà gagnant'}</s>)}
        </div>
      )}
    </>
  )
}

// ------------------------------------------------------------------ fenêtres

function MarkDialog({ req, lot, onCancel, onConfirm }: {
  req: { draw: TombolaDraw; outcome: 'absent' | 'already' }
  lot: number | null
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  const n = req.draw.n
  return (
    <div className="bgo-modal" data-bingo-modal role="alertdialog" aria-modal="true" aria-label="Confirmation" data-testid="mark-confirm">
      <div className="card bgo">
        <h4>{req.outcome === 'absent' ? `Le n° ${n} est absent ?` : `Le n° ${n} a déjà gagné ?`}</h4>
        <p>Le numéro est retiré : il ne recevra pas de lot et ne pourra plus sortir.{lot ? <> Le <b>Lot {lot}</b> sera remis en jeu au prochain tirage.</> : null}</p>
        <div className="acts">
          <button ref={cancelRef} className="btn ghost" onClick={onCancel}>Annuler</button>
          <button className="btn no" onClick={() => void onConfirm()} data-testid="mark-ok">Oui, retirer le n° {n}</button>
        </div>
      </div>
    </div>
  )
}

function PaperDialog({ live, onClose, onSave }: { live: TombolaLive; onClose: () => void; onSave: (paper: [number, number][]) => Promise<void> }) {
  const [paper, setPaper] = useState<[number | '', number | ''][]>(live.paper.length ? live.paper : [['', '']])
  const [saving, setSaving] = useState(false)
  const started = live.draws.length > 0 || live.hidden
  const clean = normalizeRanges(paper.filter(([a, b]) => a !== '' && b !== '') as [number, number][])
  const invalid = paper.some(([a, b]) => a === '' || b === '' || a < 1 || b > 9999 || a > b)
  const lockedFrom = live.phoneFrom !== null && live.phoneCount > 0 ? live.phoneFrom : null
  const overlap = overlapsPhones(clean, lockedFrom)
  const removes = started && live.paper.some(([a, b]) => !clean.some(([x, y]) => x <= a && y >= b))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="bgo-modal" role="dialog" aria-modal="true" aria-label="Tickets papier" data-testid="paper-dialog">
      <div className="card bgo" style={{ width: 'min(560px, 100%)' }}>
        <h4>Tickets papier</h4>
        <RangesEditor paper={paper} onPaper={setPaper} />
        {invalid && <div className="tmb-err">Chaque plage va du plus petit au plus grand numéro, de 1 à 9999.</div>}
        {overlap && <div className="tmb-err">Une plage touche les tickets téléphone (à partir du n° {lockedFrom}).</div>}
        {removes && <div className="tmb-err">Tirage commencé : on peut ajouter des plages, jamais en retirer.</div>}
        {lockedFrom === null && live.phoneFrom !== null && !overlap && !invalid && (
          <div className="tmb-small">Tickets téléphone ensuite à partir du n° {phoneStartAfter(clean) ?? '—'}</div>
        )}
        <div className="acts">
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn gold"
            disabled={saving || invalid || overlap || removes || (!clean.length && live.phoneFrom === null)}
            onClick={async () => { setSaving(true); await onSave(clean); setSaving(false) }}
            data-testid="save-paper"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
