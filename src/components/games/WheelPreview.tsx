'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { WheelSegment } from '@/types/database'

interface WheelPreviewProps {
  segments: WheelSegment[]
  size?: number
}

export default function WheelPreview({ segments, size = 280 }: WheelPreviewProps) {
  const wheelSegments = useMemo(() => {
    const cx = 200, cy = 200, r = 170, count = segments.length
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
      return { id: segment.id, pathData, color: segment.color, text: segment.text, textX, textY, textRotation }
    })
  }, [segments])

  if (segments.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-[#1A1A1E] border-4 border-[#D4AF37]/30"
        style={{ width: size, height: size }}
      >
        <p className="text-gray-500 text-sm text-center px-4">
          Ajoutez au moins<br />2 segments
        </p>
      </div>
    )
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Flèche */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
        <div
          className="w-6 h-8"
          style={{
            background: 'linear-gradient(to bottom, #F4D03F, #D4AF37)',
            clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
          }}
        />
      </div>

      {/* Roue SVG */}
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 400 400"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <defs>
          <linearGradient id="previewGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F4D03F" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#B8960C" />
          </linearGradient>
          <radialGradient id="previewCenterGradient" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#F4D03F" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#8B7500" />
          </radialGradient>
        </defs>

        {/* Bordure dorée */}
        <circle cx="200" cy="200" r="198" fill="none" stroke="#1a1a1a" strokeWidth="4" />
        <circle cx="200" cy="200" r="192" fill="none" stroke="url(#previewGoldGradient)" strokeWidth="8" />
        <circle cx="200" cy="200" r="186" fill="none" stroke="#0a0a0a" strokeWidth="4" />

        {/* Segments */}
        {wheelSegments.map((seg) => (
          <g key={seg.id}>
            <path d={seg.pathData} fill={seg.color} stroke="#1A1A1E" strokeWidth="2" />
            <text
              x={seg.textX}
              y={seg.textY}
              fill="white"
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${seg.textRotation}, ${seg.textX}, ${seg.textY})`}
              style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.9)', fontFamily: 'Arial Black, sans-serif' }}
            >
              {seg.text.length > 10 ? seg.text.substring(0, 10) + '...' : seg.text}
            </text>
          </g>
        ))}

        {/* Centre */}
        <circle cx="200" cy="200" r="35" fill="#1a1a1a" />
        <circle cx="200" cy="200" r="30" fill="url(#previewCenterGradient)" />
        <circle cx="200" cy="200" r="15" fill="#1a1a1a" />
        <circle cx="200" cy="200" r="10" fill="url(#previewCenterGradient)" />
      </motion.svg>
    </div>
  )
}
