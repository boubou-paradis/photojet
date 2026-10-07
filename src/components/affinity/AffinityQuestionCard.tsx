'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Une question dans l'éditeur de Matching : texte, 2 à 4 réponses, chrono,
// déplacement et suppression.

import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { AFFINITY_LIMITS, AFFINITY_TIME_LIMITS } from '@/lib/affinity/constants'
import type { AffinityQuestion, AffinityTimeLimit } from '@/lib/affinity/types'

interface AffinityQuestionCardProps {
  question: AffinityQuestion
  index: number
  total: number
  onChange: (question: AffinityQuestion) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}

const timeLabel = (t: AffinityTimeLimit) => (t === null ? '∞' : `${t} s`)

export default function AffinityQuestionCard({ question, index, total, onChange, onRemove, onMove }: AffinityQuestionCardProps) {
  const setAnswer = (i: number, value: string) =>
    onChange({ ...question, answers: question.answers.map((a, j) => (j === i ? value : a)) })

  return (
    <div className="bg-[#1A1A1E] rounded-xl border border-white/5 p-4">
      <div className="flex items-start gap-3">
        <span className="flex-none w-8 h-8 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] font-bold text-sm flex items-center justify-center">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0 space-y-3">
          <label className="sr-only" htmlFor={`aff-q-${question.id}`}>Question {index + 1}</label>
          <input
            id={`aff-q-${question.id}`}
            value={question.text}
            maxLength={AFFINITY_LIMITS.questionMaxLength}
            onChange={(e) => onChange({ ...question, text: e.target.value })}
            placeholder="Ex. Plutôt mer ou montagne ?"
            className="w-full bg-[#0D0D0F] border border-white/10 rounded-lg px-3 py-2.5 text-white font-semibold placeholder:text-gray-600 focus:outline-none focus:border-[#D4AF37]/60"
          />

          <div className="grid sm:grid-cols-2 gap-2">
            {question.answers.map((answer, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <label className="sr-only" htmlFor={`aff-a-${question.id}-${i}`}>Réponse {i + 1}</label>
                <input
                  id={`aff-a-${question.id}-${i}`}
                  value={answer}
                  maxLength={AFFINITY_LIMITS.answerMaxLength}
                  onChange={(e) => setAnswer(i, e.target.value)}
                  placeholder={`Réponse ${i + 1}`}
                  className="flex-1 min-w-0 bg-[#0D0D0F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#D4AF37]/60"
                />
                {question.answers.length > AFFINITY_LIMITS.minAnswers && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...question, answers: question.answers.filter((_, j) => j !== i) })}
                    className="flex-none p-1.5 text-gray-500 hover:text-red-400"
                    title="Retirer cette réponse"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {question.answers.length < AFFINITY_LIMITS.maxAnswers && (
              <button
                type="button"
                onClick={() => onChange({ ...question, answers: [...question.answers, ''] })}
                className="flex items-center gap-1 text-xs text-[#D4AF37] hover:text-[#F4D03F] px-2 py-1"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter une réponse
              </button>
            )}
            <div className="flex items-center gap-1 ml-auto" role="group" aria-label="Chrono">
              <span className="text-xs text-gray-500 mr-1">Chrono</span>
              {AFFINITY_TIME_LIMITS.map((t) => (
                <button
                  key={String(t)}
                  type="button"
                  onClick={() => onChange({ ...question, timeLimit: t })}
                  aria-pressed={question.timeLimit === t}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    question.timeLimit === t
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold'
                      : 'border-white/10 text-gray-400 hover:border-[#D4AF37]/40'
                  }`}
                >
                  {timeLabel(t)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-none flex flex-col gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="p-1.5 text-gray-500 hover:text-white disabled:opacity-20" title="Monter">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="p-1.5 text-gray-500 hover:text-white disabled:opacity-20" title="Descendre">
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={onRemove} className="p-1.5 text-gray-500 hover:text-red-400" title="Supprimer la question">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
