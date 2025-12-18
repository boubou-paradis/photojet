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

// Ampoules autour du cadre
const BULBS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  angle: (i * 360 / 24 - 90) * (Math.PI / 180),
}))

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
    const cx = 200, cy = 200, r = 150, count = segments.length
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

  const frameSize = size * 1.15

  return (
    <div className="relative" style={{ width: frameSize, height: frameSize }}>
      {/* Fond violet */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(135deg, #4A1F6E 0%, #2D1B4E 100%)',
          boxShadow: '0 0 30px rgba(139,0,0,0.3)'
        }}
      />

      {/* Cadre rouge avec ampoules */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(135deg, #B22222 0%, #8B0000 50%, #5C0000 100%)',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
        }}
      >
        {/* Ampoules */}
        {BULBS.map((bulb, i) => {
          const x = 50 + 46 * Math.cos(bulb.angle)
          const y = 50 + 46 * Math.sin(bulb.angle)
          const isLit = (i + bulbPhase) % 2 === 0
          return (
            <div
              key={bulb.id}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                background: isLit
                  ? 'radial-gradient(circle, #FFFF00 0%, #FFD700 50%, #FFA500 100%)'
                  : 'radial-gradient(circle, #8B7500 0%, #5C4000 100%)',
                boxShadow: isLit
                  ? '0 0 8px #FFD700, 0 0 15px #FFA500'
                  : 'none',
              }}
            />
          )
        })}
      </div>

      {/* Flèche dorée */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 translate-y-1 z-20">
        <div
          className="w-5 h-6"
          style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 50%, #8B7500 100%)',
            clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
          }}
        />
      </div>

      {/* Roue SVG */}
      <motion.svg
        className="absolute"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: size * 0.82,
          height: size * 0.82
        }}
        viewBox="0 0 400 400"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
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
          <filter id="previewGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Bordure dorée */}
        <circle cx="200" cy="200" r="195" fill="none" stroke="#1a1a1a" strokeWidth="3" />
        <circle cx="200" cy="200" r="190" fill="none" stroke="url(#previewGoldGradient)" strokeWidth="8" filter="url(#previewGlow)" />
        <circle cx="200" cy="200" r="183" fill="none" stroke="#1a1a1a" strokeWidth="3" />

        {/* Segments */}
        {wheelSegments.map((seg) => (
          <g key={seg.id}>
            <path d={seg.pathData} fill={seg.color} stroke="#1A1A1E" strokeWidth="2" />
            <text
              x={seg.textX}
              y={seg.textY}
              fill={seg.color === '#E8E8E8' ? '#1A1A1E' : 'white'}
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${seg.textRotation}, ${seg.textX}, ${seg.textY})`}
              style={{
                textShadow: seg.color === '#E8E8E8' ? 'none' : '1px 1px 2px rgba(0,0,0,0.9)',
                fontFamily: 'Arial Black, sans-serif'
              }}
            >
              {seg.text.length > 10 ? seg.text.substring(0, 10) + '...' : seg.text}
            </text>
          </g>
        ))}

        {/* Centre doré 3D */}
        <circle cx="200" cy="200" r="45" fill="#1a1a1a" />
        <circle cx="200" cy="200" r="40" fill="url(#previewCenterGradient)" filter="url(#previewGlow)" />
        <ellipse cx="192" cy="188" rx="18" ry="10" fill="rgba(255,255,255,0.3)" />
        <circle cx="200" cy="200" r="22" fill="#1a1a1a" />
        <circle cx="200" cy="200" r="17" fill="url(#previewCenterGradient)" />
        <ellipse cx="195" cy="194" rx="8" ry="5" fill="rgba(255,255,255,0.25)" />
        <circle cx="200" cy="200" r="6" fill="#1a1a1a" />
        <circle cx="200" cy="200" r="4" fill="#D4AF37" />
      </motion.svg>

      {/* Socle rouge en bas */}
      <div
        className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-20 h-6"
        style={{
          background: 'linear-gradient(to bottom, #8B0000 0%, #5C0000 50%, #3D0000 100%)',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.4)'
        }}
      />
    </div>
  )
}
