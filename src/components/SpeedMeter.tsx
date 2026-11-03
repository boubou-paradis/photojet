'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Wifi } from 'lucide-react'

interface SpeedMeterProps {
  className?: string
}

type ConnectionQuality = 'poor' | 'medium' | 'good' | 'excellent'

// Échelle non linéaire : graduations régulièrement espacées sur l'arc, pour que
// les débits courants (2 à 25 Mbps) occupent l'essentiel du cadran.
// Seuils adaptés à l'usage AnimaJet (envoi de photos, diaporama, jeux en direct).
const SCALE_TICKS = [0, 2, 5, 10, 25, 50, 100]
const POOR_BELOW = 2
const MEDIUM_BELOW = 5
const EXCELLENT_FROM = 25

/** Position d'un débit sur l'arc, de 0 (gauche) à 1 (droite). */
function scalePosition(speedValue: number): number {
  const last = SCALE_TICKS.length - 1
  if (speedValue <= 0) return 0
  if (speedValue >= SCALE_TICKS[last]) return 1
  for (let i = 0; i < last; i++) {
    const lo = SCALE_TICKS[i], hi = SCALE_TICKS[i + 1]
    if (speedValue <= hi) return (i + (speedValue - lo) / (hi - lo)) / last
  }
  return 1
}

/** Point de l'arc (centre 100,100) pour une position 0..1 et un rayon. */
function arcPoint(position: number, radius: number): { x: number; y: number } {
  const rad = Math.PI * (1 - position)
  return { x: 100 + radius * Math.cos(rad), y: 100 - radius * Math.sin(rad) }
}

