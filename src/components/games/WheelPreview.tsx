'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { WheelSegment } from '@/types/database'

interface WheelPreviewProps {
  segments: WheelSegment[]
  size?: number
}

// Brand — luxe nocturne (cohérent avec WheelGame)
const NOIR = '#0a0a14'

export default function WheelPreview({ segments, size = 280 }: WheelPreviewProps) {
  const [bulbPhase, setBulbPhase] = useState(0)

  // Scintillement des ampoules
  useEffect(() => {
    const interval = setInterval(() => {
      setBulbPhase(prev => (prev + 1) % 2)
    }, 600)
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
      const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle)
      const largeArcFlag = anglePerSegment > Math.PI ? 1 : 0
      const pathData = [`M ${cx} ${cy}`, `L ${x1} ${y1}`, `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`, 'Z'].join(' ')
      const midAngle = startAngle + anglePerSegment / 2
      const textRadius = r * 0.66
      const textX = cx + textRadius * Math.cos(midAngle)
      const textY = cy + textRadius * Math.sin(midAngle)
      const isGold = index % 2 === 1
      const dividerX = cx + r * Math.cos(startAngle), dividerY = cy + r * Math.sin(startAngle)
      return { id: segment.id, pathData, isGold, textX, textY, dividerX, dividerY }
    })
  }, [segments])

  // Ampoules sur le cadre doré
  const bulbs = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i * 360 / 24 - 90) * (Math.PI / 180)
      const br = 184
      const x = 200 + br * Math.cos(angle)
      const y = 200 + br * Math.sin(angle)
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
          background: `radial-gradient(circle, #15151f 0%, ${NOIR} 100%)`,
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
        style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.22) 0%, transparent 65%)' }} />

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
        <circle cx="200" cy="200" r="196" fill="none" stroke="#f0dca0" strokeWidth="1.5" strokeOpacity="0.45" />
        {/* Gorge sombre */}
        <circle cx="200" cy="200" r="168" fill={NOIR} />

        {/* Ampoules */}
        {bulbs.map((bulb) => (
          <circle
            key={bulb.id}
            cx={bulb.x}
            cy={bulb.y}
            r="5"
            fill={bulb.isLit ? '#ffe49b' : '#6b5210'}
            filter={bulb.isLit ? 'url(#prevBulbGlow)' : undefined}
          />
        ))}
      </svg>

      {/* ROUE TOURNANTE */}
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 400 400"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="relative"
      >
        <defs>
          <radialGradient id="prevGoldSeg" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#f7e6ad" />
            <stop offset="45%" stopColor="#e0c172" />
            <stop offset="100%" stopColor="#b8941f" />
          </radialGradient>
          <radialGradient id="prevNoirSeg" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#15151f" />
            <stop offset="100%" stopColor="#0b0b16" />
          </radialGradient>
          <radialGradient id="prevHub" cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fbf0c8" />
            <stop offset="45%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#8a6a14" />
          </radialGradient>
          <filter id="prevLineGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Disque de fond */}
        <circle cx={cx} cy={cy} r={r + 2} fill={NOIR} />

        {/* Segments noir/or alternés */}
        {wheelSegments.map((seg) => (
          <path key={`seg-${seg.id}`} d={seg.pathData}
            fill={seg.isGold ? 'url(#prevGoldSeg)' : 'url(#prevNoirSeg)'} />
        ))}

        {/* Traits dorés lumineux */}
        <g filter="url(#prevLineGlow)">
          {wheelSegments.map((seg) => (
            <line key={`div-${seg.id}`} x1={cx} y1={cy} x2={seg.dividerX} y2={seg.dividerY}
              stroke="#f4e3a6" strokeWidth="1" strokeOpacity="0.85" />
          ))}
        </g>

        {/* Anneau intérieur fin */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f4e3a6" strokeWidth="1.2" strokeOpacity="0.5" />

        {/* Chiffres — Playfair, à l'endroit, or sur noir / noir sur or */}
        {wheelSegments.map((seg, i) => (
          <text key={`txt-${seg.id}`}
            x={seg.textX} y={seg.textY}
            fill={seg.isGold ? NOIR : '#e9cf86'}
            fontSize="28"
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 700 }}
          >
            {i + 1}
          </text>
        ))}

        {/* Moyeu central doré */}
        <circle cx={cx} cy={cy} r="34" fill={NOIR} />
        <circle cx={cx} cy={cy} r="29" fill="url(#prevHub)" />
        <circle cx={cx} cy={cy} r="29" fill="none" stroke="#8a6a14" strokeWidth="1" />
        <ellipse cx="192" cy="190" rx="13" ry="8" fill="rgba(255,255,255,0.35)" />
        <circle cx={cx} cy={cy} r="12" fill={NOIR} />
        <circle cx={cx} cy={cy} r="8" fill="url(#prevHub)" />
        <circle cx={cx} cy={cy} r="3" fill="#fbf0c8" />
      </motion.svg>

      {/* Flèche dorée (fixe) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10" style={{ marginTop: '-2px' }}>
        <div
          style={{
            width: '18px',
            height: '24px',
            background: 'linear-gradient(135deg, #fbf0c8 0%, #d4af37 50%, #8a6a14 100%)',
            clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))'
          }}
        />
      </div>
    </div>
  )
}
