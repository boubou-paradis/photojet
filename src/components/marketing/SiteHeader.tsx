// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, ArrowRight } from 'lucide-react'

// Liens d'ancre absolus (préfixés "/") pour fonctionner depuis n'importe quelle page.
const NAV_LINKS = [
  { label: 'Fonctionnalités', href: '/fonctionnalites' },
  { label: 'Comment ça marche', href: '/#how-it-works' },
  { label: 'Pour qui ?', href: '/#pour-qui' },
  { label: 'Tarifs', href: '/#pricing' },
  { label: 'Histoire', href: '/#histoire' },
]

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-300 ${
        scrolled
          ? 'bg-[#0D0D0F]/90 backdrop-blur-md border-b border-[#D4AF37]/15 shadow-[0_4px_24px_rgba(0,0,0,0.4)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-[72px]">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0" aria-label="Accueil AnimaJet">
            <Image
              src="/images/animajet_logo_horizontal.png"
              alt="AnimaJet"
              width={150}
              height={36}
              className="h-8 lg:h-9 w-auto"
              priority
            />
          </Link>

          {/* Nav desktop */}
          <nav className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-300 hover:text-[#D4AF37] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA desktop */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href="/#essai"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] text-[#0D0D0F] text-sm font-bold hover:brightness-110 shadow-[0_4px_16px_rgba(212,175,55,0.25)] transition-all"
            >
              Essai gratuit
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Burger mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg text-white hover:bg-white/10 transition-colors"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {mobileOpen && (
        <div className="lg:hidden bg-[#0D0D0F]/97 backdrop-blur-lg border-t border-[#D4AF37]/15">
          <nav className="flex flex-col px-4 py-4 gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-3 rounded-lg text-base font-medium text-gray-200 hover:bg-white/5 hover:text-[#D4AF37] transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="h-px bg-white/10 my-2" />
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 rounded-lg text-base font-medium text-gray-200 hover:bg-white/5 transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href="/#essai"
              onClick={() => setMobileOpen(false)}
              className="mt-1 inline-flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] text-[#0D0D0F] text-base font-bold shadow-[0_4px_16px_rgba(212,175,55,0.25)]"
            >
              Essai gratuit 24h
              <ArrowRight className="h-5 w-5" />
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
