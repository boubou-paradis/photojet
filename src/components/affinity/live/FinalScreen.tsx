// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Écran géant de fin : uniquement les statistiques collectives qui existent
// vraiment, puis l'invitation à regarder son téléphone.

import AffinityMark from '../AffinityMark'
import { finalStatLines } from '@/lib/affinity/phrases'
import type { AffinityFinalStats } from '@/lib/affinity/types'

interface FinalScreenProps {
  stats: AffinityFinalStats | null | undefined
}

export default function FinalScreen({ stats }: FinalScreenProps) {
  const lines = finalStatLines(stats)
  const [hero, ...others] = lines

  return (
    <div className="aff-stage">
      <div className="aff-brand"><AffinityMark size={22} /><span>Matching</span><small>Ce soir, la salle…</small></div>

      {hero ? (
        <div className={`aff-stats ${others.length === 0 ? 'aff-stats-solo' : ''}`}>
          <div className="aff-stat aff-stat-hero">
            <h3>{hero.label}</h3>
            <p>{hero.text}</p>
          </div>
          {others.length > 0 && (
            <div className="aff-stat-col">
              {others.slice(0, 3).map((line) => (
                <div key={line.label} className="aff-stat">
                  <h3>{line.label}</h3>
                  <p>{line.text}</p>
                </div>
              ))}
            </div>
          )}
          <p className="aff-cta">Regardez votre téléphone : découvrez <span>qui a répondu comme vous</span></p>
        </div>
      ) : (
        <div className="aff-cta-only">
          <p className="aff-cta">Regardez votre téléphone : découvrez <span>qui a répondu comme vous</span></p>
        </div>
      )}
    </div>
  )
}
