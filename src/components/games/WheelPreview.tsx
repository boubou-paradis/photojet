'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { WheelSegment } from '@/types/database'

interface WheelPreviewProps {
  segments: WheelSegment[]
  size?: number
}

// Couleurs casino alternées: bordeaux, orange, bleu royal, argenté
const CASINO_COLORS = ['#8B0000', '#FF8C00', '#1E40AF', '#E8E8E8']

export default function WheelPreview({ segments, size = 280 }: WheelPreviewProps) {
  const [bulbPhase, setBulbPhase] = useState(0)

  // Animation des ampoules
  useEffect(() => {
    const interval = setInterval(() => {
      setBulbPhase(prev => (prev + 1) % 4)
    }, 400)
    return () => clearInterval(interval)
  }, [])

  const wheelSegments = useMemo(() => {
    const cx = 200, cy = 200, r = 140, count = segments.length
    if (count === 0) return []
    const anglePerSegment = (2 * Math.PI) / count
    return segments.map((segment, index) => {
      const startAngle = index * anglePerSegment - Math.PI / 2
      const endAngle = startAngle + anglePerSegment
      const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle)
      const largeArcFlag = anglePerSegment > Math.PI ? 1 : 0
      const pathData = [`M ${cx} ${cy}`, `L ${x1} ${y1}`, `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`, 'Z'].join(' ')
      const textAngle = startAngle + anglePerSegment / 2
      const textRadius = r * 0.6
      const textX = cx + textRadius * Math.cos(textAngle)
      const textY = cy + textRadius * Math.sin(textAngle)
      const textRotation = (textAngle * 180) / Math.PI + 90
      // Utiliser les couleurs casino alternées
      const casinoColor = CASINO_COLORS[index % CASINO_COLORS.length]
      return { id: segment.id, pathData, color: casinoColor, text: segment.text, textX, textY, textRotation }
    })
  }, [segments])

  // Générer les ampoules (24 autour du cadre)
  const bulbs = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i * 360 / 24 - 90) * (Math.PI / 180)
      const r = 185 // Rayon pour les ampoules sur le cadre rouge
      const x = 200 + r * Math.cos(angle)
      const y = 200 + r * Math.sin(angle)
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
          background: 'linear-gradient(135deg, #4A1F6E 0%, #2D1B4E 100%)',
          border: '4px solid #8B0000'
        }}
      >
        <p className="text-gray-400 text-sm text-center px-4">
          Ajoutez au moins<br />2 segments
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* SVG unique contenant tout */}
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 400 400"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="drop-shadow-xl"
      >
        <defs>
          <linearGradient id="previewGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#B8960C" />
          </linearGradient>
          <radialGradient id="previewCenterGradient" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="40%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#8B7500" />
          </radialGradient>
          <radialGradient id="previewRedFrame" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#8B0000" />
            <stop offset="85%" stopColor="#5C0000" />
            <stop offset="100%" stopColor="#3D0000" />
          </radialGradient>
          <filter id="previewGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="bulbGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Cadre rouge extérieur */}
        <circle cx="200" cy="200" r="198" fill="url(#previewRedFrame)" />
        <circle cx="200" cy="200" r="198" fill="none" stroke="#5C0000" strokeWidth="2" />

        {/* Ampoules sur le cadre rouge */}
        {bulbs.map((bulb) => (
          <circle
            key={bulb.id}
            cx={bulb.x}
            cy={bulb.y}
            r="6"
            fill={bulb.isLit ? '#FFD700' : '#5C4000'}
            filter={bulb.isLit ? 'url(#bulbGlow)' : undefined}
          />
        ))}

        {/* Bordure dorée intérieure */}
        <circle cx="200" cy="200" r="168" fill="none" stroke="#1a1a1a" strokeWidth="3" />
        <circle cx="200" cy="200" r="163" fill="none" stroke="url(#previewGoldGradient)" strokeWidth="6" filter="url(#previewGlow)" />
        <circle cx="200" cy="200" r="158" fill="none" stroke="#1a1a1a" strokeWidth="2" />

        {/* Fond de la roue */}
        <circle cx="200" cy="200" r="155" fill="#1a1a1a" />

        {/* Segments de la roue */}
        {wheelSegments.map((seg) => (
          <g key={seg.id}>
            <path d={seg.pathData} fill={seg.color} stroke="#1A1A1E" strokeWidth="2" />
            <text
              x={seg.textX}
              y={seg.textY}
              fill={seg.color === '#E8E8E8' ? '#1A1A1E' : 'white'}
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${seg.textRotation}, ${seg.textX}, ${seg.textY})`}
              style={{
                fontFamily: 'Arial Black, sans-serif'
              }}
            >
              {seg.text.length > 8 ? seg.text.substring(0, 8) + '..' : seg.text}
            </text>
          </g>
        ))}

        {/* Centre doré 3D */}
        <circle cx="200" cy="200" r="35" fill="#1a1a1a" />
        <circle cx="200" cy="200" r="30" fill="url(#previewCenterGradient)" filter="url(#previewGlow)" />
        <ellipse cx="193" cy="190" rx="14" ry="8" fill="rgba(255,255,255,0.3)" />
        <circle cx="200" cy="200" r="16" fill="#1a1a1a" />
        <circle cx="200" cy="200" r="12" fill="url(#previewCenterGradient)" />
        <ellipse cx="196" cy="196" rx="6" ry="4" fill="rgba(255,255,255,0.25)" />
        <circle cx="200" cy="200" r="4" fill="#1a1a1a" />
        <circle cx="200" cy="200" r="2" fill="#D4AF37" />
      </motion.svg>

      {/* Flèche dorée (fixe, ne tourne pas) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10" style={{ marginTop: '-4px' }}>
        <div
          style={{
            width: '20px',
            height: '28px',
            background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 50%, #8B7500 100%)',
            clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))'
          }}
        />
      </div>
    </div>
  )
}
