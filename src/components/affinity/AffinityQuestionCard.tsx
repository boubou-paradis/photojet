'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Édition d'une question de Matching : texte, 2 à 4 réponses, chrono.
// Le déplacement et la suppression se font dans la liste (comme le Quiz).

import { Plus, X } from 'lucide-react'
import { AFFINITY_LIMITS, AFFINITY_TIME_LIMITS } from '@/lib/affinity/constants'
import type { AffinityQuestion, AffinityTimeLimit } from '@/lib/affinity/types'

interface AffinityQuestionCardProps {
  question: AffinityQuestion
  index: number
  onChange: (question: AffinityQuestion) => void
}

const timeLabel = (t: AffinityTimeLimit) => (t === null ? '∞' : `${t} s`)

export default function AffinityQuestionCard({ question, index, onChange }: AffinityQuestionCardProps) {
  const setAnswer = (i: number, value: string) =>
    onChange({ ...question, answers: question.answers.map((a, j) => (j === i ? value : a)) })

  return (
    <div className="card-gold rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/30 text-violet-400 font-bold">
          {index + 1}
        </div>
        <h3 className="text-white font-bold text-lg">Modifier la question</h3>
      </div>
      <div>
        <div className="space-y-3">
          <label className="sr-only" htmlFor={`aff-q-${question.id}`}>Question {index + 1}</label>
          <input
            id={`aff-q-${question.id}`}
            value={question.text}
            maxLength={AFFINITY_LIMITS.questionMaxLength}
            onChange={(e) => onChange({ ...question, text: e.target.value })}
            placeholder="Ex. Plutôt mer ou montagne ?"
            autoFocus={!question.text}
            className="w-full bg-[#2E2E33] text-white rounded-xl px-4 py-3 border border-[rgba(255,255,255,0.1)] font-semibold placeholder:text-gray-500 focus:border-[#D4AF37] focus:outline-none"
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
                  className="flex-1 min-w-0 bg-[#2E2E33] text-white rounded-xl px-4 py-2.5 border border-[rgba(255,255,255,0.1)] placeholder:text-gray-500 focus:border-[#D4AF37] focus:outline-none"
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

      </div>
    </div>
  )
}
