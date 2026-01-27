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
        w-full py-2 text-center text-[11px] text-[#6B6B70] leading-tight
        ${fixed ? 'fixed bottom-0 left-0 right-0 bg-[#1A1A1E]/80 backdrop-blur-sm z-10' : ''}
        ${className}
      `}
    >
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <span>© 2025 AnimaJet</span>
        <span className="text-[#D4AF37]/40">•</span>
        <a
          href={FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#1877F2] hover:text-[#1877F2]/80 transition-colors"
        >
          <Facebook className="h-3 w-3" />
          Facebook
        </a>
        <span className="text-[#D4AF37]/40">•</span>
        <Link href="/animation-evenementielle-interactive" className="hover:text-[#D4AF37] transition-colors">Événementiel</Link>
        <span className="text-[#D4AF37]/40">|</span>
        <Link href="/animation-mariage-interactive" className="hover:text-[#D4AF37] transition-colors">Mariage</Link>
        <span className="text-[#D4AF37]/40">|</span>
        <Link href="/animation-entreprise-interactive" className="hover:text-[#D4AF37] transition-colors">Entreprise</Link>
        <span className="text-[#D4AF37]/40">|</span>
        <Link href="/animation-dj-interactive" className="hover:text-[#D4AF37] transition-colors">DJ</Link>
        <span className="text-[#D4AF37]/40">•</span>
        <Link href="/mentions-legales" className="hover:text-[#D4AF37] transition-colors">Mentions légales</Link>
        <span className="text-[#D4AF37]/40">|</span>
        <Link href="/cgv" className="hover:text-[#D4AF37] transition-colors">CGV</Link>
        <span className="text-[#D4AF37]/40">|</span>
        <Link href="/confidentialite" className="hover:text-[#D4AF37] transition-colors">Confidentialité</Link>
      </div>
    </footer>
  )
}
