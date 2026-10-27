'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — points et classement (page animateur). Les points d'une bonne
// réponse sont donnés automatiquement au gagnant (et ceux d'un bon vote aux
// bons votants) ; ici : barème, corrections à la main, affichage sur
// l'écran géant et remise à zéro. Toutes les actions passent par
// /api/buzzer/scores (fonction SQL sous verrou).

import { useState } from 'react'
import { Eye, EyeOff, Minus, Plus, RotateCcw, Trophy } from 'lucide-react'
import { formatPoints, MAX_POINTS, type ScoreAction, type ScoresActiveState } from '@/lib/buzzer/scores'

interface ScoresPanelProps {
  scores: ScoresActiveState | null
  team: boolean
  /** Le vote de la salle rapporte des points (manches préparées, mode individuel). */
  showVotePoints: boolean
  onAction: (action: ScoreAction, args?: Record<string, unknown>) => void
}

const chip = 'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border disabled:opacity-40'

/** Champ 0 à 100 validé à la sortie du champ (ou Entrée) : une seule requête. */
function PointsInput({ id, value, onCommit }: { id: string; value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const n = Math.round(Number(draft))
    setDraft(null)
    if (draft.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= MAX_POINTS && n !== value) onCommit(n)
  }
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_POINTS}
      step={1}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setDraft(null)
      }}
      className="w-20 rounded-lg bg-[#1A1A1E] border border-white/10 focus:border-[#D4AF37] outline-none px-2 py-1.5 text-white text-sm tabular-nums"
    />
  )
}

export default function ScoresPanel({ scores, team, showVotePoints, onAction }: ScoresPanelProps) {
  const list = scores?.scores ?? []
  const shown = scores?.shown ?? false
  const hasPoints = list.some((s) => s.points !== 0)

  function reset() {
    if (!window.confirm('Remettre tous les points à zéro ? Le classement repart de zéro (les joueurs restent connectés).')) return
    onAction('reset')
  }

  return (
    <section className="card-gold rounded-xl p-4" aria-label="Points et classement">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-[#D4AF37]" />Points et classement</h2>
          <p className="text-xs text-[#9a94b5]">
            Une bonne réponse donne ses points {team ? 'à l’équipe' : 'au joueur'} qui a la main. Corrigez avec + et −.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!scores}
            onClick={() => onAction(shown ? 'hide' : 'show')}
            className={`${chip} ${shown ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]' : 'border-white/10 text-gray-200 hover:border-[#D4AF37]/40'}`}
          >
            {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {shown ? 'Masquer le classement' : 'Afficher le classement sur l’écran géant'}
          </button>
          <button type="button" disabled={!scores || !hasPoints} onClick={reset} className={`${chip} border-white/10 text-gray-300 hover:border-red-400/50 hover:text-red-300`}>
            <RotateCcw className="h-4 w-4" />
            Remettre à zéro
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label htmlFor="bz-points-round" className="flex items-center gap-2 text-gray-300">
          Points par bonne réponse
          {scores ? <PointsInput id="bz-points-round" value={scores.pointsPerRound} onCommit={(n) => onAction('settings', { pointsPerRound: n })} /> : <span className="text-[#9a94b5]">…</span>}
        </label>
        {showVotePoints && (
          <label htmlFor="bz-points-vote" className="flex items-center gap-2 text-gray-300">
            Points pour un bon vote
            {scores ? <PointsInput id="bz-points-vote" value={scores.votePoints} onCommit={(n) => onAction('settings', { votePoints: n })} /> : <span className="text-[#9a94b5]">…</span>}
          </label>
        )}
        <span className="text-xs text-[#9a94b5]">0 = pas de points. Une manche préparée peut avoir sa propre valeur.</span>
      </div>

      {list.length === 0 ? (
        <p className="mt-3 text-sm text-[#9a94b5]">{team ? 'Les équipes' : 'Les joueurs'} apparaîtront ici dès leur inscription.</p>
      ) : (
        <ol className="mt-3 grid sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-1 max-h-80 overflow-y-auto">
          {list.map((s) => (
            <li key={s.unit} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/[0.03] text-sm tabular-nums">
              <span className="w-7 text-[#D4AF37] font-semibold">{s.rank}</span>
              <span className="flex-1 min-w-0 truncate text-gray-200">{s.label}</span>
              <span className={`w-16 text-right ${s.points > 0 ? 'text-white font-semibold' : 'text-[#9a94b5]'}`}>{formatPoints(s.points)}</span>
              <button type="button" aria-label={`Retirer 1 point à ${s.label}`} title="−1" onClick={() => onAction('adjust', { unit: s.unit, delta: -1 })} className="p-1.5 rounded-md border border-white/10 text-gray-300 hover:border-[#D4AF37]/40">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label={`Ajouter 1 point à ${s.label}`} title="+1" onClick={() => onAction('adjust', { unit: s.unit, delta: 1 })} className="p-1.5 rounded-md border border-white/10 text-gray-300 hover:border-[#D4AF37]/40">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
