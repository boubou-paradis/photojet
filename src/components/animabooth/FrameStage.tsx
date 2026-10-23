// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Scène d'un template : la photo (ou la vidéo) remplit la zone transparente
// en mode « remplir », le PNG du cadre est posé par-dessus. Positions en
// pourcentages : la même scène sert à l'aperçu admin et, plus tard, à
// l'aperçu en direct de la tablette. Aucun calcul image par image.

import type { ReactNode } from 'react'
import type { PhotoZone } from '@/lib/borne-templates/constants'

interface FrameStageProps {
  templateSrc: string
  width: number
  height: number
  zone: PhotoZone
  /** Contenu dessiné dans la zone (doit remplir son parent : w-full h-full object-cover). */
  children: ReactNode
  /** Contour pointillé de la zone détectée (écran d'import). */
  showZone?: boolean
  className?: string
}

export default function FrameStage({ templateSrc, width, height, zone, children, showZone, className }: FrameStageProps) {
  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  return (
    <div className={`relative overflow-hidden ${className ?? ''}`} style={{ aspectRatio: `${width} / ${height}` }}>
      <div
        className="absolute overflow-hidden"
        style={{ left: pct(zone.x, width), top: pct(zone.y, height), width: pct(zone.w, width), height: pct(zone.h, height) }}
      >
        {children}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG du Storage ou blob: local, dimensions variables */}
      <img src={templateSrc} alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none" draggable={false} />
      {showZone && (
        <div
          className="absolute border-2 border-dashed border-[#D4AF37] pointer-events-none"
          style={{ left: pct(zone.x, width), top: pct(zone.y, height), width: pct(zone.w, width), height: pct(zone.h, height) }}
        />
      )}
    </div>
  )
}

/** Photo d'exemple dessinée (aucune image tierce) : deux invités sur fond de soirée. */
export function SamplePhoto() {
  return (
    <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" className="w-full h-full block" aria-hidden>
      <defs>
        <linearGradient id="abt-sample-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b2a63" />
          <stop offset="1" stopColor="#1c2440" />
        </linearGradient>
      </defs>
      <rect width="300" height="300" fill="url(#abt-sample-bg)" />
      <circle cx="60" cy="60" r="26" fill="#f3c75a" opacity=".22" />
      <circle cx="245" cy="80" r="18" fill="#b16cff" opacity=".25" />
      <circle cx="210" cy="40" r="10" fill="#ffd25a" opacity=".3" />
      <circle cx="118" cy="132" r="30" fill="#e8b996" />
      <path d="M62 300 C62 214 90 184 118 184 C146 184 174 214 174 300Z" fill="#7c3aed" />
      <circle cx="188" cy="146" r="27" fill="#c98f6b" />
      <path d="M138 300 C138 226 162 198 188 198 C214 198 238 226 238 300Z" fill="#D4AF37" />
    </svg>
  )
}
