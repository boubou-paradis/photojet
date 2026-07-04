'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { WheelSegment } from '@/types/database'
// Palette casino partagée avec WheelGame (wheel-theme.ts)
import { GEMS, GOLD } from './wheel-theme'

interface WheelPreviewProps {
  segments: WheelSegment[]
  size?: number
}

// Arrondi anti-mismatch d'hydratation (Math.cos/sin Node ≠ navigateur au dernier ULP)
const rnd = (n: number) => Math.round(n * 1000) / 1000

export default function WheelPreview({ segments, size = 280 }: WheelPreviewProps) {
  const [bulbPhase, setBulbPhase] = useState(0)

  // Scintillement des ampoules
  useEffect(() => {
    const interval = setInterval(() => setBulbPhase(prev => (prev + 1) % 2), 600)
    return () => clearInterval(interval)
  }, [])

  const cx = 200, cy = 200, r = 150
  const wheelSegments = useMemo(() => {
    const count = segments.length
    if (count === 0) return []
    const anglePerSegment = (2 * Math.PI) / count
    return segments.map((segment, index) => {
      const startAngle = index * anglePerSegment - Math.PI / 2
      const endAngle = startAngle + anglePerSegment
      const x1 = rnd(cx + r * Math.cos(startAngle)), y1 = rnd(cy + r * Math.sin(startAngle))
      const x2 = rnd(cx + r * Math.cos(endAngle)), y2 = rnd(cy + r * Math.sin(endAngle))
      const largeArcFlag = anglePerSegment > Math.PI ? 1 : 0
      const pathData = [`M ${cx} ${cy}`, `L ${x1} ${y1}`, `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`, 'Z'].join(' ')
      const midAngle = startAngle + anglePerSegment / 2
      const textRadius = r * 0.66
      const textX = rnd(cx + textRadius * Math.cos(midAngle))
      const textY = rnd(cy + textRadius * Math.sin(midAngle))
      const dividerX = x1, dividerY = y1
      // Rivet doré à la jonction des segments, près du bord (harmonisé v3)
      const rivetRadius = r - 11
      const rivetX = rnd(cx + rivetRadius * Math.cos(startAngle)), rivetY = rnd(cy + rivetRadius * Math.sin(startAngle))
      return { id: segment.id, pathData, idx: index, textX, textY, dividerX, dividerY, rivetX, rivetY }
    })
  }, [segments])

  // Ampoules sur le cadre doré
  const bulbs = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i * 360 / 24 - 90) * (Math.PI / 180)
      const br = 184
      const x = rnd(200 + br * Math.cos(angle))
      const y = rnd(200 + br * Math.sin(angle))
      return { id: i, x, y, isLit: (i + bulbPhase) % 2 === 0 }
    })
  }, [bulbPhase])

  if (segments.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: 'radial-gradient(circle, #111827 0%, #06070f 100%)',
          border: `3px solid rgba(246,196,83,0.55)`,
          boxShadow: '0 0 24px rgba(212,175,55,0.2), inset 0 0 30px rgba(0,0,0,0.7)',
        }}
      >
        <p className="text-[#d4af37]/70 text-sm text-center px-4" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          Ajoutez au moins<br />2 segments
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Lueur dorée d'ambiance */}
      <div className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.28) 0%, transparent 65%)' }} />

      {/* COURONNE OR MÉTALLIQUE FIXE + AMPOULES (harmonisée v3) */}
      <svg width={size} height={size} viewBox="0 0 400 400" className="absolute inset-0 pointer-events-none">
        <defs>
          <radialGradient id="prevFrame" cx="50%" cy="42%" r="55%">
            <stop offset="74%" stopColor={GOLD.g2} />
            <stop offset="86%" stopColor={GOLD.g3} />
            <stop offset="100%" stopColor={GOLD.g4} />
          </radialGradient>
          <radialGradient id="prevRivet" cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor={GOLD.g1} />
            <stop offset="55%" stopColor={GOLD.g2} />
            <stop offset="100%" stopColor={GOLD.g4} />
          </radialGradient>
          <filter id="prevBulbGlow">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Cerclage externe or sombre + anneau bombé + filets */}
        <circle cx="200" cy="200" r="198" fill={GOLD.g4} />
        <circle cx="200" cy="200" r="195" fill="url(#prevFrame)" />
        <circle cx="200" cy="200" r="196.5" fill="none" stroke={GOLD.g1} strokeWidth="1.2" strokeOpacity="0.5" />
        <circle cx="200" cy="200" r="172" fill="none" stroke={GOLD.g4} strokeWidth="1.2" strokeOpacity="0.7" />
        {/* Gorge sombre (lit de la roue) */}
        <circle cx="200" cy="200" r="168" fill="#06070f" />
        <circle cx="200" cy="200" r="168" fill="none" stroke={GOLD.g1} strokeWidth="1" strokeOpacity="0.4" />

        {/* Ampoules — socle doré + verre chaud */}
        {bulbs.map((bulb) => (
          <g key={bulb.id}>
            <circle cx={bulb.x} cy={bulb.y} r="6.2" fill="url(#prevRivet)" />
            <circle cx={bulb.x} cy={bulb.y} r="4.6"
              fill={bulb.isLit ? '#ffe49b' : '#8a6a2a'}
              filter={bulb.isLit ? 'url(#prevBulbGlow)' : undefined} />
          </g>
        ))}
      </svg>

      {/* ROUE TOURNANTE */}
      <motion.svg
        width={size} height={size} viewBox="0 0 400 400"
        initial={{ rotate: 0 }} animate={{ rotate: 360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="relative"
      >
        <defs>
          {GEMS.map((gem, i) => (
            <radialGradient key={i} id={`pgem-${i}`} cx="200" cy="200" r="150" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={gem.light} />
              <stop offset="58%" stopColor={gem.base} />
              <stop offset="100%" stopColor={gem.dark} />
            </radialGradient>
          ))}
          <radialGradient id="pgloss" cx="200" cy="78" r="156" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
            <stop offset="34%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          {/* Assombrissement près du bord — effet laque/vernis (harmonisé v3) */}
          <radialGradient id="prim-shade" cx="200" cy="200" r="150" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="78%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.42)" />
          </radialGradient>
          {/* Or métallique des séparateurs */}
          <linearGradient id="pgold-stroke" x1="0" y1="0" x2="400" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={GOLD.g1} />
            <stop offset="45%" stopColor={GOLD.g2} />
            <stop offset="100%" stopColor={GOLD.g3} />
          </linearGradient>
          <radialGradient id="pgold-rivet" cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor={GOLD.g1} />
            <stop offset="55%" stopColor={GOLD.g2} />
            <stop offset="100%" stopColor={GOLD.g4} />
          </radialGradient>
        </defs>

        {/* Disque de fond */}
        <circle cx={cx} cy={cy} r={r + 2} fill="#06070f" />

        {/* Segments glossy — bord légèrement assombri */}
        {wheelSegments.map((seg) => (
          <path key={`seg-${seg.id}`} d={seg.pathData} fill={`url(#pgem-${seg.idx % GEMS.length})`}
            stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
        ))}

        {/* Reflet glossy global + vernis périphérique */}
        <circle cx={cx} cy={cy} r={r} fill="url(#pgloss)" pointerEvents="none" />
        <circle cx={cx} cy={cy} r={r} fill="url(#prim-shade)" pointerEvents="none" />

        {/* Séparateurs or en relief */}
        {wheelSegments.map((seg) => (
          <g key={`div-${seg.id}`}>
            <line x1={cx} y1={cy} x2={seg.dividerX} y2={seg.dividerY}
              stroke="url(#pgold-stroke)" strokeWidth="2.8" strokeLinecap="round" />
            <line x1={cx} y1={cy} x2={seg.dividerX} y2={seg.dividerY}
              stroke={GOLD.g1} strokeWidth="0.8" strokeOpacity="0.8" strokeLinecap="round" />
          </g>
        ))}

        {/* Rivets dorés aux jonctions */}
        {wheelSegments.map((seg) => (
          <g key={`rivet-${seg.id}`}>
            <circle cx={seg.rivetX} cy={seg.rivetY} r="3.8" fill="url(#pgold-rivet)" stroke="rgba(111,67,8,0.7)" strokeWidth="0.8" />
            <circle cx={seg.rivetX - 1} cy={seg.rivetY - 1.2} r="1.1" fill="rgba(255,251,230,0.85)" />
          </g>
        ))}

        {/* Double cerclage intérieur fin */}
        <circle cx={cx} cy={cy} r={r - 0.5} fill="none" stroke="url(#pgold-stroke)" strokeWidth="2" strokeOpacity="0.85" />
        <circle cx={cx} cy={cy} r={r - 4} fill="none" stroke={GOLD.g1} strokeWidth="0.7" strokeOpacity="0.4" />

        {/* Numéros ivoire embossés */}
        {wheelSegments.map((seg, i) => (
          <g key={`txt-${seg.id}`}>
            <text x={seg.textX} y={seg.textY + 1.8}
              fill="rgba(0,0,0,0.55)" fontSize="30" textAnchor="middle" dominantBaseline="central"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 800 }}>
              {i + 1}
            </text>
            <text x={seg.textX} y={seg.textY}
              fill={GOLD.ivory} fontSize="30" textAnchor="middle" dominantBaseline="central"
              stroke="rgba(255,241,168,0.35)" strokeWidth="0.5"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 800, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>
              {i + 1}
            </text>
          </g>
        ))}
      </motion.svg>

      {/* MOYEU CENTRAL FIXE — plaque laquée noire + étoile (harmonisé v3) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full flex items-center justify-center pointer-events-none overflow-hidden"
        style={{
          width: '24%', height: '24%',
          background: 'radial-gradient(circle at 50% 34%, #23242e 0%, #0b0b13 62%, #040308 100%)',
          boxShadow: `0 0 0 2.5px ${GOLD.g2}, 0 0 0 5px rgba(0,0,0,0.7), 0 0 0 6.5px rgba(246,196,83,0.55), 0 0 0 7.5px rgba(111,67,8,0.5), inset 0 0 16px rgba(0,0,0,0.85), 0 0 16px rgba(212,175,55,0.3)`,
        }}>
        {/* Reflet verre bombé */}
        <div className="absolute pointer-events-none" style={{ top: '6%', left: '15%', width: '70%', height: '32%', borderRadius: '50%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 70%, transparent 100%)' }} />
        <span style={{ color: GOLD.g2, fontSize: `${size * 0.07}px`, lineHeight: 1, filter: 'drop-shadow(0 0 5px rgba(246,196,83,0.65))' }}>✦</span>
      </div>

      {/* POINTEUR goutte ivoire, contour or métallique, rivet (harmonisé v3) */}
      <div className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none" style={{ top: '-2%', width: '8.5%' }}>
        <svg viewBox="0 0 40 58" className="w-full h-auto" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.65))' }}>
          <defs>
            <linearGradient id="pv-ptr-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD.g1} />
              <stop offset="45%" stopColor={GOLD.g2} />
              <stop offset="100%" stopColor={GOLD.g3} />
            </linearGradient>
            <radialGradient id="pv-ptr-rivet" cx="38%" cy="30%" r="80%">
              <stop offset="0%" stopColor={GOLD.g1} />
              <stop offset="55%" stopColor={GOLD.g2} />
              <stop offset="100%" stopColor={GOLD.g4} />
            </radialGradient>
          </defs>
          <path d="M20 57 C 8 39 2 30 2 18 A 18 18 0 1 1 38 18 C 38 30 32 39 20 57 Z"
            fill="#fff9e6" stroke="url(#pv-ptr-gold)" strokeWidth="4" />
          <path d="M20 53 C 10 37 5 29 5 18 A 15 15 0 1 1 35 18 C 35 29 30 37 20 53 Z"
            fill="none" stroke="rgba(111,67,8,0.28)" strokeWidth="1.6" />
          <ellipse cx="13.5" cy="13" rx="5.5" ry="7.5" fill="rgba(255,255,255,0.75)" />
          <circle cx="20" cy="18" r="4.6" fill="url(#pv-ptr-rivet)" stroke="rgba(111,67,8,0.6)" strokeWidth="0.8" />
        </svg>
      </div>
    </div>
  )
}
