// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Cadre commun des écrans téléphone de Matching (360 à 430 px).

import type { ReactNode } from 'react'
import AffinityMark from './AffinityMark'

interface PhoneShellProps {
  /** Texte à droite de l'en-tête (ex. « Question 3 / 10 »). */
  aside?: string
  children: ReactNode
}

export default function PhoneShell({ aside, children }: PhoneShellProps) {
  return (
    <div
      className="min-h-[100dvh] text-[#f4efe3]"
      style={{ background: 'radial-gradient(110% 60% at 50% 115%, #2a1757 0%, #150d2b 45%, #0a0a14 85%)' }}
    >
      <div className="mx-auto max-w-[430px] min-h-[100dvh] flex flex-col px-5 pt-6 pb-8">
        <div className="flex items-center gap-2.5 text-[13px] text-[#9a94b5]">
          <AffinityMark size={16} />
          <strong className="text-[#f4efe3] text-[17px]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>Matching</strong>
          {aside && <span className="ml-auto">{aside}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}

export const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' } as const
