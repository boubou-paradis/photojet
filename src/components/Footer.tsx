// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import Link from 'next/link'
import { Facebook } from 'lucide-react'

interface FooterProps {
  fixed?: boolean
  className?: string
}

const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61585844578617'

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
      {/* Social Links */}
      <div className="flex items-center justify-center gap-3 mb-2">
        <a
          href={FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] rounded-full transition-colors"
        >
          <Facebook className="h-4 w-4" />
          <span className="text-xs font-medium">Facebook</span>
        </a>
      </div>

      <p className="flex items-center justify-center gap-1.5 flex-wrap">
        <span>© 2025 AnimaJet</span>
        <span className="text-[#D4AF37]/40">•</span>
        <span>Créé par MG Events Animation</span>
        <span className="text-[#D4AF37]/40">•</span>
        <span>Tous droits réservés</span>
      </p>
      {/* SEO Pages Links */}
      <p className="flex items-center justify-center gap-2 mt-2 flex-wrap">
        <Link
          href="/animation-evenementielle-interactive"
          className="hover:text-[#D4AF37] transition-colors"
        >
          Animation Événementielle
        </Link>
        <span className="text-[#D4AF37]/40">|</span>
        <Link
          href="/animation-mariage-interactive"
          className="hover:text-[#D4AF37] transition-colors"
        >
          Animation Mariage
        </Link>
        <span className="text-[#D4AF37]/40">|</span>
        <Link
          href="/animation-entreprise-interactive"
          className="hover:text-[#D4AF37] transition-colors"
        >
          Animation Entreprise
        </Link>
        <span className="text-[#D4AF37]/40">|</span>
        <Link
          href="/animation-dj-interactive"
          className="hover:text-[#D4AF37] transition-colors"
        >
          Animation DJ
        </Link>
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
