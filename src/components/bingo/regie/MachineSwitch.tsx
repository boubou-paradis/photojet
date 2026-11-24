'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Régie AnimaBingo / Tombola : machine du grand écran en 3D (si l'ordinateur suit) ou en 2D.
// Réglage de CE PC (aucun envoi au serveur) : l'écran /live ouvert sur ce PC l'applique aussitôt.

import { useSyncExternalStore } from 'react'
import { readMachinePref, subscribeMachinePref, writeMachinePref } from '@/lib/bingo/machine-pref'

export function MachineSwitch({ className = 'pills' }: { className?: string }) {
  const pref = useSyncExternalStore(subscribeMachinePref, readMachinePref, () => 'auto' as const)
  return (
    <div className={className} role="group" aria-label="Machine du grand écran" data-testid="machine-pref">
      <button type="button" className="pill" aria-pressed={pref === 'auto'} onClick={() => writeMachinePref('auto')} data-testid="machine-3d">3D</button>
      <button type="button" className="pill" aria-pressed={pref === '2d'} onClick={() => writeMachinePref('2d')} data-testid="machine-2d">2D</button>
    </div>
  )
}