function arcPath(from: number, to: number, radius = 80): string {
  const a = arcPoint(from, radius), b = arcPoint(to, radius)
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${radius} ${radius} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

export default function SpeedMeter({ className = '' }: SpeedMeterProps) {
  const [speed, setSpeed] = useState<number | null>(null)
  const [ping, setPing] = useState<number | null>(null)
  const [testing, setTesting] = useState(false)

  const measureSpeed = useCallback(async () => {
    setTesting(true)
    try {
      // Measure ping first
      const pingStart = performance.now()
      await fetch('/api/speedtest', { method: 'HEAD', cache: 'no-store' })
      const pingEnd = performance.now()
      setPing(Math.round(pingEnd - pingStart))

      // Measure download speed
      const startTime = performance.now()
      const response = await fetch('/api/speedtest?t=' + Date.now(), { cache: 'no-store' })
      const blob = await response.blob()
      const endTime = performance.now()

      const durationSeconds = (endTime - startTime) / 1000
      const fileSizeInBits = blob.size * 8
      const speedMbps = fileSizeInBits / durationSeconds / 1024 / 1024

      setSpeed(Math.round(speedMbps * 10) / 10)
    } catch (error) {
      console.error('Speed test error:', error)
      setSpeed(0)
    } finally {
      setTesting(false)
    }
  }, [])

  // Initial test and periodic refresh
  useEffect(() => {
    measureSpeed()
    const interval = setInterval(measureSpeed, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [measureSpeed])

  const getQuality = (speedValue: number): ConnectionQuality => {
    if (speedValue < POOR_BELOW) return 'poor'
    if (speedValue < MEDIUM_BELOW) return 'medium'
    if (speedValue < EXCELLENT_FROM) return 'good'
    return 'excellent'
  }

  const quality = speed !== null ? getQuality(speed) : null

  const qualityConfig = {
    poor: { label: 'Faible', color: '#E53935' },
    medium: { label: 'Moyenne', color: '#FF9800' },
    good: { label: 'Bonne', color: '#4CAF50' },
    excellent: { label: 'Excellente', color: '#4CAF50' },
  }

  // Aiguille : -90° (gauche) à +90° (droite) selon l'échelle non linéaire
  const needleAngle = -90 + scalePosition(speed || 0) * 180
  const poorEnd = scalePosition(POOR_BELOW)
  const mediumEnd = scalePosition(MEDIUM_BELOW)
  const lastTick = SCALE_TICKS.length - 1

  return (
    <div className={`card-gold rounded-xl ${className}`}>
      <div className="px-2.5 py-1.5 border-b border-[rgba(255,255,255,0.1)] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Wifi className="h-3.5 w-3.5 text-[#D4AF37]" />
          <span className="text-xs font-semibold text-white">Connexion</span>
        </div>
        <button
          onClick={measureSpeed}
          disabled={testing}
          className="p-1 rounded-lg hover:bg-[#2E2E33] transition-colors disabled:opacity-50"
          title="Tester la connexion"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-[#D4AF37] ${testing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-2 flex items-center gap-3">
        {/* Cadran compact à gauche */}
        <div className="relative flex-shrink-0" style={{ width: 116, height: 63 }}>
          <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F4D03F" />
                <stop offset="50%" stopColor="#D4AF37" />
                <stop offset="100%" stopColor="#B8960C" />
              </linearGradient>
              <linearGradient id="needleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F4D03F" />
                <stop offset="100%" stopColor="#B8960C" />
              </linearGradient>
              <filter id="needleShadow">
                <feDropShadow dx="1" dy="1" stdDeviation="1" floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Background arc - center at (100, 100) */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#2E2E33"
              strokeWidth="18"
              strokeLinecap="round"
            />

            {/* Zones : rouge < 2 Mbps, orange 2-5 Mbps, vert ≥ 5 Mbps */}
            <path d={arcPath(0, poorEnd)} fill="none" stroke="#E53935" strokeWidth="14" strokeLinecap="round" opacity="0.85" />
            <path d={arcPath(poorEnd, mediumEnd)} fill="none" stroke="#FF9800" strokeWidth="14" opacity="0.85" />
            <path d={arcPath(mediumEnd, 1)} fill="none" stroke="#4CAF50" strokeWidth="14" strokeLinecap="round" opacity="0.85" />

            {/* Outer decorative border */}
            <path
              d="M 8 100 A 92 92 0 0 1 192 100"
              fill="none"
              stroke="url(#goldGradient)"
              strokeWidth="2"
              opacity="0.5"
            />

            {/* Tick marks and labels */}
            {SCALE_TICKS.map((value, i) => {
              const rad = Math.PI * (1 - i / lastTick)
              const cx = 100
              const cy = 100
              const innerR = 58
              const outerR = 68
              const labelR = 48

              const x1 = cx + innerR * Math.cos(rad)
              const y1 = cy - innerR * Math.sin(rad)
              const x2 = cx + outerR * Math.cos(rad)
              const y2 = cy - outerR * Math.sin(rad)
              const labelX = cx + labelR * Math.cos(rad)
              const labelY = cy - labelR * Math.sin(rad)

              return (
                <g key={value}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#D4AF37"
                    strokeWidth="2"
                    opacity="0.8"
                  />
                  <text
                    x={labelX}
                    y={labelY + 3}
                    textAnchor="middle"
                    fill="#B0B0B5"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    {value}
                  </text>
                </g>
              )
            })}

            {/* Minor tick marks */}
            {SCALE_TICKS.slice(1).map((value, i) => {
              const rad = Math.PI * (1 - (i + 0.5) / lastTick)
              const cx = 100
              const cy = 100
              const innerR = 62
              const outerR = 68

              const x1 = cx + innerR * Math.cos(rad)
              const y1 = cy - innerR * Math.sin(rad)
              const x2 = cx + outerR * Math.cos(rad)
              const y2 = cy - outerR * Math.sin(rad)

              return (
                <line
                  key={value}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#D4AF37"
                  strokeWidth="1"
                  opacity="0.4"
                />
              )
            })}

            {/* Needle - pivots around center (100, 100) */}
            <g filter="url(#needleShadow)">
              <polygon
                points="100,25 96,95 100,100 104,95"
                fill="url(#needleGradient)"
                style={{
                  transform: `rotate(${needleAngle}deg)`,
                  transformOrigin: '100px 100px',
                  transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </g>

            {/* Center cap */}
            <circle cx="100" cy="100" r="10" fill="#1A1A1E" stroke="url(#goldGradient)" strokeWidth="3" />
            <circle cx="100" cy="100" r="5" fill="url(#goldGradient)" />
          </svg>
        </div>

        {/* Débit, qualité et ping à droite */}
        <div className="flex-1 min-w-0 flex flex-col items-center">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1E] rounded-lg border border-[rgba(255,255,255,0.1)]">
            {testing ? (
              <span className="text-lg font-mono text-[#D4AF37] animate-pulse">--.-</span>
            ) : (
              <span className="text-lg font-mono text-[#D4AF37] font-bold">
                {speed !== null ? speed.toFixed(1) : '--.-'}
              </span>
            )}
            <span className="text-[10px] text-[#6B6B70]">Mbps</span>
          </div>
        </div>

        {/* Quality indicator and ping in one row */}
        <div className="flex items-center justify-center gap-3 mt-1.5">
          {quality && !testing && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: qualityConfig[quality].color }}
              />
              <span className="text-[10px]" style={{ color: qualityConfig[quality].color }}>
                {qualityConfig[quality].label}
              </span>
            </div>
          )}
          {ping !== null && !testing && (
            <span className="text-[10px] text-[#6B6B70]">
              {ping}ms
            </span>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
