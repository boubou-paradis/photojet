'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching - page animateur : éditeur de questions, pack de démarrage,
// lancement du lobby. Toutes les décisions passent par /api/affinity/admin
// (serveur) ; cette page n'écrit elle-même que la configuration des questions.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Monitor, Package, Plus, Rocket, Timer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import AdminGamePanel, { type GameAction } from '@/components/affinity/AdminGamePanel'
import AffinityMark from '@/components/affinity/AffinityMark'
import AffinityQuestionCard from '@/components/affinity/AffinityQuestionCard'
import RemoteControlBadge from '@/components/games/RemoteControlBadge'
import { AFFINITY_PACKS } from '@/data/affinity-packs'
import { useAffinityStatus } from '@/hooks/useAffinityStatus'
import { useLeaveGuard } from '@/hooks/useLeaveGuard'
import { useRemoteControl, useRemoteSwitch } from '@/hooks/useRemoteControl'
import { AFFINITY_DEFAULT_TIME_LIMIT, AFFINITY_HEARTBEAT_INTERVAL_MS, AFFINITY_LIMITS } from '@/lib/affinity/constants'
import type { AffinityPhase, AffinityQuestion } from '@/lib/affinity/types'
import { validateQuestions } from '@/lib/affinity/validation'
import { createClient } from '@/lib/supabase'
import { fetchUserSession } from '@/lib/session-select'
import type { Session } from '@/types/database'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type AdminAction = 'launch' | 'exit' | 'heartbeat' | GameAction

const OTHER_GAME_FLAGS = ['quiz_active', 'quiz_lobby_visible', 'lineup_active', 'wheel_active', 'mystery_photo_active'] as const
type OtherFlags = Record<(typeof OTHER_GAME_FLAGS)[number], boolean>

const readFlags = (row: Partial<Session>): OtherFlags =>
  Object.fromEntries(OTHER_GAME_FLAGS.map((flag) => [flag, row[flag] === true])) as OtherFlags

const newQuestionId = () =>
  `q-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`

/** « 10 questions ≈ 8 minutes » */
const estimateMinutes = (count: number) => Math.max(1, Math.round(count * 0.8))

