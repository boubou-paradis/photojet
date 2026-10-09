// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// LE buzzer AnimaBuzz : le même objet partout (téléphone, écran géant,
// animateur), comme sur la carte promo. Purement visuel : l'état vient de
// `state`, la taille de `size` (toute unité CSS). Styles : BUZZER_CSS.

import { forwardRef, type CSSProperties } from 'react'

export type BuzzerVisualState = 'off' | 'open' | 'pressed' | 'sent' | 'win' | 'rank' | 'late' | 'wrong' | 'test' | 'tested'

const LABELS: Record<BuzzerVisualState, string> = {
  off: 'BUZZ !', open: 'BUZZ !', pressed: 'BUZZ !', sent: 'BUZZ !', win: '1er',
  rank: '2e', late: 'BUZZ !', wrong: 'BUZZ !', test: 'TEST', tested: '✓',
}

// Éclats autour du dôme : positions fixes (pas de hasard au rendu).
const SPARKS = Array.from({ length: 12 }, (_, i) => ({
  a: Math.round((360 / 12) * i + (i % 2 ? 9 : -6)),
  r: (i % 3 === 0 ? 0.66 : i % 3 === 1 ? 0.6 : 0.72) * 100,
  d: ((i * 0.37) % 2.4).toFixed(2),
}))

interface BuzzerProps {
  state: BuzzerVisualState
  /** Diamètre (ex. « 70cqw », « 29cqw », « 84px »). */
  size: string
  /** Texte du dôme ; par défaut celui de l'état (« BUZZ ! », « 1er »…). */
  label?: string
  /** Version miniature de la page animateur : sans orbites ni éclats. */
  mini?: boolean
  className?: string
}

const Buzzer = forwardRef<HTMLDivElement, BuzzerProps>(function Buzzer({ state, size, label, mini, className }, ref) {
  const text = label ?? LABELS[state]
  return (
    <div
      ref={ref}
      className={`bz${mini ? ' bz-mini' : ''}${className ? ` ${className}` : ''}`}
      data-state={state}
      style={{ '--s': size } as CSSProperties}
      aria-hidden
    >
      <div className="bz-halo" />
      <svg className="bz-orbit" viewBox="-60 -60 120 120">
        <ellipse className="t1" rx="57" ry="16" transform="rotate(-13)" />
        <ellipse className="f1" rx="57" ry="16" transform="rotate(-13)" />
        <ellipse className="t2" rx="54" ry="21" transform="rotate(17)" />
        <ellipse className="f2" rx="54" ry="21" transform="rotate(17)" />
      </svg>
      <div className="bz-plinth" />
      <div className="bz-base" />
      <div className="bz-gold" />
      <div className="bz-goldglow" />
      <div className="bz-neon" />
      <div className="bz-scan" />
      <div className="bz-dome">
        <i className="bz-spec" />
        <i className="bz-shade" />
        <i className="bz-flash" />
      </div>
      <div className="bz-label">
        {text === 'BUZZ !' && (
          <svg viewBox="0 0 40 12">
            <path d="M7 11 L3 4" />
            <path d="M15 9 L13.5 1" />
            <path d="M25 9 L26.5 1" />
            <path d="M33 11 L37 4" />
          </svg>
        )}
        <span>{text}</span>
      </div>
      <div className="bz-wave" />
      <div className="bz-sparks">
        {SPARKS.map((s) => (
          <i key={s.a} style={{ '--a': `${s.a}deg`, '--r': `${s.r}%`, '--d': `${s.d}s` } as CSSProperties} />
        ))}
      </div>
    </div>
  )
})

export default Buzzer
