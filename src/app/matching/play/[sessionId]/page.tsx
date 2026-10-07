'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching - écran du joueur (téléphone). Ne reçoit que ses propres données
// (/api/affinity/me) et l'état public de la partie (ligne sessions : phase,
// questions, chrono, pourcentages agrégés). Jamais les réponses des autres.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import PhoneShell, { serif } from '@/components/affinity/PhoneShell'
import AnswerScreen from '@/components/affinity/phone/AnswerScreen'
import { ClosedScreen, NoMatches, RevealResult, TopMatches } from '@/components/affinity/phone/ResultScreens'
import { useAffinityCountdown } from '@/hooks/useAffinityCountdown'
import { clockOffset } from '@/lib/affinity/clock'
import { findStoredPlayerBySession, forgetPlayer, type StoredAffinityPlayer } from '@/lib/affinity/player-storage'
import type { AffinityMatch, AffinityPhase, AffinityQuestion, AffinityRevealData } from '@/lib/affinity/types'
import { createClient } from '@/lib/supabase'

interface MeState {
  nickname: string
  table: string | null
  phase: AffinityPhase
  currentQuestionId: string | null
  myAnswerIndex: number | null
  top5: AffinityMatch[] | null
  nobodyVisible: boolean
  serverNow: string
}

/** Colonnes publiques de la session (lisibles par les invités). */
interface PublicState {
  affinity_active: boolean
  affinity_phase: AffinityPhase | null
  affinity_questions: AffinityQuestion[] | null
  affinity_current_question: number
  affinity_deadline: string | null
  affinity_reveal: AffinityRevealData | null
}

const PUBLIC_COLUMNS = 'affinity_active, affinity_phase, affinity_questions, affinity_current_question, affinity_deadline, affinity_reveal'

type StoredEntry = { code: string; player: StoredAffinityPlayer }
type Answer = { questionId: string; index: number | null; saving: boolean; saved: boolean; error: string | null }

const noopSubscribe = () => () => {}

