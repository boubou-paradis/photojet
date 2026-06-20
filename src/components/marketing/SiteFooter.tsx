// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Facebook } from 'lucide-react'

const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61585844578617'
const WHATSAPP_URL = 'https://chat.whatsapp.com/J8SuTrkzsAS0YFMxFhLdC4'

const animations = [
  { label: 'Quiz interactif', href: '/quiz-interactif' },
  { label: 'Blind test musical', href: '/blind-test-musical' },
  { label: 'Roue de la Destinée', href: '/roue-de-la-destinee' },
  { label: 'Photo Mystère', href: '/photo-mystere' },
  { label: 'Le Bon Ordre', href: '/le-bon-ordre' },
  { label: 'Partage photo en direct', href: '/partage-photo-evenement' },
  { label: 'Impression photo sur place', href: '/impression-photo-evenement' },
  { label: 'Diaporama live', href: '/diaporama-live-evenement' },
  { label: 'Borne photo', href: '/borne-photo' },
]

const segments = [
  { label: 'DJ & animateurs', href: '/animation-dj-interactive' },
  { label: 'Logiciel DJ mariage', href: '/logiciel-dj-mariage' },
  { label: 'Logiciel animateur', href: '/logiciel-animateur-evenement' },
  { label: 'Entreprises', href: '/animation-entreprise-interactive' },
  { label: 'Campings', href: '/animation-camping-interactive' },
  { label: 'Bars & restaurants', href: '/animation-bar-restaurant-interactive' },
  { label: 'Événementiel', href: '/animation-evenementielle-interactive' },
]

const events = [
  { label: 'Mariage', href: '/animation-mariage-interactive' },
  { label: 'Quiz de mariage', href: '/quiz-mariage' },
  { label: 'Anniversaire', href: '/animation-anniversaire' },
  { label: 'Soirée privée', href: '/animation-soiree-privee' },
  { label: 'Centres de vacances', href: '/animation-centre-vacances' },
]

const resources = [
  { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  { label: 'Guide des animations', href: '/animations-interactives-evenementielles' },
  { label: 'Alternative à Kahoot', href: '/alternative-kahoot-evenement' },
  { label: 'Comment ça marche', href: '/#how-it-works' },
  { label: 'Tarifs', href: '/#pricing' },
  { label: 'Essai gratuit 24h', href: '/#essai' },
  { label: 'Se connecter', href: '/login' },
]

const legal = [
  { label: 'Mentions légales', href: '/mentions-legales' },
  { label: 'CGV', href: '/cgv' },
  { label: 'Confidentialité', href: '/confidentialite' },
]

function Column({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-white mb-4 tracking-wide uppercase text-[12px]">{title}</h3>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-gray-400 hover:text-[#D4AF37] transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#0A0A0D]/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Image
              src="/images/animajet_logo_horizontal.png"
              alt="AnimaJet"
              width={160}
              height={38}
              className="h-9 w-auto mb-4"
            />
            <p className="text-sm text-gray-400 leading-relaxed mb-5 max-w-xs">
              La plateforme d&apos;animations interactives pour les pros de l&apos;événementiel.
              <span className="block mt-2 text-gray-500 italic">
                Développé par un DJ animateur, pour les DJ animateurs.
              </span>
            </p>
            <div className="flex items-center gap-3">
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook AnimaJet"
                className="h-9 w-9 rounded-full bg-white/5 hover:bg-[#1877F2] flex items-center justify-center text-gray-300 hover:text-white transition-colors"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Assistance WhatsApp AnimaJet"
                className="h-9 w-9 rounded-full bg-white/5 hover:bg-[#25D366] flex items-center justify-center text-gray-300 hover:text-white transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
            </div>
          </div>

          <Column title="Animations" links={animations} />
          <Column title="Pour qui ?" links={segments} />
          <Column title="Par événement" links={events} />
          <Column title="Ressources" links={resources} />
          <Column title="Légal" links={legal} />
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} AnimaJet — MG Events Animation. Tous droits réservés.
          </p>
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <span>🇫🇷</span> Conçu en Bretagne pour les pros de l&apos;événementiel
          </p>
        </div>
      </div>
    </footer>
  )
}
