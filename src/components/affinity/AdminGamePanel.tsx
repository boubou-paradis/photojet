'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching - panneau de l'animateur pendant la partie. Un seul bouton
// principal, qui suit l'étape : lancer → révéler → question suivante →
// terminer. L'animateur garde la main sur le rythme : le chrono ferme le
// vote, il ne révèle jamais tout seul.

import { useEffect, useRef } from 'react'
import { Eye, Flag, Loader2, Play, RotateCcw, SkipForward, StopCircle, Users } from 'lucide-react'
import { useAffinityCountdown } from '@/hooks/useAffinityCountdown'
import type { AffinityPhase, AffinityQuestion } from '@/lib/affinity/types'

export type GameAction = 'start' | 'close' | 'reveal' | 'next' | 'finish'

interface AdminGamePanelProps {
  phase: AffinityPhase | null
  questions: AffinityQuestion[]
  index: number
  deadline: string | null
  clockOffsetMs: number
  playerCount: number
  answeredCount: number
  sessionCode: string
  busy: boolean
  onAction: (action: GameAction) => void
  onNewGame: () => void
  onQuit: () => void
}

export default function AdminGamePanel({
  phase, questions, index, deadline, clockOffsetMs, playerCount, answeredCount, sessionCode, busy, onAction, onNewGame, onQuit,
}: AdminGamePanelProps) {
  const question = questions[index]
  const isLast = index >= questions.length - 1
  const left = useAffinityCountdown(phase === 'question' ? deadline : null, clockOffsetMs)

  // Fin du chrono : fermer le vote (une seule fois par question), sans révéler.
  const closedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (phase !== 'question' || left !== 0 || !question) return
    if (closedForRef.current === question.id) return
    closedForRef.current = question.id
    onAction('close')
  }, [phase, left, question, onAction])

  const status = {
    lobby: 'Lobby affiché sur l\'écran géant',
    question: 'Vote en cours',
    closed: 'Votes fermés',
    revealed: 'Résultats affichés',
    finished: 'Partie terminée : les joueurs voient leur Top 5',
  }[phase ?? 'lobby']

  const primary =
    phase === 'lobby' ? { action: 'start' as const, label: 'Lancer la première question', icon: Play }
    : phase === 'question' || phase === 'closed' ? { action: 'reveal' as const, label: 'Révéler', icon: Eye }
    : phase === 'revealed' && !isLast ? { action: 'next' as const, label: `Question suivante (${index + 2}/${questions.length})`, icon: SkipForward }
    : phase === 'revealed' && isLast ? { action: 'finish' as const, label: 'Terminer la partie', icon: Flag }
    : null

  return (
    <section className="rounded-xl border-2 border-[#D4AF37] bg-[#1A1A1E] p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-white font-bold">{status}</span>
        </div>
        {question && phase !== 'lobby' && phase !== 'finished' && (
          <span className="text-sm text-gray-400">Question {index + 1} / {questions.length}</span>
        )}
      </div>

      {question && phase !== 'lobby' && phase !== 'finished' && (
        <div className="bg-black/30 rounded-xl p-5">
          <p className="text-xl font-bold text-white">{question.text}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {question.answers.map((answer, i) => (
              <li key={i} className="text-sm text-gray-300 bg-white/5 rounded-lg px-3 py-1">{answer}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 bg-black/30 rounded-xl p-4">
          <Users className="h-6 w-6 text-[#D4AF37]" />
          <div>
            <p className="text-3xl font-bold text-white tabular-nums">{playerCount}</p>
            <p className="text-xs text-gray-400">{playerCount > 1 ? 'joueurs inscrits' : 'joueur inscrit'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-black/30 rounded-xl p-4">
          {phase === 'question' || phase === 'closed' ? (
            <div>
              <p className="text-3xl font-bold text-white tabular-nums">{answeredCount}</p>
              <p className="text-xs text-gray-400">
                {answeredCount > 1 ? 'réponses' : 'réponse'}
                {phase === 'question' && left !== null && ` · ${left} s`}
                {phase === 'question' && left === null && ' · chrono infini'}
                {phase === 'closed' && ' · votes fermés'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Les invités scannent le QR de la session (#{sessionCode}).</p>
          )}
        </div>
      </div>

      {primary && (
        <button
          onClick={() => onAction(primary.action)}
          disabled={busy}
          className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <primary.icon className="h-5 w-5" />}
          {primary.label}
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {phase === 'revealed' && !isLast && (
          <button
            onClick={() => {
              if (window.confirm('Terminer maintenant ? Les résultats seront calculés sur les questions déjà révélées.')) onAction('finish')
            }}
            disabled={busy}
            className="flex-1 py-3 rounded-xl text-sm border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Flag className="h-4 w-4" /> Terminer maintenant
          </button>
        )}
        {phase === 'finished' && (
          <button
            onClick={onNewGame}
            disabled={busy}
            className="flex-1 py-3 rounded-xl text-sm border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> Nouvelle partie
          </button>
        )}
        <button
          onClick={onQuit}
          disabled={busy}
          className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/25 text-red-400 rounded-xl text-sm flex items-center justify-center gap-2 border border-red-500/30 disabled:opacity-50"
        >
          <StopCircle className="h-4 w-4" /> Quitter Matching
        </button>
      </div>
    </section>
  )
}
