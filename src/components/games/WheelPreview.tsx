'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { WheelSegment } from '@/types/database'
// Palette casino partagée avec WheelGame (wheel-theme.ts)
import { GEMS } from './wheel-theme'

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
      return { id: segment.id, pathData, idx: index, textX, textY, dividerX, dividerY }
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
          background: 'radial-gradient(circle, #221b2e 0%, #0c0a12 100%)',
          border: '3px solid rgba(212,175,55,0.55)',
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

      {/* CADRE DORÉ FIXE + AMPOULES */}
      <svg width={size} height={size} viewBox="0 0 400 400" className="absolute inset-0 pointer-events-none">
        <defs>
          <radialGradient id="prevFrame" cx="50%" cy="50%" r="50%">
            <stop offset="78%" stopColor="#c9a227" />
            <stop offset="88%" stopColor="#8a6a14" />
            <stop offset="100%" stopColor="#5e470c" />
          </radialGradient>
          <filter id="prevBulbGlow">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Anneau doré */}
        <circle cx="200" cy="200" r="196" fill="url(#prevFrame)" />
        <circle cx="200" cy="200" r="196" fill="none" stroke="#f6e6a8" strokeWidth="1.5" strokeOpacity="0.5" />
        {/* Gorge sombre */}
        <circle cx="200" cy="200" r="168" fill="#0c0a12" />

        {/* Ampoules */}
        {bulbs.map((bulb) => (
          <circle key={bulb.id} cx={bulb.x} cy={bulb.y} r="5"
            fill={bulb.isLit ? '#ffe49b' : '#6b5210'}
            filter={bulb.isLit ? 'url(#prevBulbGlow)' : undefined} />
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
        </defs>

        {/* Disque de fond */}
        <circle cx={cx} cy={cy} r={r + 2} fill="#0c0a12" />

        {/* Segments pierres précieuses */}
        {wheelSegments.map((seg) => (
          <path key={`seg-${seg.id}`} d={seg.pathData} fill={`url(#pgem-${seg.idx % GEMS.length})`} />
        ))}

        {/* Reflet glossy global */}
        <circle cx={cx} cy={cy} r={r} fill="url(#pgloss)" pointerEvents="none" />

        {/* Traits dorés de séparation */}
        {wheelSegments.map((seg) => (
          <line key={`div-${seg.id}`} x1={cx} y1={cy} x2={seg.dividerX} y2={seg.dividerY}
            stroke="#f6e6a8" strokeWidth="1.4" strokeOpacity="0.9" />
        ))}

        {/* Anneau intérieur fin */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f6e6a8" strokeWidth="1.5" strokeOpacity="0.5" />

        {/* Numéros blancs */}
        {wheelSegments.map((seg, i) => (
          <text key={`txt-${seg.id}`}
            x={seg.textX} y={seg.textY}
            fill="#ffffff" fontSize="30" textAnchor="middle" dominantBaseline="central"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 800, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>
            {i + 1}
          </text>
        ))}
      </motion.svg>

      {/* MOYEU CENTRAL FIXE — noir bordé d'or + étoile */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full flex items-center justify-center pointer-events-none"
        style={{
          width: '24%', height: '24%',
          background: 'radial-gradient(circle at 50% 38%, #1a1626 0%, #0b0913 78%, #060409 100%)',
          boxShadow: '0 0 0 2.5px rgba(212,175,55,0.95), 0 0 0 5px rgba(0,0,0,0.6), 0 0 0 6.5px rgba(212,175,55,0.5), inset 0 0 14px rgba(0,0,0,0.8), 0 0 16px rgba(212,175,55,0.3)',
        }}>
        <span style={{ color: '#e7cd7e', fontSize: `${size * 0.07}px`, lineHeight: 1, filter: 'drop-shadow(0 0 5px rgba(212,175,55,0.6))' }}>✦</span>
      </div>

      {/* POINTEUR goutte blanche bordée d'or */}
      <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: '-2%', width: '8%' }}>
        <svg viewBox="0 0 40 56" className="w-full h-auto" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}>
          <path d="M20 55 C 8 38 2 30 2 18 A 18 18 0 1 1 38 18 C 38 30 32 38 20 55 Z"
            fill="#ffffff" stroke="#d4af37" strokeWidth="3.5" />
          <ellipse cx="14" cy="14" rx="6" ry="8" fill="rgba(255,255,255,0.7)" />
        </svg>
      </div>
    </div>
  )
}
