// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Boule AnimaBingo (CSS pur, couleur de sa dizaine) et tableau des 90.

import type { CSSProperties } from 'react'
import { ballVars } from '@/lib/bingo/display'
import { digitsClass } from '@/lib/bingo/tombola'

export function Ball({ n, size, className = '', label }: { n: number | null; size: number; className?: string; label?: string }) {
  const style = { '--s': `${size}px`, ...(n ? ballVars(n) : {}) } as CSSProperties
  return (
    <div className={`ball ${n ? '' : 'empty'} ${digitsClass(n)} ${className}`} style={style} role="img" aria-label={label ?? (n ? `Boule ${n}` : 'Aucune boule')}>
      <div className="ball-med"><span>{n ?? '–'}</span></div>
      <i className="ball-spec" />
    </div>
  )
}

export function Board({ drawn, last, className = '' }: { drawn: readonly number[]; last: number | null; className?: string }) {
  const out = new Set(drawn)
  return (
    <div className={`board ${className}`} role="list" aria-label={`${drawn.length} boules sorties sur 90`}>
      {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          role="listitem"
          className={`tile ${out.has(n) ? 'on' : ''} ${n === last ? 'last' : ''}`}
          style={ballVars(n) as CSSProperties}
          aria-label={out.has(n) ? `${n}, sorti` : `${n}`}
        >
          {n}
        </div>
      ))}
    </div>
  )
}
