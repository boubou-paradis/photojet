'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching - page animateur : éditeur de questions, pack de démarrage,
// lancement du lobby. Toutes les décisions passent par /api/affinity/admin
// (serveur) ; cette page n'écrit elle-même que la configuration des questions.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Monitor, Package, Plus, Rocket, StopCircle, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import AffinityMark from '@/components/affinity/AffinityMark'
import AffinityQuestionCard from '@/components/affinity/AffinityQuestionCard'
import { AFFINITY_PACKS } from '@/data/affinity-packs'
import { useAffinityStatus } from '@/hooks/useAffinityStatus'
import { useLeaveGuard } from '@/hooks/useLeaveGuard'
import { AFFINITY_DEFAULT_TIME_LIMIT, AFFINITY_HEARTBEAT_INTERVAL_MS, AFFINITY_LIMITS } from '@/lib/affinity/constants'
import type { AffinityPhase, AffinityQuestion } from '@/lib/affinity/types'
import { validateQuestions } from '@/lib/affinity/validation'
import { createClient } from '@/lib/supabase'
import { fetchUserSession } from '@/lib/session-select'
import type { Session } from '@/types/database'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type AdminAction = 'launch' | 'exit' | 'heartbeat'

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
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState<AffinityPhase | null>(null)
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
  useEffect(() => {
    if (!session?.id) return
    const channel = supabase
      .channel(`affinity-admin-${session.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` },
        (payload) => {
          const row = payload.new as Session
          applyOtherGameRule(row)
          if (activeRef.current && row.affinity_active === false) {
            // Arrêtée ailleurs (cron, autre onglet) : on suit la base.
            activeRef.current = false
            setActive(false)
          }
          setPhase(row.affinity_phase ?? null)
        },
      )
      .subscribe(async (state) => {
        // (Re)connexion : un événement a pu être manqué pendant la coupure.
        if (state !== 'SUBSCRIBED') return
        const { data } = await supabase.from('sessions').select('*').eq('id', session.id).single()
        if (data) applyOtherGameRule(data as Session)
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session?.id, supabase, applyOtherGameRule])

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
    toast.success(`${pack.questions.length} questions chargées`)
  }

  function clearAll() {
    if (questions.length === 0) return
    if (!window.confirm(`Supprimer les ${questions.length} question(s) ? Cette action est irréversible.`)) return
    editQuestions(() => [])
    toast.success('Questions supprimées')
  }

  function addQuestion() {
    editQuestions((list) => [...list, { id: newQuestionId(), text: '', answers: ['', ''], timeLimit: AFFINITY_DEFAULT_TIME_LIMIT }])
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
          {active && (
            <Button size="sm" onClick={() => window.open(`/live/${session.code}`, 'photojet-live')} className="bg-[#D4AF37] text-[#1A1A1E] hover:bg-[#F4D03F]">
              <Monitor className="h-4 w-4 mr-2" />
              Écran géant
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-6 max-w-4xl">
        {active ? (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border-2 border-[#D4AF37] bg-[#1A1A1E] p-6 space-y-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-white font-bold">{phase === 'lobby' ? 'Lobby affiché sur l\'écran géant' : 'Partie en cours'}</span>
            </div>
            <div className="flex items-center gap-4 bg-black/30 rounded-xl p-5">
              <Users className="h-8 w-8 text-[#D4AF37]" />
              <div>
                <p className="text-4xl font-bold text-white tabular-nums">{status.playerCount}</p>
                <p className="text-sm text-gray-400">{status.playerCount > 1 ? 'joueurs inscrits' : 'joueur inscrit'}</p>
              </div>
            </div>
            <p className="text-sm text-gray-400">
              Les invités scannent le QR de la session (#{session.code}) : il mène à Matching tant que la partie est en cours.
            </p>
            <button
              onClick={quit}
              disabled={busy}
              className="w-full py-3 bg-red-500/10 hover:bg-red-500/25 text-red-400 rounded-xl text-sm flex items-center justify-center gap-2 border border-red-500/30 disabled:opacity-50"
            >
              <StopCircle className="h-4 w-4" />
              Quitter Matching
            </button>
          </motion.section>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => loadPack('soiree')}
                className="px-4 py-2.5 bg-[#2E2E33] text-[#D4AF37] rounded-xl hover:bg-[#3E3E43] flex items-center gap-2 text-sm border border-[#D4AF37]/30"
              >
                <Package className="h-4 w-4" />
                Charger le pack de démarrage
              </button>
              <button
                onClick={clearAll}
                disabled={questions.length === 0}
                className="px-4 py-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 flex items-center gap-2 text-sm border border-red-500/30 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                Tout vider
              </button>
              <span className="ml-auto text-xs text-gray-500" aria-live="polite">{saveLabel}</span>
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-white font-semibold">
                {questions.length} question{questions.length > 1 ? 's' : ''}
                {questions.length > 0 && <span className="text-gray-500 font-normal"> · environ {estimateMinutes(questions.length)} min de jeu</span>}
              </h2>
              <span className="text-xs text-gray-500">
                {AFFINITY_LIMITS.minQuestions} à {AFFINITY_LIMITS.maxQuestions} questions · 10 questions ≈ 8 minutes
              </span>
            </div>

            <p className="text-xs text-gray-500 bg-[#1A1A1E] rounded-lg px-3 py-2 border border-white/5">
              Gardez des questions légères. Évitez celles qui jugent des personnes de la salle et les sujets sensibles :
              religion, politique, orientation sexuelle, santé, handicap, origine, sexualité.
            </p>

            {questions.length === 0 ? (
              <div className="text-center py-12 bg-[#1A1A1E] rounded-xl border border-dashed border-white/10">
                <p className="text-white font-semibold">Aucune question pour l&apos;instant</p>
                <p className="text-sm text-gray-500 mt-1">Chargez le pack de démarrage (20 questions prêtes) ou ajoutez les vôtres.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question, index) => (
                  <AffinityQuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    total={questions.length}
                    onChange={(updated) => editQuestions((list) => list.map((q) => (q.id === updated.id ? updated : q)))}
                    onRemove={() => editQuestions((list) => list.filter((q) => q.id !== question.id))}
                    onMove={(direction) => moveQuestion(index, direction)}
                  />
                ))}
              </div>
            )}

            <button
              onClick={addQuestion}
              disabled={questions.length >= AFFINITY_LIMITS.maxQuestions}
              className="w-full py-3 rounded-xl border border-dashed border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/5 flex items-center justify-center gap-2 text-sm disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Ajouter une question
            </button>

            <div className="pt-2">
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
          </section>
        )}
      </main>
    </div>
  )
}
