// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Visuel d'un choix AnimaVote : photo recadrée 4:5 si l'animateur en a mis
// une, sinon un dégradé à sa couleur (ou une teinte stable) avec son emoji
// ou son initiale. Utilisé partout (téléphone, écran géant, animateur).

import type { CSSProperties } from 'react'
import type { VoteCandidate } from '@/lib/vote/types'

type Visual = Pick<VoteCandidate, 'label' | 'imageUrl' | 'emoji' | 'color'>

/**
 * Teinte stable (0-359) tirée du nom : la même d'un tour à l'autre et sur
 * tous les écrans. Empreinte FNV-1a, répartie par l'angle d'or pour que
 * deux noms proches ne donnent pas deux teintes voisines.
 */
export function hueOf(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return Math.round(((h >>> 0) % 997) * 137.508) % 360
}

/** Fond d'un choix sans photo : sa couleur si elle existe, sinon une teinte stable. */
export function candidateBackground(c: Visual): CSSProperties {
  if (c.color) {
    return { background: `radial-gradient(80% 60% at 50% 35%, ${c.color}, color-mix(in srgb, ${c.color} 45%, #0a0a14) 65%, #0a0a14)` }
  }
  return { '--h': hueOf(c.label.trim().toLowerCase()) } as CSSProperties
}

interface CandidatePhotoProps {
  candidate: Visual
  /** Carré (avatars des classements) au lieu du 4:5. */
  square?: boolean
  /** Sans le dégradé sombre du bas (quand le nom n'est pas posé sur l'image). */
  clean?: boolean
  className?: string
  style?: CSSProperties
}

export default function CandidatePhoto({ candidate, square, clean, className, style }: CandidatePhotoProps) {
  const classes = ['av-ph', square ? 'sq' : '', clean ? 'clean' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <div className={classes} style={{ ...(candidate.imageUrl ? {} : candidateBackground(candidate)), ...style }}>
      {candidate.imageUrl ? (
        // Photo déjà recadrée et compressée à l'envoi : <img> simple (pas d'optimiseur Next).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={candidate.imageUrl} alt="" loading="lazy" decoding="async" draggable={false} />
      ) : (
        <span className="ini" aria-hidden>{candidate.emoji || candidate.label.trim().charAt(0).toUpperCase() || '?'}</span>
      )}
    </div>
  )
}

/** « Emma — N°4 », ou « Emma » sans numéro. */
export function candidateName(c: Pick<VoteCandidate, 'label' | 'number'>): string {
  return c.number ? `${c.label} — N°${c.number}` : c.label
}
