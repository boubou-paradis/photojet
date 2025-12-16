'use client'

import { Rocket } from 'lucide-react'

interface FooterProps {
  fixed?: boolean
  className?: string
}

export default function Footer({ fixed = false, className = '' }: FooterProps) {
  return (
    <footer
      className={`
        w-full py-3 text-center text-xs sm:text-sm
        text-[#6B6B70] hover:text-[#D4AF37]/80
        transition-colors duration-300
        ${fixed ? 'fixed bottom-0 left-0 right-0 bg-[#1A1A1E]/80 backdrop-blur-sm z-10' : ''}
        ${className}
      `}
    >
      <p className="flex items-center justify-center gap-1.5">
        <span>© 2025 AnimaJet</span>
        <span className="text-[#D4AF37]/40">•</span>
        <span className="inline-flex items-center gap-1">
          Créé avec <Rocket className="h-3 w-3 text-[#D4AF37]/60" /> par Guillaume Morel
        </span>
        <span className="text-[#D4AF37]/40">•</span>
        <span>Tous droits réservés</span>
      </p>
    </footer>
  )
}
