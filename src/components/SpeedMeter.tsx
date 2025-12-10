'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Wifi } from 'lucide-react'

interface SpeedMeterProps {
  className?: string
}

type ConnectionQuality = 'poor' | 'medium' | 'excellent'

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
    if (speedValue < 10) return 'poor'
    if (speedValue < 30) return 'medium'
    return 'excellent'
  }

  const quality = speed !== null ? getQuality(speed) : null

  const qualityConfig = {
    poor: { label: 'Faible', color: '#E53935' },
    medium: { label: 'Moyenne', color: '#FF9800' },
    excellent: { label: 'Excellente', color: '#4CAF50' },
  }

  // Calculate needle angle
  // 0 Mbps = -90° (pointing left), 100 Mbps = +90° (pointing right)
  const maxSpeed = 100
  const clampedSpeed = Math.min(speed || 0, maxSpeed)
  const needleAngle = -90 + (clampedSpeed / maxSpeed) * 180

  return (
    <div className={`card-gold rounded-xl ${className}`}>
      <div className="p-3 border-b border-[rgba(255,255,255,0.1)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
            <Wifi className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <span className="text-sm font-medium text-white">Connexion</span>
        </div>
        <button
          onClick={measureSpeed}
          disabled={testing}
          className="p-1.5 rounded-lg hover:bg-[#2E2E33] transition-colors disabled:opacity-50"
          title="Tester la connexion"
        >
          <RefreshCw className={`h-4 w-4 text-[#D4AF37] ${testing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4">
        {/* Vintage Meter */}
        <div className="relative mx-auto" style={{ width: 180, height: 100 }}>
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

            {/* Red zone (0-10 Mbps) - 0° to 18° of 180° arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 35.1 58.8"
              fill="none"
              stroke="#E53935"
              strokeWidth="14"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Orange zone (10-30 Mbps) - 18° to 54° of 180° arc */}
            <path
              d="M 35.1 58.8 A 80 80 0 0 1 76.1 27.0"
              fill="none"
              stroke="#FF9800"
              strokeWidth="14"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Green zone (30-100 Mbps) - 54° to 180° of 180° arc */}
            <path
              d="M 76.1 27.0 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#4CAF50"
              strokeWidth="14"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Outer decorative border */}
            <path
              d="M 8 100 A 92 92 0 0 1 192 100"
              fill="none"
              stroke="url(#goldGradient)"
              strokeWidth="2"
              opacity="0.5"
            />

            {/* Tick marks and labels */}
            {[0, 25, 50, 75, 100].map((value) => {
              // Angle: 0 Mbps = 180° (left), 100 Mbps = 0° (right)
              const tickAngle = 180 - (value / 100) * 180
              const rad = (tickAngle * Math.PI) / 180
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
                    fontSize="9"
                    fontWeight="bold"
                  >
                    {value}
                  </text>
                </g>
              )
            })}

            {/* Minor tick marks */}
            {[12.5, 37.5, 62.5, 87.5].map((value) => {
              const tickAngle = 180 - (value / 100) * 180
              const rad = (tickAngle * Math.PI) / 180
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

        {/* Digital display */}
        <div className="text-center mt-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1E] rounded-lg border border-[rgba(255,255,255,0.1)]">
            {testing ? (
              <span className="text-xl font-mono text-[#D4AF37] animate-pulse">--.-</span>
            ) : (
              <span className="text-xl font-mono text-[#D4AF37] font-bold">
                {speed !== null ? speed.toFixed(1) : '--.-'}
              </span>
            )}
            <span className="text-xs text-[#6B6B70]">Mbps</span>
          </div>
        </div>

        {/* Quality indicator */}
        {quality && !testing && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: qualityConfig[quality].color }}
            />
            <span className="text-xs" style={{ color: qualityConfig[quality].color }}>
              Connexion {qualityConfig[quality].label.toLowerCase()}
            </span>
          </div>
        )}

        {/* Ping display */}
        {ping !== null && !testing && (
          <div className="text-center mt-2">
            <span className="text-[10px] text-[#6B6B70]">
              Latence : <span className="text-[#B0B0B5]">{ping} ms</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
