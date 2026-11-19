// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Machine à boules « La Couronne » (maquette validée) : sphère de verre,
// anneaux d'or, goulotte et berceau. Les boules visibles dans la sphère sont
// des boules ENCORE à tirer. 100 % CSS/SVG, aucune image.

import { useId, useMemo, type CSSProperties } from 'react'
import { Ball } from '../Ball'

/** Générateur pseudo-aléatoire déterministe (positions stables d'un rendu à l'autre). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function GoldRings({ w, h, tilt1 = -16, tilt2 = 74, className = 'rings' }: { w: number; h: number; tilt1?: number; tilt2?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  const cx = w / 2
  const cy = h / 2
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7a5c10" /><stop offset=".22" stopColor="#f3dc8f" /><stop offset=".34" stopColor="#fff6d2" />
          <stop offset=".5" stopColor="#b8901f" /><stop offset=".72" stopColor="#ecd081" /><stop offset="1" stopColor="#6e520c" />
        </linearGradient>
        <filter id={`f${id}`}><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <g transform={`rotate(${tilt1} ${cx} ${cy})`}>
        <ellipse cx={cx} cy={cy} rx={w * 0.46} ry={h * 0.13} fill="none" stroke="#a66bff" strokeWidth="10" opacity=".35" filter={`url(#f${id})`} />
        <ellipse cx={cx} cy={cy} rx={w * 0.46} ry={h * 0.13} fill="none" stroke={`url(#g${id})`} strokeWidth="9" />
        <ellipse cx={cx} cy={cy} rx={w * 0.46} ry={h * 0.13} fill="none" stroke="#fff8dc" strokeWidth="1.2" opacity=".7" strokeDasharray="2 14" />
      </g>
      <g transform={`rotate(${tilt2} ${cx} ${cy})`} opacity=".95">
        <ellipse cx={cx} cy={cy} rx={w * 0.44} ry={h * 0.1} fill="none" stroke={`url(#g${id})`} strokeWidth="6" />
      </g>
    </svg>
  )
}

export type MachineMode = 'idle' | 'hot' | 'freeze' | 'gold'

export function Machine({ x, y, scale = 1, mode = 'idle', drawn, cradle = null, seed = 3, style }: {
  x: number
  y: number
  scale?: number
  mode?: MachineMode
  drawn: readonly number[]
  /** Dernière boule posée dans le berceau. */
  cradle?: number | null
  seed?: number
  style?: CSSProperties
}) {
  const balls = useMemo(() => {
    const out = new Set(drawn)
    const left = Array.from({ length: 90 }, (_, i) => i + 1).filter((n) => !out.has(n))
    const r = rng(seed)
    const count = Math.min(26, left.length)
    const spread = mode === 'hot' || mode === 'gold'
    return Array.from({ length: count }, (_, i) => {
      const n = left[Math.floor(r() * left.length)] ?? left[i]
      const s = 58 + Math.floor(r() * 10)
      let px: number
      let py: number
      if (spread) {
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r()) * 180
        px = 235 + Math.cos(a) * d - s / 2
        py = 235 + Math.sin(a) * d - s / 2
      } else {
        const a = Math.PI * (0.08 + r() * 0.84)
        const d = 120 + r() * 95
        px = 235 + Math.cos(a) * d * (r() > 0.5 ? 1 : -1) * 0.95 - s / 2
        py = 235 + Math.sin(a) * d * 0.9 - s / 2 + 12
      }
      return {
        key: `${i}-${n}`, n, s, px, py,
        vars: { '--dx': `${Math.round(r() * 60 - 30)}px`, '--dy': `${Math.round(r() * 60 - 30)}px`, '--t': `${(5 + r() * 4).toFixed(1)}s`, '--t2': `${(0.9 + r() * 0.6).toFixed(2)}s`, opacity: 0.78 + r() * 0.22 },
      }
    })
    // Les boules ne bougent de place qu'au tirage suivant (nombre de boules sorties).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn.length, seed, mode])

  return (
    <div className={`machine ${mode}`} style={{ left: x, top: y, transform: `scale(${scale})`, ...style }} aria-hidden>
      <div className="orb">
        {balls.map((b) => (
          <div key={b.key} className="pos" style={{ left: b.px, top: b.py, ...(b.vars as CSSProperties) }}>
            <Ball n={b.n} size={b.s} />
          </div>
        ))}
      </div>
      <div className="glass-hi" />
      <GoldRings w={640} h={560} />
      <svg className="tube" viewBox="0 0 170 240" aria-hidden>
        <defs>
          <linearGradient id="bgo-tb" x1="0" x2="1">
            <stop offset="0" stopColor="rgba(200,170,255,.10)" /><stop offset=".5" stopColor="rgba(230,215,255,.28)" /><stop offset="1" stopColor="rgba(200,170,255,.10)" />
          </linearGradient>
        </defs>
        <path d="M20 10 C 80 40, 120 90, 128 200" stroke="url(#bgo-tb)" strokeWidth="64" fill="none" strokeLinecap="round" />
        <path d="M20 10 C 80 40, 120 90, 128 200" stroke="rgba(255,255,255,.35)" strokeWidth="2" fill="none" transform="translate(-26 4)" />
        <path d="M20 10 C 80 40, 120 90, 128 200" stroke="#d4af37" strokeWidth="3" fill="none" transform="translate(28 -6)" opacity=".8" />
      </svg>
      <div className="collar" /><div className="base" /><div className="lightstrip" /><div className="plinth" />
      <div className="cradle" />
      {cradle ? <div className="in-cradle" key={cradle}><Ball n={cradle} size={72} /></div> : null}
    </div>
  )
}
