import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import SiteHeader from '@/components/marketing/SiteHeader'
import SiteFooter from '@/components/marketing/SiteFooter'
import { SEO_PAGES, seoPagesByCategory, type SeoCategory } from '@/lib/seo-pages'
import { breadcrumbJsonLd } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/fonctionnalites'

export const metadata: Metadata = {
  title: 'Fonctionnalités AnimaJet | Toutes les Animations Interactives',
  description: 'Découvrez toutes les fonctionnalités d\'AnimaJet : quiz et blind test, photos en direct, impression sur place, diaporama live, jeux interactifs et plus. Essai gratuit 24h.',
  keywords: ['fonctionnalités AnimaJet', 'animations interactives événement', 'logiciel animation événementielle', 'jeux interactifs soirée', 'photos en direct événement'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Fonctionnalités AnimaJet | Toutes les animations interactives',
    description: 'Quiz, blind test, photos en direct, impression, diaporama live, jeux interactifs : le panorama complet d\'AnimaJet.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

// Sections affichées (l'ordre = ordre d'affichage). Le hub ne se liste pas lui-même.
const SECTIONS: { category: SeoCategory; heading: string; subtitle: string }[] = [
  { category: 'feature', heading: 'Fonctionnalités photo', subtitle: 'Capturez, partagez et imprimez les souvenirs en direct' },
  { category: 'animation', heading: 'Jeux & animations', subtitle: 'Les jeux interactifs qui font participer toute la salle' },
  { category: 'cible', heading: 'Pour les professionnels', subtitle: 'Des solutions pensées pour chaque métier de l\'événementiel' },
  { category: 'evenement', heading: 'Par type d\'événement', subtitle: 'L\'animation adaptée à chaque occasion' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      name: 'Fonctionnalités AnimaJet',
      description: 'Panorama de toutes les animations et fonctionnalités interactives d\'AnimaJet.',
      url: URL,
    },
    {
      '@type': 'ItemList',
      itemListElement: SEO_PAGES.filter((p) => p.category !== 'hub').map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.label,
        url: `https://animajet.fr/${p.slug}`,
      })),
    },
    breadcrumbJsonLd('Fonctionnalités', URL),
  ],
}

export default function FonctionnalitesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen relative overflow-hidden landing-bg">
        <SiteHeader />

        {/* HERO */}
        <section className="relative pt-28 lg:pt-32 pb-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold tracking-wide mb-5">
              FONCTIONNALITÉS
            </span>
            <h1 className="font-heading text-4xl lg:text-5xl font-black text-white leading-[1.1] mb-5">
              Tout ce qu&apos;AnimaJet{' '}
              <span className="text-gold-gradient">peut faire pour vos événements</span>
            </h1>
            <p className="text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto">
              Une seule plateforme pour animer n&apos;importe quel événement : jeux interactifs, photos en direct,
              impression sur place et diaporama géant. Explorez chaque fonctionnalité ci-dessous.
            </p>
            <div className="mt-8">
              <Link
                href="/#essai"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] text-[#0D0D0F] font-bold hover:brightness-110 shadow-[0_4px_24px_rgba(212,175,55,0.3)] transition-all"
              >
                Essayer gratuitement 24h
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>

        <div className="relative z-10 content-layer">
          {SECTIONS.map((section) => {
            const pages = seoPagesByCategory(section.category)
            if (pages.length === 0) return null
            return (
              <section key={section.category} className="py-12 px-4 section-glow">
                <div className="max-w-5xl mx-auto">
                  <div className="text-center mb-8">
                    <h2 className="font-heading text-3xl font-bold text-white mb-2">{section.heading}</h2>
                    <p className="text-gray-400">{section.subtitle}</p>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pages.map((page) => (
                      <Link
                        key={page.slug}
                        href={`/${page.slug}`}
                        className="group card-float rounded-2xl p-6 border-[#D4AF37]/15 hover:border-[#D4AF37]/40 transition-colors flex flex-col"
                      >
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center justify-between gap-2">
                          {page.label}
                          <ArrowRight className="h-4 w-4 text-[#D4AF37] flex-shrink-0 transition-transform group-hover:translate-x-1" />
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed">{page.blurb}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )
          })}

          {/* CTA final */}
          <section className="py-16 px-4 section-glow">
            <div className="max-w-3xl mx-auto text-center card-float rounded-3xl p-10 border-[#D4AF37]/25">
              <h2 className="font-heading text-3xl font-bold text-white mb-4">
                Prêt à animer votre prochain événement ?
              </h2>
              <p className="text-gray-400 mb-7">
                Testez toutes ces fonctionnalités gratuitement pendant 24h, sans carte bancaire.
              </p>
              <Link
                href="/#essai"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] text-[#0D0D0F] font-bold hover:brightness-110 shadow-[0_4px_24px_rgba(212,175,55,0.3)] transition-all"
              >
                Commencer mon essai gratuit
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </section>

          <SiteFooter />
        </div>
      </div>
    </>
  )
}
