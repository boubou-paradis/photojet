'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

interface AnimaJetLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  showIcon?: boolean
  animated?: boolean
  className?: string
  variant?: 'icon' | 'horizontal' | 'full'
}

const sizes = {
  sm: { icon: 36, horizontal: 120, text: 'text-lg' },
  md: { icon: 48, horizontal: 160, text: 'text-xl' },
  lg: { icon: 56, horizontal: 200, text: 'text-2xl' },
  xl: { icon: 80, horizontal: 280, text: 'text-4xl' },
}

// Simplified rocket icon SVG
export function RocketIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id="rocketGold" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#B8960C" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#F4D03F" />
        </linearGradient>
      </defs>
      {/* Rocket body */}
      <path
        d="M12 2C12 2 8 6 8 12V18L10 20V16H14V20L16 18V12C16 6 12 2 12 2Z"
        fill="url(#rocketGold)"
      />
      {/* Window */}
      <circle cx="12" cy="10" r="2" fill="#1A1A1E" />
      {/* Flames */}
      <path
        d="M10 20L11 23L12 21L13 23L14 20"
        stroke="#F4D03F"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Left fin */}
      <path d="M8 14L5 17L8 16V14Z" fill="url(#rocketGold)" />
      {/* Right fin */}
      <path d="M16 14L19 17L16 16V14Z" fill="url(#rocketGold)" />
    </svg>
  )
}

// Simplified shutter/aperture icon SVG
export function ShutterIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id="shutterGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F4D03F" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#B8960C" />
        </linearGradient>
      </defs>
      {/* Outer circle */}
      <circle cx="12" cy="12" r="10" stroke="url(#shutterGold)" strokeWidth="2" fill="none" />
      {/* Shutter blades */}
      <path d="M12 2 L14 8 L12 7 L10 8 Z" fill="url(#shutterGold)" />
      <path d="M20.5 7 L16 11 L16 9 L17 7 Z" fill="url(#shutterGold)" />
      <path d="M20.5 17 L14 14 L16 13 L17 15 Z" fill="url(#shutterGold)" />
      <path d="M12 22 L10 16 L12 17 L14 16 Z" fill="url(#shutterGold)" />
      <path d="M3.5 17 L8 13 L8 15 L7 17 Z" fill="url(#shutterGold)" />
      <path d="M3.5 7 L10 10 L8 11 L7 9 Z" fill="url(#shutterGold)" />
      {/* Inner circle */}
      <circle cx="12" cy="12" r="3" fill="#1A1A1E" stroke="url(#shutterGold)" strokeWidth="1" />
    </svg>
  )
}

// Combined AnimaJet icon (rocket + shutter)
export function AnimaJetIcon({ size = 40, animated = false, className = '' }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Shutter background */}
      <div className={`absolute inset-0 ${animated ? 'spin-slow' : ''}`}>
        <ShutterIcon size={size} />
      </div>
      {/* Rocket overlay */}
      <div className={`absolute inset-0 flex items-center justify-center ${animated ? 'rocket-launch' : ''}`}>
        <RocketIcon size={size * 0.5} />
      </div>
    </div>
  )
}

// Main logo component - Now uses PNG images by default
export default function AnimaJetLogo({
  size = 'md',
  showText = true,
  showIcon = true,
  animated = false,
  className = '',
  variant = 'horizontal',
}: AnimaJetLogoProps) {
  const { icon: iconSize, horizontal: horizontalWidth } = sizes[size]

  // Use horizontal logo image for header/navbar
  if (variant === 'horizontal') {
    return (
      <motion.div
        initial={animated ? { opacity: 0, x: -20 } : false}
        animate={animated ? { opacity: 1, x: 0 } : false}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className={className}
      >
        <Image
          src="/images/animajet_logo_horizontal.png"
          alt="AnimaJet"
          width={horizontalWidth}
          height={Math.round(horizontalWidth * 0.35)}
          className="object-contain"
          priority
        />
      </motion.div>
    )
  }

  // Use principal logo (square) for icon variant
  if (variant === 'icon' || variant === 'full') {
    return (
      <motion.div
        initial={animated ? { scale: 0, opacity: 0 } : false}
        animate={animated ? { scale: 1, opacity: 1 } : false}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className={className}
      >
        <Image
          src="/images/animajet_logo_principal.png"
          alt="AnimaJet"
          width={iconSize}
          height={iconSize}
          className="object-contain"
          priority
        />
      </motion.div>
    )
  }

  // Legacy SVG-based logo (fallback)
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && (
        <motion.div
          initial={animated ? { scale: 0, rotate: -180 } : false}
          animate={animated ? { scale: 1, rotate: 0 } : false}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <AnimaJetIcon size={iconSize} animated={animated} />
        </motion.div>
      )}
      {showText && (
        <motion.div
          initial={animated ? { opacity: 0, x: -20 } : false}
          animate={animated ? { opacity: 1, x: 0 } : false}
          transition={{ delay: 0.2 }}
          className={`font-heading font-bold ${sizes[size].text}`}
        >
          <span className="text-white">Anima</span>
          <span className="text-gold-gradient">Jet</span>
        </motion.div>
      )}
    </div>
  )
}

// Full logo with image (for pages that need the principal/square logo)
export function AnimaJetFullLogo({
  size = 100,
  animated = false,
  className = '',
}: {
  size?: number
  animated?: boolean
  className?: string
}) {
  return (
    <motion.div
      initial={animated ? { scale: 0, opacity: 0 } : false}
      animate={animated ? { scale: 1, opacity: 1 } : false}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className={`relative ${className}`}
    >
      <Image
        src="/images/animajet_logo_principal.png"
        alt="AnimaJet"
        width={size}
        height={size}
        className={`drop-shadow-lg ${animated ? 'float' : ''}`}
        priority
      />
    </motion.div>
  )
}

// Horizontal logo for headers (wider aspect ratio)
export function AnimaJetHorizontalLogo({
  width = 180,
  animated = false,
  className = '',
}: {
  width?: number
  animated?: boolean
  className?: string
}) {
  return (
    <motion.div
      initial={animated ? { opacity: 0, x: -20 } : false}
      animate={animated ? { opacity: 1, x: 0 } : false}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className={className}
    >
      <Image
        src="/images/animajet_logo_horizontal.png"
        alt="AnimaJet"
        width={width}
        height={Math.round(width * 0.35)}
        className="object-contain"
        priority
      />
    </motion.div>
  )
}

// Loading spinner with AnimaJet branding
export function AnimaJetLoader({ size = 60 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        <ShutterIcon size={size} />
      </motion.div>
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="font-heading font-bold text-lg"
      >
        <span className="text-white">Anima</span>
        <span className="text-gold-gradient">Jet</span>
      </motion.div>
    </div>
  )
}
