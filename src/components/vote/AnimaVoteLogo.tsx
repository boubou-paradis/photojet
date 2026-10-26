// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Logo AnimaVote validé (même famille qu'AnimaBuzz) : ANIMA ivoire, VOTE or,
// relief violet, légère rotation ; symbole bulletin + coche dans un anneau or.
// `small` : relief simplifié, lisible en petit.

import { useId, type CSSProperties } from 'react'

interface AnimaVoteLogoProps {
  variant?: 'full' | 'small'
  /** Symbole bulletin + coche devant le titre. */
  mark?: boolean
  /** Phrase manuscrite sous le titre (« À vous de voter ! »…). */
  tagline?: string
  /** Taille du titre (ex. « 6.2cqw », « 22px »). */
  size: string
  className?: string
}

export function VoteMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b8" />
          <stop offset=".55" stopColor="#f5c542" />
          <stop offset="1" stopColor="#c98a1e" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill="#2a0f5c" stroke={`url(#${id})`} strokeWidth="3" />
      <rect x="14" y="11" width="20" height="25" rx="3" fill="#f7f0e3" />
      <path d="M18 24l4.5 4.5L31 19" fill="none" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AnimaVoteLogo({ variant = 'full', mark = false, tagline, size, className }: AnimaVoteLogoProps) {
  return (
    <span className={className} style={{ '--s': size } as CSSProperties}>
      <span className={`av-logo${variant === 'small' ? ' sm' : ''}`} role="img" aria-label="AnimaVote">
        {mark && <VoteMark className="mark" />}
        <b className="a" aria-hidden>ANIMA</b>
        <b className="v" aria-hidden>VOTE</b>
      </span>
      {tagline && <span className="av-tag">{tagline}</span>}
    </span>
  )
}
