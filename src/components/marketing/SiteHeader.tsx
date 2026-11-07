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
  { label: 'Blog', href: '/blog' },
]

// Boutons sociaux (page d'accueil uniquement) — mêmes liens et icônes que les anciens boutons flottants,
// en version monochrome cohérente avec le menu (touche dorée au survol)
const SOCIAL_LINKS = [
  {
    label: 'Suivez-nous',
    ariaLabel: 'Page Facebook AnimaJet',
    href: 'https://www.facebook.com/profile.php?id=61585844578617',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    ariaLabel: 'Chaîne YouTube AnimaJet',
    href: 'https://www.youtube.com/channel/UCV4Gm6NsSXyRX8_sU7sPRVQ',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    label: 'Assistance',
    ariaLabel: 'Assistance WhatsApp AnimaJet',
    href: 'https://chat.whatsapp.com/J8SuTrkzsAS0YFMxFhLdC4',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
]

function SocialButtons({ withLabels }: { withLabels: 'always' | 'wide' }) {
  return (
    <>
      {SOCIAL_LINKS.map((s) => (
        <a
          key={s.href}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.ariaLabel}
          title={s.label}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 xl:px-3 whitespace-nowrap rounded-full border border-white/15 bg-white/[0.04] text-gray-300 text-xs font-medium hover:text-[#D4AF37] hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37] transition-colors"
        >
          {s.icon}
          <span className={withLabels === 'always' ? '' : 'hidden xl:inline'}>{s.label}</span>
        </a>
      ))}
    </>
  )
}

/**
 * variant="home" (page d'accueil) : pas de logo, boutons sociaux à gauche, menu centré,
 * conteneur pleine largeur. Les autres pages gardent la variante par défaut.
 */
export default function SiteHeader({ variant = 'default' }: { variant?: 'default' | 'home' } = {}) {
  const home = variant === 'home'
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
      <div className={home ? 'px-4 sm:px-6 lg:px-10 2xl:px-12' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
        <div
          className={
            home
              ? 'flex items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-4 xl:gap-6 h-16 lg:h-[72px]'
              : 'flex items-center justify-between h-16 lg:h-[72px]'
          }
        >
          {home ? (
            /* Boutons sociaux à gauche (ordinateur) ; sur téléphone, ils sont dans le menu déroulant */
            <div className="hidden lg:flex items-center gap-2 justify-self-start">
              <SocialButtons withLabels="wide" />
            </div>
          ) : (
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
          )}
          {home && <div aria-hidden="true" className="lg:hidden" />}

          {/* Nav desktop */}
          <nav className={home ? 'hidden lg:flex items-center gap-4 xl:gap-5 2xl:gap-7 whitespace-nowrap' : 'hidden lg:flex items-center gap-7'}>
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
          <div className={home ? 'hidden lg:flex items-center gap-3 justify-self-end whitespace-nowrap' : 'hidden lg:flex items-center gap-3'}>
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
            {home && (
              <div className="flex flex-wrap items-center gap-2 px-3 pb-3 mb-1 border-b border-white/10">
                <SocialButtons withLabels="always" />
              </div>
            )}
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
