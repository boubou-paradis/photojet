// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { useWindowFocus } from '@/hooks/useRemoteControl'
import RemoteLegend, { type RemoteLegendData } from './RemoteLegend'

interface RemoteControlBadgeProps {
  enabled: boolean
  onToggle: (on: boolean) => void
  /** Partie lancée : le badge d'état n'apparaît que pendant la partie. */
  gameActive: boolean
  /** Partie terminée : la télécommande est coupée, pas de badge. */
  finished?: boolean
  /** Légende des touches pour l'état en cours (calculée par la régie). */
  legend?: RemoteLegendData
  /** En-tête très chargé (AnimaBingo) : sous 1500 px, bouton « Touches » en icône et pastille « Prête ». */
  compactLegend?: boolean
}

export default function RemoteControlBadge({ enabled, onToggle, gameActive, finished = false, legend, compactLegend = false }: RemoteControlBadgeProps) {
  const focused = useWindowFocus()
  const showStatus = enabled && gameActive && !finished

  return (
    <div className="flex items-center gap-2">
      {showStatus && (
        focused ? (
          <span data-testid="remote-badge" className="text-xs font-medium text-green-400 border border-green-500/30 bg-green-500/10 rounded-full px-2.5 py-1">
            {compactLegend ? (
              <>
                <span className="max-[1499px]:hidden">Télécommande prête</span>
                <span className="min-[1500px]:hidden">Prête</span>
              </>
            ) : 'Télécommande prête'}
          </span>
        ) : (
          <span data-testid="remote-badge" className="text-xs font-medium text-orange-300 border border-orange-500/30 bg-orange-500/10 rounded-full px-2.5 py-1 animate-pulse">
            Cliquez sur cette fenêtre
          </span>
        )
      )}
      {enabled && legend && <RemoteLegend data={legend} compact={compactLegend} />}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onToggle(!enabled)}
        title="Piloter ce jeu avec une télécommande de présentation (PageDown / PageUp)"
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border border-white/10 text-gray-300 hover:border-[#D4AF37]/40 transition-colors"
      >
        Télécommande
        <span className={`relative w-8 h-4 rounded-full transition-colors ${enabled ? 'bg-[#D4AF37]' : 'bg-gray-600'}`}>
          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${enabled ? 'left-4' : 'left-0.5'}`} />
        </span>
      </button>
    </div>
  )
}
