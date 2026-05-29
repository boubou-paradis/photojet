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
const WHATSAPP_URL = 'https://chat.whatsapp.com/J8SuTrkzsAS0YFMxFhLdC4'

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
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#25D366] hover:text-[#1ebe5d] transition-colors"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Assistance
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
