// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Écran géant pendant une question : texte, réponses, compteur de réponses
// et chrono. Aucun pourcentage : la salle découvre les tendances à la
// révélation, déclenchée par l'animateur.

import AffinityMark from '../AffinityMark'
import { useAffinityCountdown } from '@/hooks/useAffinityCountdown'
import type { AffinityQuestion } from '@/lib/affinity/types'

interface QuestionScreenProps {
  question: AffinityQuestion
  index: number
  total: number
  closed: boolean
  deadline: string | null
  clockOffsetMs: number
  answeredCount: number
}

const RING = 2 * Math.PI * 45

export default function QuestionScreen({ question, index, total, closed, deadline, clockOffsetMs, answeredCount }: QuestionScreenProps) {
  const left = useAffinityCountdown(closed ? null : deadline, clockOffsetMs)
  const votesClosed = closed || left === 0
  const progress = left === null || question.timeLimit === null ? 1 : left / question.timeLimit

  return (
    <div className="aff-stage">
      <div className="aff-brand"><AffinityMark size={22} /><span>Matching</span></div>
      <div className="aff-qnum">Question <b>{index + 1}</b> / {total}</div>

      <div className="aff-live">
        <div className="aff-answered">
          <b>{answeredCount}</b>
          <span>{answeredCount > 1 ? 'réponses' : 'réponse'}</span>
        </div>
        {votesClosed ? (
          <div className="aff-closed">Votes fermés</div>
        ) : left !== null ? (
          <div className="aff-chrono" aria-label={`${left} secondes`}>
            <svg viewBox="0 0 100 100">
              <circle className="aff-chrono-track" cx="50" cy="50" r="45" />
              <circle className="aff-chrono-prog" cx="50" cy="50" r="45" strokeDasharray={RING} strokeDashoffset={RING * (1 - progress)} />
            </svg>
            <b>{left}</b>
          </div>
        ) : null}
      </div>

      <div className="aff-qwrap">
        <h2 className="aff-question">{question.text}</h2>
        <p className="aff-note">Les résultats s&apos;affichent quand l&apos;animateur les révèle.</p>
        <div className={`aff-answers ${question.answers.length > 2 ? 'aff-answers-4' : ''}`}>
          {question.answers.map((answer, i) => (
            <div key={i} className="aff-ans">
              <i className={`aff-k aff-k-${i}`} />
              <span>{answer}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
