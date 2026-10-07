'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Écran géant après la révélation : barres animées (transform scaleX), la
// majorité en or, puis une phrase à commenter. Données agrégées uniquement.

import { useEffect, useState } from 'react'
import AffinityMark from '../AffinityMark'
import { revealPhrase } from '@/lib/affinity/phrases'
import type { AffinityQuestion, AffinityRevealData } from '@/lib/affinity/types'

interface RevealScreenProps {
  question: AffinityQuestion
  index: number
  total: number
  reveal: AffinityRevealData
}

export default function RevealScreen({ question, index, total, reveal }: RevealScreenProps) {
  // Les barres partent de 0 puis s'allongent : un rendu à 0, puis l'animation.
  const [played, setPlayed] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPlayed(true))
    return () => cancelAnimationFrame(frame)
  }, [reveal.questionId])

  // De la réponse la plus choisie à la moins choisie (à égalité : ordre de la question).
  const order = question.answers
    .map((answer, i) => ({ answer, i, count: reveal.counts[i] ?? 0, percent: reveal.percents[i] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.i - b.i)

  return (
    <div className={`aff-stage ${played ? 'aff-played' : ''}`}>
      <div className="aff-brand"><AffinityMark size={22} /><span>Matching</span></div>
      <div className="aff-qnum">
        Question <b>{index + 1}</b> / {total} · {reveal.total} {reveal.total > 1 ? 'réponses' : 'réponse'}
      </div>

      <div className="aff-qwrap">
        <h2 className="aff-question aff-question-sm">{question.text}</h2>
        <div className="aff-bars">
          {order.map(({ answer, i, percent }, rank) => (
            <div key={i} className={`aff-bar ${i === reveal.majorityIndex ? 'aff-bar-win' : ''}`}>
              <div className="aff-bar-lbl">
                <span>{answer}</span>
                <span className="aff-pct">{percent} %</span>
              </div>
              <div className="aff-bar-track">
                <div className="aff-bar-fill" style={{ '--p': percent / 100, transitionDelay: `${rank * 0.12}s` } as React.CSSProperties} />
              </div>
            </div>
          ))}
        </div>
        <p className="aff-punch">{revealPhrase(question, reveal)}</p>
      </div>
    </div>
  )
}
