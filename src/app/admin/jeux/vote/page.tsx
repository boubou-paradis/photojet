'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaVote - page animateur. Avant le lancement : l'éditeur (brouillon
// enregistré automatiquement). Pendant : un seul grand bouton qui change
// selon l'étape (ouvrir, fermer, révéler, étape suivante). Toutes les
// décisions passent par /api/vote/admin (fonction SQL sous verrou) ; cette
// page n'écrit rien elle-même. F5 ou onglet fermé = PAUSE (rien n'est
// effacé) : le vote reprend à la réouverture. Effacement seulement sur
// « Quitter AnimaVote ».

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, LogOut, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import AnimaVoteLogo from '@/components/vote/AnimaVoteLogo'
import CandidatePhoto, { candidateName } from '@/components/vote/CandidateVisual'
import { voteFontVars } from '@/components/vote/fonts'
import { VOTE_CSS } from '@/components/vote/styles'
import { ADMIN_CSS } from '@/components/vote/admin/styles'
import VoteEditor, { DEFAULT_DRAFT, draftProblem, toEditorDraft, toPayload, type EditorDraft } from '@/components/vote/admin/VoteEditor'
import PhotoCropModal from '@/app/admin/jeux/mystery/PhotoCropModal'
import { useLeaveGuard } from '@/hooks/useLeaveGuard'
import { useVoteChannel } from '@/hooks/useVoteChannel'
import { compressImage, validateImageFile } from '@/lib/image-utils'
import { VOTE_HEARTBEAT_INTERVAL_MS } from '@/lib/vote/constants'
import { availableActions, closingRemainingMs, primaryAction } from '@/lib/vote/machine'
import { computeRanking, lastRevealStep, participationPercent, revealPlan, type Ranking, type RevealStep } from '@/lib/vote/results'
import type { VoteActiveState, VoteDraft, VoteEvent, VoteResults, VoteState } from '@/lib/vote/types'
import { createClient } from '@/lib/supabase'
import { fetchUserSession } from '@/lib/session-select'
import type { Session } from '@/types/database'

type AdminAction =
  | 'launch' | 'exit' | 'heartbeat' | 'snapshot' | 'save_draft' | 'edit' | 'open' | 'close'
  | 'cancel_close' | 'settle' | 'reveal' | 'reveal_next' | 'second_round' | 'new_vote'

interface AdminResult {
  ok: boolean
  status: number
  error?: string
  state?: VoteState
  tally?: (VoteResults & { total: number }) | null
  draft?: VoteDraft | null
}

// Colonnes des autres jeux (AnimaVote s'efface si l'un d'eux est lancé après lui).
const OTHER_GAME_FLAGS = ['quiz_active', 'quiz_lobby_visible', 'lineup_active', 'wheel_active', 'mystery_photo_active', 'affinity_active', 'buzzer_active'] as const
type OtherFlags = Record<(typeof OTHER_GAME_FLAGS)[number], boolean>
const readFlags = (row: Partial<Session>): OtherFlags =>
  Object.fromEntries(OTHER_GAME_FLAGS.map((flag) => [flag, row[flag] === true])) as OtherFlags

// Colonne ajoutée par la migration AnimaVote (pas encore dans le type Session partagé).
type VoteSession = Session & { vote_active?: boolean | null }

const SNAPSHOT_MS = 3000
const DRAFT_SAVE_DELAY_MS = 1200
const RING = 326.7

/** Éditeur affiché : préparation (avant lancement), modification du lobby, ou nouveau vote. */
type EditorMode = 'setup' | 'edit' | 'new'

async function callAdmin(sessionId: string, action: AdminAction, args: Record<string, unknown> = {}): Promise<AdminResult> {
  try {
    const res = await fetch('/api/vote/admin', {
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

export default function VoteAdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [session, setSession] = useState<VoteSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tally, setTally] = useState<(VoteResults & { total: number }) | null>(null)

  const [draft, setDraft] = useState<EditorDraft>(DEFAULT_DRAFT)
  const [editorMode, setEditorMode] = useState<EditorMode | null>('setup')
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [crop, setCrop] = useState<{ key: string; src: string } | null>(null)
  const draftDirty = useRef(false)

  const channel = useVoteChannel(active && session ? session.id : null, 'screen')
  const { apply } = channel
  const state = active && channel.state?.active ? channel.state : null

  const activeRef = useRef(false)
  const baselineRef = useRef<OtherFlags | null>(null)

  useLeaveGuard(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  const applySnapshot = useCallback((result: AdminResult) => {
    if (result.state) apply(result.state)
    if (result.tally !== undefined) setTally(result.tally)
  }, [apply])

  // ---------- Chargement : brouillon, et reprise d'un vote en cours (après F5) ----------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        const data = (await fetchUserSession(supabase, user.id, searchParams.get('session'))) as VoteSession
        if (cancelled) return
        setSession(data)
        let resumed = false
        if (data.vote_active) {
          // Signal de vie d'abord : il lève une éventuelle pause.
          const beat = await callAdmin(data.id, 'heartbeat')
          resumed = beat.ok
        }
        const snap = await callAdmin(data.id, 'snapshot')
        if (cancelled) return
        if (snap.draft) setDraft(toEditorDraft(snap.draft))
        if (resumed) {
          baselineRef.current = readFlags(data)
          applySnapshot(snap)
          setActive(true)
          setEditorMode(null)
          toast.success('Vote AnimaVote repris')
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

  // ---------- Brouillon : enregistré automatiquement pendant l'édition ----------
  const sessionId = session?.id
  useEffect(() => {
    if (!sessionId || !editorMode || !draftDirty.current) return
    const timer = setTimeout(() => {
      draftDirty.current = false
      void callAdmin(sessionId, 'save_draft', toPayload(draft) as unknown as Record<string, unknown>)
    }, DRAFT_SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft, editorMode, sessionId])

  const changeDraft = useCallback((next: EditorDraft) => {
    draftDirty.current = true
    setDraft(next)
  }, [])

  // ---------- Photo : recadrage 4:5 (outil existant), compression, envoi ----------
  async function pickPhoto(key: string, file: File) {
    const check = await validateImageFile(file)
    if (!check.valid) {
      toast.error(check.error ?? 'Fichier non reconnu comme une image')
      return
    }
    setCrop({ key, src: URL.createObjectURL(file) })
  }

  async function uploadCropped(key: string, blob: Blob) {
    if (!session) return
    setUploadingKey(key)
    try {
      const file = await compressImage(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
      const form = new FormData()
      form.append('sessionId', session.id)
      form.append('file', file)
      const res = await fetch('/api/vote/photo', { method: 'POST', body: form })
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !body.url) {
        toast.error(body.error ?? 'Envoi de la photo impossible')
        return
      }
      const url = body.url
      setDraft((d) => {
        draftDirty.current = true
        return { ...d, candidates: d.candidates.map((c) => (c.key === key ? { ...c, imageUrl: url } : c)) }
      })
    } catch {
      toast.error('Envoi de la photo impossible')
    } finally {
      setUploadingKey(null)
    }
  }

  // ---------- Sortie ----------
  const exitVote = useCallback(async (reason: 'quit' | 'other-game') => {
    if (!session) return
    const result = await callAdmin(session.id, 'exit')
    if (!result.ok && result.status !== 0) {
      toast.error(result.error ?? 'Impossible d’arrêter AnimaVote')
      return
    }
    activeRef.current = false
    baselineRef.current = null
    setActive(false)
    setTally(null)
    setEditorMode('setup')
    if (reason === 'other-game') toast.info('Un autre jeu a été lancé : AnimaVote s’est arrêté.')
    else toast.success('AnimaVote arrêté. Les votes de la soirée ont été effacés (votre vote préparé est gardé).')
  }, [session])

  // ---------- Un autre jeu lancé après AnimaVote : il s'efface ----------
  useEffect(() => {
    if (!session?.id) return
    const id = session.id
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      if (!activeRef.current || !baselineRef.current) return
      const { data } = await supabase.from('sessions').select(OTHER_GAME_FLAGS.join(', ')).eq('id', id).single()
      if (!data) return
      const now = readFlags(data as Partial<Session>)
      if (OTHER_GAME_FLAGS.some((flag) => now[flag] && !baselineRef.current![flag])) void exitVote('other-game')
    }
    const channelRow = supabase
      .channel(`vote-admin-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${id}` }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => void check(), 150)
      })
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channelRow)
    }
  }, [session?.id, supabase, exitVote])

  // ---------- Signal de vie et relecture des totaux ----------
  useEffect(() => {
    if (!active || !session?.id) return
    const id = session.id
    const beat = async () => {
      const result = await callAdmin(id, 'heartbeat')
      if (result.status === 409) {
        // Plus de vote côté serveur (purge, autre onglet) : on s'aligne.
        activeRef.current = false
        setActive(false)
        setEditorMode('setup')
        return
      }
      if (result.ok && result.state && 'active' in result.state) apply(result.state)
    }
    const snap = async () => applySnapshot(await callAdmin(id, 'snapshot'))
    const beatTimer = setInterval(beat, VOTE_HEARTBEAT_INTERVAL_MS)
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
      void callAdmin(session.id, 'snapshot').then(applySnapshot)
      return result
    } finally {
      if (!quiet) setBusy(false)
    }
  }, [session, apply, applySnapshot])

  // Fin du compte à rebours : on fait constater la fermeture (la base revérifie l'heure).
  const closesAt = state?.event?.status === 'open' ? state.event.closesAt : null
  const offset = channel.clockOffsetMs
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!closesAt) return
    const tick = setInterval(() => setNow(Date.now()), 250)
    const wait = Math.max(0, Date.parse(closesAt) - (Date.now() + offset)) + 200
    const timer = setTimeout(() => void act('settle', {}, true), wait)
    return () => {
      clearInterval(tick)
      clearTimeout(timer)
    }
  }, [closesAt, offset, act])

  async function launch() {
    if (!session) return
    const problem = draftProblem(draft)
    if (problem) {
      toast.error(problem)
      return
    }
    setBusy(true)
    try {
      const result = await callAdmin(session.id, 'launch', toPayload(draft) as unknown as Record<string, unknown>)
      if (!result.ok) {
        toast.error(result.error ?? 'Lancement impossible')
        return
      }
      draftDirty.current = false
      baselineRef.current = readFlags({})
      activeRef.current = true
      if (result.state) apply(result.state)
      setTally(null)
      setActive(true)
      setEditorMode(null)
      window.open(`/live/${session.code}`, 'photojet-live')
      toast.success('Lobby AnimaVote affiché sur l’écran géant')
    } finally {
      setBusy(false)
    }
  }

  async function saveEditor() {
    const problem = draftProblem(draft)
    if (problem) {
      toast.error(problem)
      return
    }
    const action = editorMode === 'new' ? 'new_vote' : 'edit'
    const result = await act(action, toPayload(draft) as unknown as Record<string, unknown>)
    if (result?.ok) {
      draftDirty.current = false
      setEditorMode(null)
      toast.success(action === 'new_vote' ? 'Nouveau vote affiché sur l’écran géant' : 'Vote modifié')
    }
  }

  async function quit() {
    if (!window.confirm('Quitter AnimaVote ? Les participants et tous les votes de la soirée seront effacés. Votre vote préparé est gardé.')) return
    setBusy(true)
    await exitVote('quit')
    setBusy(false)
  }

  function goBack() {
    if (!session) return
    if (activeRef.current) toast.info('AnimaVote reste en pause : rouvrez-le pour reprendre le vote.')
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

  const editing = editorMode !== null && (!active || editorMode !== 'setup')
  const problem = draftProblem(draft)

  return (
    <div className={`av-root min-h-screen bg-[#0D0D0F] ${voteFontVars}`}>
      <style>{VOTE_CSS + ADMIN_CSS}</style>
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
              <AnimaVoteLogo variant="small" mark size="22px" />
              <p className="text-xs text-gray-500 mt-1">{session.name} · session {session.code}</p>
            </div>
          </div>
          {active && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => window.open(`/live/${session.code}`, 'photojet-live')} className="bg-[#D4AF37] text-[#1A1A1E] hover:bg-[#F4D03F]">
                <Monitor className="h-4 w-4 mr-2" />
                Écran géant
              </Button>
              <Button size="sm" onClick={quit} disabled={busy} className="bg-red-600 text-white font-semibold hover:bg-red-500 border border-red-400/60 shadow-[0_0_14px_rgba(220,38,38,0.45)]">
                <LogOut className="h-4 w-4 mr-2" />
                Quitter AnimaVote
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="ava relative z-10 px-4 sm:px-8 py-6">
        <div className="ava-grid mx-auto" style={{ maxWidth: 1240 }}>
          {editing ? (
            <>
              <StepPills current={0} />
              <VoteEditor draft={draft} onChange={changeDraft} uploadingKey={uploadingKey} onPickPhoto={(key, file) => void pickPhoto(key, file)} />
              <div className="ava-act-row">
                {editorMode === 'setup' ? (
                  <>
                    <button type="button" className="ava-act go" onClick={() => void launch()} disabled={busy || problem !== null || uploadingKey !== null}>
                      {busy ? 'LANCEMENT…' : 'PASSER AU LOBBY'}
                    </button>
                    <span className="ava-sub">{problem ?? 'Affiche le QR sur l’écran géant. Les téléphones attendent l’ouverture du vote.'}</span>
                  </>
                ) : (
                  <>
                    <button type="button" className="ava-act go" onClick={() => void saveEditor()} disabled={busy || problem !== null || uploadingKey !== null}>
                      {editorMode === 'new' ? 'AFFICHER CE NOUVEAU VOTE' : 'ENREGISTRER LES MODIFICATIONS'}
                    </button>
                    <button type="button" className="ava-cancel" onClick={() => setEditorMode(null)} disabled={busy}>Annuler</button>
                    <span className="ava-sub">{problem ?? (editorMode === 'new' ? 'Mêmes participants, même QR : les téléphones reçoivent le nouveau bulletin.' : 'Les téléphones et l’écran géant se mettent à jour.')}</span>
                  </>
                )}
              </div>
            </>
          ) : active && state ? (
            <Pilot
              state={state}
              tally={tally}
              busy={busy}
              serverNow={now + offset}
              onAction={(a, args) => void act(a, args)}
              onEdit={() => setEditorMode('edit')}
              onNewVote={() => setEditorMode('new')}
            />
          ) : (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" /></div>
          )}
        </div>
      </main>

      {crop && (
        <PhotoCropModal
          imageSrc={crop.src}
          gridCols={4}
          gridRows={5}
          onCancel={() => {
            URL.revokeObjectURL(crop.src)
            setCrop(null)
          }}
          onConfirm={(blob) => {
            const key = crop.key
            URL.revokeObjectURL(crop.src)
            setCrop(null)
            void uploadCropped(key, blob)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Pilotage
// ---------------------------------------------------------------------

const STEP_LABELS = ['Préparation', 'Lobby', 'Vote ouvert', 'Vote fermé', 'Résultats']

function StepPills({ current }: { current: number }) {
  return (
    <div className="ava-steps">
      {STEP_LABELS.map((label, i) => <span key={label} className={i < current ? 'done' : i === current ? 'now' : undefined}>{label}</span>)}
    </div>
  )
}

const stepIndexOf = (event: VoteEvent) => ({ lobby: 1, open: 2, closed: 3, revealed: 4 })[event.status]

function nextRevealLabel(step: RevealStep | undefined): string {
  switch (step?.kind) {
    case 'place': return step.rank === 3 ? 'AFFICHER LA 3E PLACE' : 'AFFICHER LA 2E PLACE'
    case 'winner': return 'RÉVÉLER LE GAGNANT'
    case 'tie': return 'AFFICHER LE RÉSULTAT'
    case 'full': return 'AFFICHER LE CLASSEMENT'
    default: return 'CONTINUER'
  }
}

interface PilotProps {
  state: VoteActiveState
  tally: (VoteResults & { total: number }) | null
  busy: boolean
  serverNow: number
  onAction: (action: AdminAction, args?: Record<string, unknown>) => void
  onEdit: () => void
  onNewVote: () => void
}

function Pilot({ state, tally, busy, serverNow, onAction, onEdit, onNewVote }: PilotProps) {
  const event = state.event
  if (!event) {
    return (
      <div className="ava-box">
        <p className="ava-sub">Aucun vote affiché.</p>
        <div className="ava-after" style={{ marginTop: 12 }}><button type="button" onClick={onNewVote}>Préparer un vote</button></div>
      </div>
    )
  }

  // L'animateur voit toujours les vrais totaux (masqués à l'écran en mode caché).
  const results = state.results ?? tally
  const ranking = computeRanking(event.candidates, results)
  const plan = revealPlan(event.revealMode, ranking)
  const lastStep = lastRevealStep(event.revealMode, ranking)
  const actions = availableActions(state, lastStep)
  const primary = primaryAction(state, lastStep)
  const remaining = closingRemainingMs(state, serverNow)
  const total = results ? results.blank + results.counts.reduce((s, c) => s + c.votes, 0) : state.total
  const shownTotal = Math.max(total, state.total)
  const pct = participationPercent(shownTotal, state.participants)
  const hidden = event.resultsMode === 'hidden' && event.status !== 'revealed'

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepPills current={stepIndexOf(event)} />
        <span className="ava-sub">{event.roundNo > 1 ? `Second tour · ` : ''}{event.title}</span>
      </div>

      <div className="ava-kpis">
        <div className="ava-kpi"><small>Connectés</small><b>{state.participants}</b></div>
        <div className="ava-kpi"><small>Votes</small><b>{shownTotal}</b></div>
        <div className="ava-kpi"><small>Participation</small><b>{pct} %</b><div className="bar"><i style={{ width: `${pct}%` }} /></div></div>
      </div>

      <div className="ava-cols">
        <div className="ava-grid">
          {remaining !== null ? (
            <div className="ava-box ava-ring">
              <svg viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r="52" fill="none" stroke="#221d40" strokeWidth="10" />
                <circle className="p" cx="60" cy="60" r="52" fill="none" stroke="#e0409a" strokeWidth="10" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - remaining / 1000 / Math.max(event.countdownS, 1))} />
              </svg>
              <div>
                <div className="big">{remaining > 0 ? `Fermeture dans ${Math.ceil(remaining / 1000)} s` : 'Fermeture…'}</div>
                <div className="ava-sub">{shownTotal} votes · les derniers bulletins arrivent encore</div>
              </div>
            </div>
          ) : null}

          <PrimaryAction
            primary={primary}
            event={event}
            nextStep={plan[event.revealStep + 1]}
            busy={busy}
            onAction={onAction}
          />

          <ScreenSays event={event} total={shownTotal} plan={plan} />

          {event.status === 'lobby' && (
            <div className="ava-after"><button type="button" onClick={onEdit} disabled={busy}>Modifier le vote</button></div>
          )}

          {(actions.includes('second_round') || actions.includes('new_vote')) && event.status !== 'lobby' && (
            <AfterVote event={event} ranking={ranking} busy={busy} canSecond={actions.includes('second_round')} onAction={onAction} onNewVote={onNewVote} />
          )}
        </div>

        <ResultsBox ranking={ranking} hidden={hidden} hasResults={results !== null} />
      </div>
    </>
  )
}

function PrimaryAction({ primary, event, nextStep, busy, onAction }: { primary: ReturnType<typeof primaryAction>; event: VoteEvent; nextStep: RevealStep | undefined; busy: boolean; onAction: PilotProps['onAction'] }) {
  if (!primary) return null
  switch (primary) {
    case 'open':
      return (
        <div className="ava-act-row">
          <button type="button" className="ava-act go" onClick={() => onAction('open')} disabled={busy}>OUVRIR LE VOTE</button>
          <span className="ava-sub">Les téléphones affichent le bulletin.</span>
        </div>
      )
    case 'close':
      return (
        <div className="ava-act-row">
          <button type="button" className="ava-act stop" onClick={() => onAction('close')} disabled={busy}>FERMER LE VOTE</button>
          <span className="ava-sub">{event.countdownS > 0 ? `Compte à rebours ${event.countdownS} s · annulable` : 'Fermeture immédiate'}</span>
        </div>
      )
    case 'cancel_close':
      return (
        <div className="ava-act-row">
          <button type="button" className="ava-cancel" onClick={() => onAction('cancel_close')} disabled={busy}>Annuler la fermeture</button>
          <button type="button" className="ava-act" disabled>RÉVÉLER LES RÉSULTATS</button>
        </div>
      )
    case 'reveal':
      return (
        <div className="ava-act-row">
          <button type="button" className="ava-act gold" onClick={() => onAction('reveal')} disabled={busy}>RÉVÉLER LES RÉSULTATS</button>
          <span className="ava-sub">L’écran géant annonce le nombre de votants, puis la suite à chaque appui.</span>
        </div>
      )
    case 'reveal_next':
      return (
        <div className="ava-act-row">
          <button type="button" className="ava-act gold" onClick={() => onAction('reveal_next', { from: event.revealStep })} disabled={busy}>{nextRevealLabel(nextStep)}</button>
        </div>
      )
  }
}

function ScreenSays({ event, total, plan }: { event: VoteEvent; total: number; plan: RevealStep[] }) {
  let text: string
  if (event.status === 'lobby') text = 'Le QR code et le nombre de participants connectés'
  else if (event.status === 'open') text = event.closesAt ? 'Le compte à rebours de fermeture' : event.resultsMode === 'live' ? 'Le classement en direct' : `« Les votes sont ouverts · ${total} votes »`
  else if (event.status === 'closed') text = event.resultsMode === 'live' ? 'Le classement final (vote clos)' : '« Vote terminé », sans aucun résultat'
  else {
    const step = plan[Math.min(event.revealStep, plan.length - 1)]
    text = step.kind === 'intro' ? `« ${total} participants ont voté »` : step.kind === 'place' ? `La ${step.rank}e place` : step.kind === 'winner' ? 'Le gagnant' : step.kind === 'tie' ? 'L’égalité' : step.kind === 'full' ? 'Le classement complet' : '« Aucun vote »'
  }
  return (
    <div className="ava-say"><span className={`av-dot${event.status === 'lobby' ? ' ok' : ''}`} style={{ width: 8, height: 8 }} />L’écran géant affiche : <b>{text}</b></div>
  )
}

function ResultsBox({ ranking, hidden, hasResults }: { ranking: Ranking; hidden: boolean; hasResults: boolean }) {
  const [peek, setPeek] = useState(false)
  const max = ranking.entries[0]?.votes ?? 0
  const board = (
    <div className="ava-board" aria-hidden={hidden && !peek}>
      {ranking.entries.map((e) => (
        <div key={e.candidate.id} className={`ava-mb${e.rank === 1 && e.votes > 0 ? ' first' : ''}`}>
          <span className="r">{e.rank}</span>
          <span className="pic"><CandidatePhoto candidate={e.candidate} square clean /></span>
          <span style={{ minWidth: 0 }}>
            <span className="nm">{candidateName(e.candidate)}</span>
            <div className="t"><i style={{ width: `${max > 0 ? (e.votes / max) * 100 : 0}%` }} /></div>
          </span>
          <span className="p">{e.percent} %</span>
          <span className="c">{e.votes}</span>
        </div>
      ))}
    </div>
  )
  const stop = () => setPeek(false)
  return (
    <div className={`ava-box${hidden ? ' ava-masked' : ''}${hidden && peek ? ' peek' : ''}`}>
      <h4>Classement {hidden ? <small>caché à l’écran</small> : <small>aussi sur l’écran géant</small>}</h4>
      {hasResults ? board : <p className="ava-sub">Les totaux arrivent…</p>}
      {ranking.blank > 0 && <p className="ava-blank">+ {ranking.blank} vote{ranking.blank > 1 ? 's' : ''} blanc{ranking.blank > 1 ? 's' : ''} (hors pourcentages)</p>}
      {hidden && hasResults && (
        <div className="ava-peek">
          <button
            type="button"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId)
              setPeek(true)
            }}
            onPointerUp={stop}
            onPointerCancel={stop}
            onLostPointerCapture={stop}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setPeek(true) }}
            onKeyUp={stop}
            onBlur={stop}
            onContextMenu={(e) => e.preventDefault()}
          >
            {peek ? 'Relâcher pour masquer' : 'Maintenir pour voir (vous seul)'}
          </button>
          <small>Pensez à l’écran partagé ou à la tablette posée sur la table</small>
        </div>
      )}
    </div>
  )
}