async function callAdmin(sessionId: string, action: AdminAction): Promise<{ ok: boolean; error?: string; status: number }> {
  try {
    const res = await fetch('/api/affinity/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action }),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: res.ok, error: body.error, status: res.status }
  } catch {
    return { ok: false, error: 'Connexion impossible, réessayez.', status: 0 }
  }
}

export default function MatchingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<AffinityQuestion[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = questions.find((q) => q.id === selectedId) ?? null
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState<AffinityPhase | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [deadline, setDeadline] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const dirtyRef = useRef(false)
  const activeRef = useRef(false)
  // État des autres jeux au lancement : Matching ne se coupe que sur un
  // passage de faux à vrai APRÈS son lancement (pas sur un drapeau bloqué).
  const baselineRef = useRef<OtherFlags | null>(null)

  const status = useAffinityStatus(session?.code, active)
  useLeaveGuard(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  // ---------- Chargement ----------
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
        setQuestions(Array.isArray(data.affinity_questions) ? data.affinity_questions : [])
        setActive(data.affinity_active === true)
        setPhase(data.affinity_phase ?? null)
        setCurrentIndex(data.affinity_current_question ?? 0)
        setDeadline(data.affinity_deadline ?? null)
        if (data.affinity_active) baselineRef.current = readFlags(data)
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

  // ---------- Enregistrement automatique des questions ----------
  const saveQuestions = useCallback(async (list: AffinityQuestion[]) => {
    if (!session) return
    setSaveState('saving')
    const { error } = await supabase.from('sessions').update({ affinity_questions: list }).eq('id', session.id)
    setSaveState(error ? 'error' : 'saved')
    if (!error) dirtyRef.current = false
  }, [session, supabase])

  useEffect(() => {
    if (!dirtyRef.current) return
    const timer = setTimeout(() => void saveQuestions(questions), 800)
    return () => clearTimeout(timer)
  }, [questions, saveQuestions])

  const editQuestions = (update: (list: AffinityQuestion[]) => AffinityQuestion[]) => {
    dirtyRef.current = true
    setQuestions(update)
  }

  // ---------- Sortie de Matching ----------
  const exitMatching = useCallback(async (reason: 'quit' | 'other-game') => {
    if (!session) return
    const result = await callAdmin(session.id, 'exit')
    if (!result.ok && result.status !== 0) {
      toast.error(result.error ?? 'Impossible d\'arrêter Matching')
      return
    }
    activeRef.current = false
    baselineRef.current = null
    setActive(false)
    setPhase(null)
    if (reason === 'other-game') toast.info('Un autre jeu a été lancé : Matching s\'est arrêté.')
    else toast.success('Matching arrêté. Vos questions sont conservées.')
  }, [session])

  // Applique la règle « un autre jeu passe de faux à vrai après le lancement ».
  const applyOtherGameRule = useCallback((row: Partial<Session>) => {
    if (!activeRef.current || !baselineRef.current) return
    const now = readFlags(row)
    const started = OTHER_GAME_FLAGS.some((flag) => now[flag] && !baselineRef.current![flag])
    if (started) void exitMatching('other-game')
  }, [exitMatching])

  // ---------- Temps réel : la ligne de session ----------
  // La base fait foi : à chaque événement, on relit la ligne (regroupé sur
  // 150 ms). Les événements d'une révélation (fermé puis révélé) peuvent
  // arriver dans le désordre ; la relecture donne toujours l'état final.
  const syncFromDb = useCallback(async () => {
    if (!session?.id) return
    const { data } = await supabase.from('sessions').select('*').eq('id', session.id).single()
    if (!data) return
    const row = data as Session
    applyOtherGameRule(row)
    if (activeRef.current && row.affinity_active === false) {
      // Arrêtée ailleurs (cron, autre onglet) : on suit la base.
      activeRef.current = false
      setActive(false)
    }
    setPhase(row.affinity_phase ?? null)
    setCurrentIndex(row.affinity_current_question ?? 0)
    setDeadline(row.affinity_deadline ?? null)
    // Partie en cours : questions telles que validées par le serveur.
    if (row.affinity_active && Array.isArray(row.affinity_questions)) setQuestions(row.affinity_questions)
  }, [session?.id, supabase, applyOtherGameRule])

  useEffect(() => {
    if (!session?.id) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void syncFromDb(), 150)
    }
    const channel = supabase
      .channel(`affinity-admin-${session.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` }, schedule)
      .subscribe((state) => {
        // (Re)connexion : un événement a pu être manqué pendant la coupure.
        if (state === 'SUBSCRIBED') schedule()
      })
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [session?.id, supabase, syncFromDb])

  // ---------- Signal de vie (table hors realtime) ----------
  useEffect(() => {
    if (!active || !session?.id) return
    const sessionId = session.id
    const beat = async () => {
      const result = await callAdmin(sessionId, 'heartbeat')
      if (result.status === 409) {
        // Plus de partie côté serveur (purge, autre onglet) : on s'aligne.
        activeRef.current = false
        setActive(false)
        setPhase(null)
      }
    }
    void beat()
    const timer = setInterval(beat, AFFINITY_HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [active, session?.id])

  // ---------- Fermeture de l'onglet : Matching s'arrête (option A) ----------
  // pagehide (pas beforeunload) : ne part qu'après un éventuel « Annuler »
  // sur la confirmation de useLeaveGuard.
  useEffect(() => {
    if (!session?.id) return
    const sessionId = session.id
    const onPageHide = () => {
      if (!activeRef.current) return
      const payload = new Blob([JSON.stringify({ sessionId, action: 'exit' })], { type: 'application/json' })
      if (!navigator.sendBeacon?.('/api/affinity/admin', payload)) {
        void fetch('/api/affinity/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, action: 'exit' }), keepalive: true })
      }
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [session?.id])

  // ---------- Actions ----------
  const validation = validateQuestions(questions)

  async function launch() {
    if (!session) return
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }
    setBusy(true)
    try {
      if (dirtyRef.current) await saveQuestions(questions)
      const result = await callAdmin(session.id, 'launch')
      if (!result.ok) {
        toast.error(result.error ?? 'Lancement impossible')
        return
      }
      baselineRef.current = readFlags({})
      activeRef.current = true
      setActive(true)
      setPhase('lobby')
      window.open(`/live/${session.code}`, 'photojet-live')
      toast.success('Lobby affiché sur l\'écran géant')
    } finally {
      setBusy(false)
    }
  }

  const gameAction = useCallback(async (action: GameAction) => {
    if (!session) return
    // Fermeture automatique (fin du chrono) : sans bloquer les boutons.
    if (action !== 'close') setBusy(true)
    try {
      const result = await callAdmin(session.id, action)
      if (!result.ok && action !== 'close') toast.error(result.error ?? 'Action impossible')
      // État final relu en base, sans attendre le temps réel.
      await syncFromDb()
    } finally {
      if (action !== 'close') setBusy(false)
    }
  }, [session, syncFromDb])

  // Télécommande de présentation : PageDown = prochaine action logique
  // (lancer → révéler → question suivante). Elle ne termine JAMAIS la partie
  // (bouton explicite) ; après la dernière révélation, elle rappelle de
  // cliquer sur « Terminer ». PageUp et B ne font rien dans Matching.
  const [remoteOn, setRemoteOn] = useRemoteSwitch()
  useRemoteControl({
    active: active && remoteOn && phase !== 'finished',
    phase: `${phase}|${currentIndex}`,
    onNext: async () => {
      if (phase === 'lobby') { await gameAction('start'); return 1500 }
      if (phase === 'question' || phase === 'closed') { await gameAction('reveal'); return 1500 }
      if (phase === 'revealed') {
        if (currentIndex < questions.length - 1) { await gameAction('next'); return 1500 }
        toast.info('Dernière question révélée : cliquez sur « Terminer la partie ».')
      }
    },
  })

  async function newGame() {
    if (!session) return
    if (!window.confirm('Lancer une nouvelle partie ? Les inscriptions et les résultats de celle-ci seront effacés.')) return
    setBusy(true)
    try {
      const result = await callAdmin(session.id, 'launch')
      if (!result.ok) toast.error(result.error ?? 'Lancement impossible')
      else baselineRef.current = readFlags({})
    } finally {
      setBusy(false)
    }
  }

  async function quit() {
    if (!window.confirm('Arrêter Matching ? Les inscriptions et les réponses de cette partie seront effacées.')) return
    setBusy(true)
    await exitMatching('quit')
    setBusy(false)
  }

  async function goBack() {
    if (!session) return
    if (activeRef.current) {
      if (!window.confirm('Matching est en cours. Revenir aux jeux arrêtera la partie. Continuer ?')) return
      await exitMatching('quit')
    }
    router.push(`/admin/jeux?session=${session.id}`)
  }

  function loadPack(packId: string) {
    const pack = AFFINITY_PACKS.find((p) => p.id === packId)
    if (!pack) return
    if (questions.length > 0 && !window.confirm(`Charger le ${pack.name} remplacera vos ${questions.length} question(s). Continuer ?`)) return
    editQuestions(() => pack.questions.map((q) => ({ ...q, answers: [...q.answers] })))
    setSelectedId(null)
    toast.success(`${pack.questions.length} questions chargées`)
  }

  function clearAll() {
    if (questions.length === 0) return
    if (!window.confirm(`Supprimer les ${questions.length} question(s) ? Cette action est irréversible.`)) return
    editQuestions(() => [])
    setSelectedId(null)
    toast.success('Questions supprimées')
  }

  function addQuestion() {
    const id = newQuestionId()
    editQuestions((list) => [...list, { id, text: '', answers: ['', ''], timeLimit: AFFINITY_DEFAULT_TIME_LIMIT }])
    setSelectedId(id)
  }

  function removeQuestion(id: string) {
    editQuestions((list) => list.filter((q) => q.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    editQuestions((list) => {
      const target = index + direction
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
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

  const saveLabel = { idle: '', saving: 'Enregistrement…', saved: 'Enregistré', error: 'Échec de l\'enregistrement' }[saveState]

  return (
    <div className="min-h-screen bg-[#0D0D0F]">
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
            <div className="flex items-center gap-3">
              <AffinityMark size={22} />
              <div>
                <h1 className="text-lg font-bold text-white">Matching</h1>
                <p className="text-xs text-gray-500">Le jeu des points communs · {session.name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
          <RemoteControlBadge enabled={remoteOn} onToggle={setRemoteOn} gameActive={active} finished={phase === 'finished'} />
          {active && (
            <Button size="sm" onClick={() => window.open(`/live/${session.code}`, 'photojet-live')} className="bg-[#D4AF37] text-[#1A1A1E] hover:bg-[#F4D03F]">
              <Monitor className="h-4 w-4 mr-2" />
              Écran géant
            </Button>
          )}
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 sm:px-8 py-6">
        {active ? (
          <div className="max-w-4xl mx-auto">
          <AdminGamePanel
            phase={phase}
            questions={questions}
            index={currentIndex}
            deadline={deadline}
            clockOffsetMs={status.clockOffsetMs}
            playerCount={status.playerCount}
            answeredCount={status.answeredCount}
            sessionCode={session.code}
            busy={busy}
            onAction={gameAction}
            onNewGame={newGame}
            onQuit={quit}
          />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Liste des questions (même disposition que le Quiz) */}
            <section className="card-gold rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 flex items-center justify-center border border-[#D4AF37]/30 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                    <AffinityMark size={18} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Matching</h2>
                    <p className="text-[#6B6B70] text-sm">
                      {questions.length} question{questions.length > 1 ? 's' : ''}
                      {questions.length > 0 && ` · environ ${estimateMinutes(questions.length)} min de jeu`}
                      {saveLabel && <span aria-live="polite"> · {saveLabel}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => loadPack('soiree')}
                    className="px-4 py-2.5 bg-[#2E2E33] text-[#D4AF37] rounded-xl hover:bg-[#3E3E43] flex items-center gap-2 text-sm border border-[#D4AF37]/30"
                  >
                    <Package className="h-4 w-4" />
                    Charger le pack de démarrage
                  </button>
                  <button
                    onClick={addQuestion}
                    disabled={questions.length >= AFFINITY_LIMITS.maxQuestions}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black rounded-xl font-bold flex items-center gap-2 text-sm disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </button>
                  <button
                    onClick={clearAll}
                    disabled={questions.length === 0}
                    className="px-4 py-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 flex items-center gap-2 text-sm border border-red-500/30 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                    Tout vider
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                {AFFINITY_LIMITS.minQuestions} à {AFFINITY_LIMITS.maxQuestions} questions (10 questions ≈ 8 minutes). Gardez des questions légères :
                évitez celles qui jugent des personnes de la salle et les sujets sensibles (religion, politique, orientation sexuelle, santé, handicap, origine, sexualité).
              </p>

              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2">
                {questions.length === 0 ? (
                  <div className="text-center py-12 text-[#6B6B70]">
                    <p className="text-white font-semibold">Aucune question pour l&apos;instant</p>
                    <p className="text-sm mt-1">Chargez le pack de démarrage (20 questions prêtes) ou cliquez sur « Ajouter ».</p>
                  </div>
                ) : (
                  questions.map((q, index) => {
                    const isSelected = q.id === selected?.id
                    return (
                      <div
                        key={q.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedId(q.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(q.id) } }}
                        className={`flex items-center gap-3 rounded-xl p-3.5 cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'bg-gradient-to-r from-[#D4AF37]/20 to-[#D4AF37]/10 border border-[#D4AF37]/50 shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                            : 'bg-[#1A1A1E]/80 hover:bg-[#2E2E33] border border-transparent hover:border-[#D4AF37]/20'
                        }`}
                      >
                        <div className={`flex-none w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${isSelected ? 'bg-[#D4AF37] text-black' : 'bg-[#2E2E33] text-[#6B6B70]'}`}>
                          {index + 1}
                        </div>
                        <span className={`flex-1 min-w-0 truncate font-medium ${q.text ? 'text-white' : 'text-gray-500 italic'}`}>
                          {q.text || 'Question sans texte'}
                        </span>
                        <span className="hidden sm:flex items-center px-2.5 py-1 bg-violet-500/10 rounded-lg border border-violet-500/20 text-violet-400 text-xs font-semibold">
                          {q.answers.length} réponses
                        </span>
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-[#D4AF37]/10 rounded-lg border border-[#D4AF37]/20 text-[#D4AF37] text-xs font-semibold">
                          <Timer className="h-3 w-3" />
                          {q.timeLimit === null ? '∞' : `${q.timeLimit}s`}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveQuestion(index, -1) }}
                          disabled={index === 0}
                          className="p-1.5 text-[#6B6B70] hover:text-white disabled:opacity-20"
                          title="Monter"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveQuestion(index, 1) }}
                          disabled={index === questions.length - 1}
                          className="p-1.5 text-[#6B6B70] hover:text-white disabled:opacity-20"
                          title="Descendre"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeQuestion(q.id) }}
                          className="p-2 text-[#6B6B70] hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                          title="Supprimer la question"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {/* Édition de la question sélectionnée */}
            {selected && (
              <AffinityQuestionCard
                key={selected.id}
                question={selected}
                index={questions.findIndex((q) => q.id === selected.id)}
                onChange={(updated) => editQuestions((list) => list.map((q) => (q.id === updated.id ? updated : q)))}
              />
            )}

            <div>
              {!validation.ok && questions.length > 0 && <p className="text-sm text-orange-300 mb-2">{validation.error}</p>}
              <button
                onClick={launch}
                disabled={busy || !validation.ok}
                className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                Afficher le lobby
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
