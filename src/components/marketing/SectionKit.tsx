// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

/**
 * Système commun des sections de la page d'accueil (direction « régie de soirée »).
 *
 * La cohérence vient d'ici : marges, fonds, échelle typographique et en-tête de section.
 * La COMPOSITION de chaque section reste libre (frise, colonnes asymétriques, mosaïque…).
 *
 * Fonds (3 niveaux seulement) :
 *   page    → transparent (fond général de la page)
 *   regie   → bande légèrement relevée, pour alterner le rythme
 * Marges horizontales alignées sur le haut de page : 24 / 40 / 48 px.
 */

import type { ReactNode } from 'react'

export const SURFACE = {
  page: '',
  regie: 'bg-[#0f0f16] border-y border-white/[0.06]',
} as const

/** Carte « en avant » (troisième niveau de fond) */
export const CARD = 'bg-[#16161f] border border-white/[0.07] rounded-2xl'

export function Section({
  id,
  surface = 'page',
  className = '',
  children,
}: {
  id?: string
  surface?: keyof typeof SURFACE
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={`relative px-6 lg:px-10 2xl:px-12 py-20 lg:py-28 ${id ? 'scroll-mt-20' : ''} ${SURFACE[surface]} ${className}`}
    >
      {children}
    </section>
  )
}

/** Mot mis en valeur dans un titre : Playfair, doré, italique (même signature que le bandeau partenaires) */
export function Accent({ children }: { children: ReactNode }) {
  return (
    <em className="font-[family-name:var(--font-playfair)] italic font-semibold text-[#D4AF37] tracking-normal">
      {children}
    </em>
  )
}

/** Surtitre discret : trait doré + libellé en petites capitales (remplace les pastilles) */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
      <span aria-hidden="true" className="h-px w-8 bg-[#D4AF37]/70" />
      {children}
    </p>
  )
}

/**
 * En-tête de section. Trois dispositions :
 *  - left   : titre et introduction empilés à gauche (par défaut)
 *  - split  : titre à gauche, introduction calée à droite sur la ligne de base (sections pleine largeur)
 *  - center : réservé aux moments de conclusion (tarifs, appel final)
 */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = 'left',
  className = '',
}: {
  eyebrow?: ReactNode
  title: ReactNode
  intro?: ReactNode
  align?: 'left' | 'center' | 'split'
  className?: string
}) {
  if (align === 'split') {
    return (
      <div className={`grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)] lg:items-end lg:gap-16 ${className}`}>
        <div className="max-w-[640px]">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 className={`${eyebrow ? 'mt-4' : ''} text-[2.1rem] leading-[1.08] sm:text-[2.6rem] lg:text-[3.1rem] font-semibold tracking-[-0.025em] text-white text-balance`}>
            {title}
          </h2>
        </div>
        {intro && <p className="text-base lg:text-lg leading-relaxed text-[#A1A1AA] max-w-[38ch] lg:pb-2">{intro}</p>}
      </div>
    )
  }
  const center = align === 'center'
  return (
    <div className={`${center ? 'text-center mx-auto [&>p:first-child]:justify-center' : ''} max-w-[640px] ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-4 text-[2.1rem] leading-[1.08] sm:text-[2.6rem] lg:text-[3.1rem] font-semibold tracking-[-0.025em] text-white text-balance">
        {title}
      </h2>
      {intro && <p className="mt-5 text-base lg:text-lg leading-relaxed text-[#A1A1AA] max-w-[56ch]">{intro}</p>}
    </div>
  )
}