function AfterVote({ event, ranking, busy, canSecond, onAction, onNewVote }: { event: VoteEvent; ranking: Ranking; busy: boolean; canSecond: boolean; onAction: PilotProps['onAction']; onNewVote: () => void }) {
  // Finalistes proposés : les ex æquo en tête, sinon les deux premiers.
  const defaults = useMemo(() => {
    const ids = ranking.tie ? ranking.leaders.map((e) => e.candidate.id) : ranking.entries.slice(0, 2).map((e) => e.candidate.id)
    return { eventId: event.id, ids }
  }, [ranking, event.id])
  const [picked, setPicked] = useState<{ eventId: string; ids: string[] } | null>(null)
  const ids = picked && picked.eventId === event.id ? picked.ids : defaults.ids
  const toggle = (id: string) => setPicked({ eventId: event.id, ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] })
  const tied = new Set(ranking.tie ? ranking.leaders.map((e) => e.candidate.id) : [])

  return (
    <div className="ava-box">
      <h4>Après le vote</h4>
      {canSecond && (
        <>
          <div style={{ display: 'grid', gap: 7, maxHeight: 320, overflowY: 'auto' }}>
            {ranking.entries.map((e) => (
              <button key={e.candidate.id} type="button" role="checkbox" aria-checked={ids.includes(e.candidate.id)} className="ava-chk" onClick={() => toggle(e.candidate.id)}>
                <span className="bx">{ids.includes(e.candidate.id) && <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#1a1306" strokeWidth="4" strokeLinecap="round" /></svg>}</span>
                <span className="pic"><CandidatePhoto candidate={e.candidate} square clean /></span>
                <span>{candidateName(e.candidate)}{tied.has(e.candidate.id) && <span className="ava-tie">ÉGALITÉ</span>}</span>
                <span className="c">{e.votes} vote{e.votes > 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
          <div className="ava-act-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="ava-act gold"
              disabled={busy || ids.length < 2}
              onClick={() => {
                const ordered = ranking.entries.map((e) => e.candidate.id).filter((id) => ids.includes(id))
                onAction('second_round', { candidateIds: ordered })
              }}
            >
              CRÉER LE SECOND TOUR · {ids.length} FINALISTE{ids.length > 1 ? 'S' : ''}
            </button>
            <span className="ava-sub">Ouvert tout de suite, sans rescanner.</span>
          </div>
        </>
      )}
      <div className="ava-after" style={{ marginTop: 12 }}>
        <button type="button" onClick={onNewVote} disabled={busy}>Nouveau vote</button>
      </div>
    </div>
  )
}
