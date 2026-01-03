'use client'

import Link from 'next/link'

interface FooterProps {
  fixed?: boolean
  className?: string
}

export default function Footer({ fixed = false, className = '' }: FooterProps) {
  return (
    <footer
      className={`
        w-full py-3 text-center text-xs sm:text-sm
        text-[#6B6B70]
        transition-colors duration-300
        ${fixed ? 'fixed bottom-0 left-0 right-0 bg-[#1A1A1E]/80 backdrop-blur-sm z-10' : ''}
        ${className}
      `}
    >
      <p className="flex items-center justify-center gap-1.5 flex-wrap">
        <span>© 2025 AnimaJet</span>
        <span className="text-[#D4AF37]/40">•</span>
        <span>Créé par MG Events Animation</span>
        <span className="text-[#D4AF37]/40">•</span>
        <span>Tous droits réservés</span>
      </p>
      <p className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
        <Link
          href="/mentions-legales"
          className="hover:text-[#D4AF37] transition-colors"
        >
          Mentions légales
        </Link>
        <span className="text-[#D4AF37]/40">|</span>
        <Link
          href="/cgv"
          className="hover:text-[#D4AF37] transition-colors"
        >
          CGV
        </Link>
        <span className="text-[#D4AF37]/40">|</span>
        <Link
          href="/confidentialite"
          className="hover:text-[#D4AF37] transition-colors"
        >
          Politique de confidentialité
        </Link>
      </p>
    </footer>
  )
}
