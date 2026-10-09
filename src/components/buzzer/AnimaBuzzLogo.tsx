// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Logo AnimaBuzz validé : le titre de la carte promo reproduit en texte.
// `full` : relief, contour, halo, éclats, anneau doré, sous-titre manuscrit.
// `small` : version simplifiée lisible en petit (sans éclats ni anneau).

import type { CSSProperties } from 'react'

interface AnimaBuzzLogoProps {
  variant?: 'full' | 'small'
  /** Afficher « Le buzzer live d'AnimaJet » sous le titre. */
  subtitle?: boolean
  /** Taille du titre (ex. « 6.4cqw », « 22px »). */
  size: string
  className?: string
}

export default function AnimaBuzzLogo({ variant = 'full', subtitle = variant === 'full', size, className }: AnimaBuzzLogoProps) {
  const classes = ['abz', variant === 'small' ? 'sm' : '', subtitle ? '' : 'nosub', className ?? ''].filter(Boolean).join(' ')
  return (
    <span className={classes} style={{ '--fs': size } as CSSProperties} role="img" aria-label="AnimaBuzz, le buzzer live d’AnimaJet">
      <svg className="swoosh" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden>
        <ellipse cx="100" cy="32" rx="98" ry="22" transform="rotate(-3 100 32)" />
      </svg>
      <span className="abz-t" aria-hidden>
        <span className="a" data-t="ANIMA">ANIMA</span>
        <span className="b" data-t="BUZZ">
          BUZZ
          <svg className="rays" viewBox="0 0 60 60">
            <path d="M8 40 L22 32" />
            <path d="M22 22 L30 8" />
            <path d="M38 26 L54 16" />
            <path d="M40 40 L56 42" />
            <circle cx="50" cy="6" r="3" />
          </svg>
        </span>
      </span>
      <span className="abz-s" aria-hidden>Le buzzer live d’AnimaJet</span>
    </span>
  )
}