export default function MatchingPlayPage() {
  const params = useParams()
  const sessionId = String(params.sessionId ?? '')
  const supabase = createClient()

  const [me, setMe] = useState<MeState | null>(null)
  const [over, setOver] = useState(false)
  const [pub, setPub] = useState<PublicState | null>(null)
  const [offset, setOffset] = useState(0)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [closedLocally, setClosedLocally] = useState<string | null>(null)

  // Joueur gardé sur ce téléphone (localStorage). Instantané en texte pour
  // rester stable entre deux rendus ; `null` au rendu serveur, '' si absent.
  const storedRaw = useSyncExternalStore(
    noopSubscribe,
    () => {
      const found = findStoredPlayerBySession(sessionId)
      return found ? JSON.stringify(found) : ''
    },
    () => null,
  )
  const stored = useMemo(() => (storedRaw ? (JSON.parse(storedRaw) as StoredEntry) : null), [storedRaw])

  const refreshMe = useCallback(async (entry: StoredEntry) => {
    const startedAt = Date.now()
    const res = await fetch('/api/affinity/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, playerId: entry.player.playerId, token: entry.player.token }),
    }).catch(() => null)
    if (!res) return // réseau coupé : on garde l'écran actuel
    if (res.status === 403 || res.status === 410) {
      forgetPlayer(entry.code)
      setOver(true)
      return
    }
    if (!res.ok) return
    const data = (await res.json()) as MeState
    setOffset(clockOffset(data.serverNow, startedAt, Date.now()))
    setMe(data)
    // Réponse déjà enregistrée sur le serveur (rechargement, reconnexion).
    if (data.currentQuestionId) {
      setAnswer((prev) =>
        prev?.questionId === data.currentQuestionId && prev.index !== null
          ? prev
          : { questionId: data.currentQuestionId as string, index: data.myAnswerIndex, saving: false, saved: data.myAnswerIndex !== null, error: null },
      )
    }
  }, [sessionId])

  // État public : lecture initiale, puis relecture à chaque événement temps
  // réel (regroupée sur 150 ms : les événements d'une révélation peuvent
  // arriver dans le désordre, la relecture donne toujours l'état final).
  // L'état du joueur n'est relu qu'aux changements de phase ou de question.
  const lastStepRef = useRef('')
  const applyPublic = useCallback((row: PublicState, entry: StoredEntry) => {
    setPub(row)
    const step = `${row.affinity_phase}|${row.affinity_current_question}`
    if (step !== lastStepRef.current) {
      lastStepRef.current = step
      void refreshMe(entry)
    }
  }, [refreshMe])

  useEffect(() => {
    if (!stored) return
    const load = async () => {
      const { data } = await supabase.from('sessions').select(PUBLIC_COLUMNS).eq('id', sessionId).single()
      if (data) applyPublic(data as PublicState, stored)
      else void refreshMe(stored)
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void load(), 150)
    }
    const channel = supabase
      .channel(`affinity-player-${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, schedule)
      .subscribe((state) => {
        // (Re)connexion : on relit tout, un changement a pu être manqué.
        if (state === 'SUBSCRIBED') {
          lastStepRef.current = ''
          schedule()
        }
      })
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [stored, sessionId, supabase, applyPublic, refreshMe])

  const questions = pub?.affinity_questions ?? []
  const question = questions[pub?.affinity_current_question ?? 0]
  const phase = pub?.affinity_active ? pub.affinity_phase : me?.phase ?? null
  const left = useAffinityCountdown(phase === 'question' ? pub?.affinity_deadline : null, offset)
  const myIndex = answer && question && answer.questionId === question.id ? answer.index : null

  async function choose(index: number) {
    if (!stored || !question) return
    const questionId = question.id
    const previous = myIndex
    setAnswer({ questionId, index, saving: true, saved: false, error: null })
    try {
      const res = await fetch('/api/affinity/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, playerId: stored.player.playerId, token: stored.player.token, questionId, answerIndex: index }),
      })
      if (res.ok) {
        setAnswer({ questionId, index, saving: false, saved: true, error: null })
        navigator.vibrate?.(30)
        return
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string; reason?: string }
      if (body.reason === 'closed' || body.reason === 'wrong_question') {
        // Vote fermé entre-temps : on garde la dernière réponse enregistrée.
        setAnswer({ questionId, index: previous, saving: false, saved: previous !== null, error: null })
        setClosedLocally(questionId)
        return
      }
      if (res.status === 403) {
        forgetPlayer(stored.code)
        setOver(true)
        return
      }
      setAnswer({ questionId, index: previous, saving: false, saved: previous !== null, error: body.error ?? 'Réponse non enregistrée, réessaie.' })
    } catch {
      setAnswer({ questionId, index: previous, saving: false, saved: previous !== null, error: 'Pas de réseau : réponse non enregistrée, réessaie.' })
    }
  }

  // ---------- Rendu ----------
  if (storedRaw === '' || over) {
    return (
      <PhoneShell>
        <div className="my-auto text-center">
          <h1 className="text-[26px] font-extrabold leading-tight" style={serif}>
            {over ? 'Cette partie est terminée' : 'Tu n\'es pas encore inscrit'}
          </h1>
          <p className="text-[#9a94b5] mt-3">Rescanne le QR de la soirée pour rejoindre la partie.</p>
        </div>
      </PhoneShell>
    )
  }

  if (!me || !phase) {
    return (
      <PhoneShell>
        <div className="m-auto"><Loader2 className="h-8 w-8 animate-spin text-[#d4af37]" /></div>
      </PhoneShell>
    )
  }

  const counter = question ? `Question ${(pub?.affinity_current_question ?? 0) + 1} / ${questions.length}` : undefined

  if (phase === 'finished') {
    const matches = me.top5 ?? []
    return (
      <PhoneShell aside="Fin de partie">
        {matches.length > 0 ? <TopMatches matches={matches} /> : <NoMatches nobodyVisible={me.nobodyVisible} />}
      </PhoneShell>
    )
  }

  if (phase === 'revealed' && question && pub?.affinity_reveal?.questionId === question.id) {
    return (
      <PhoneShell aside={counter}>
        <RevealResult question={question} reveal={pub.affinity_reveal} myAnswerIndex={myIndex} />
      </PhoneShell>
    )
  }

  const votesClosed = phase === 'closed' || phase === 'revealed' || left === 0 || closedLocally === question?.id
  if ((phase === 'question' || phase === 'closed' || phase === 'revealed') && question) {
    return (
      <PhoneShell aside={counter}>
        {votesClosed ? (
          <ClosedScreen question={question} myAnswerIndex={myIndex} />
        ) : (
          <AnswerScreen
            question={question}
            selected={myIndex}
            saving={answer?.saving ?? false}
            saved={answer?.saved ?? false}
            error={answer?.error ?? null}
            secondsLeft={left}
            onSelect={choose}
          />
        )}
      </PhoneShell>
    )
  }

  // Lobby : en attente du lancement.
  return (
    <PhoneShell>
      <div className="my-auto text-center">
        <div className="relative w-[120px] h-20 mx-auto mb-6" aria-hidden="true">
          <i className="absolute top-0 left-0 w-20 h-20 rounded-full border-[3px] border-[#d4af37] motion-safe:animate-pulse" />
          <i className="absolute top-0 left-10 w-20 h-20 rounded-full border-[3px] border-[#8b5cf6] motion-safe:animate-pulse" />
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#86efac] bg-[#86efac]/[.08] border border-[#86efac]/25 rounded-full px-3.5 py-1.5">
          Inscription validée ✓
        </span>
        <h1 className="text-[28px] font-extrabold leading-tight mt-5" style={serif}>Tu es inscrit, la partie va commencer</h1>
        <p className="mt-5 text-[15px] text-[#cfc9e4]">
          Tu joues sous le pseudo <b className="text-[#f4efe3]">{me.nickname}</b>{me.table ? `, table ${me.table}` : ''}.
        </p>
        <p className="mt-2.5 text-[15px] text-[#9a94b5]">Garde cette page ouverte : les questions arrivent ici.</p>
      </div>
    </PhoneShell>
  )
}
