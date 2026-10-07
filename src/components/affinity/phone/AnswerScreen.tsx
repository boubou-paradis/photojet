// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Téléphone : répondre à la question en cours. Gros boutons, réponse
// modifiable tant que le vote est ouvert.

import { serif } from '../PhoneShell'
import type { AffinityQuestion } from '@/lib/affinity/types'

interface AnswerScreenProps {
  question: AffinityQuestion
  selected: number | null
  saving: boolean
  saved: boolean
  error: string | null
  secondsLeft: number | null
  onSelect: (index: number) => void
}

export default function AnswerScreen({ question, selected, saving, saved, error, secondsLeft, onSelect }: AnswerScreenProps) {
  const progress = secondsLeft === null || question.timeLimit === null ? null : secondsLeft / question.timeLimit

  return (
    <div className="flex-1 flex flex-col">
      {progress !== null && (
        <div className="h-1.5 rounded-full bg-white/[.08] mt-4 overflow-hidden" aria-label={`${secondsLeft} secondes`}>
          <div className="h-full bg-[#d4af37] origin-left transition-transform duration-300 ease-linear" style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
      <h1 className="text-[24px] font-extrabold leading-tight mt-5 text-balance" style={serif}>{question.text}</h1>

      <div className="flex flex-col gap-2.5 mt-5" role="radiogroup" aria-label={question.text}>
        {question.answers.map((answer, i) => {
          const isSelected = selected === i
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(i)}
              className={`flex items-center gap-3 text-left text-[18px] font-bold leading-snug px-4 py-[17px] rounded-2xl border-2 transition-colors ${
                isSelected
                  ? 'border-[#d4af37] bg-[#d4af37]/[.12] shadow-[0_0_0_4px_rgba(212,175,55,.12)]'
                  : 'border-white/10 bg-white/[.05] active:bg-white/[.09]'
              }`}
            >
              <span className="min-w-0 flex-1">{answer}</span>
              {isSelected && <span className="flex-none text-[#f4d03f] text-xl" aria-hidden="true">✓</span>}
            </button>
          )
        })}
      </div>

      <div className="mt-auto pt-6 text-center min-h-[52px]" aria-live="polite">
        {error ? (
          <p className="text-sm text-orange-300">{error}</p>
        ) : saved && selected !== null ? (
          <>
            <p className="text-[15px] font-semibold text-[#86efac]">Réponse enregistrée ✓</p>
            <p className="text-[13px] text-[#9a94b5] mt-0.5">Tu peux encore changer d&apos;avis</p>
          </>
        ) : saving ? (
          <p className="text-[13px] text-[#9a94b5]">Enregistrement…</p>
        ) : null}
      </div>
    </div>
  )
}
