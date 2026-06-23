// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Clock } from 'lucide-react'
import SiteHeader from '@/components/marketing/SiteHeader'
import SiteFooter from '@/components/marketing/SiteFooter'
import { BLOG_POSTS } from '@/lib/blog-posts'

const URL = 'https://animajet.fr/blog'

export const metadata: Metadata = {
  title: "Blog AnimaJet : idées et conseils d'animation d'événement",
  description:
    "Idées d'animation, jeux interactifs et conseils de pro pour vos mariages, soirées d'entreprise et événements. Par un DJ animateur qui teste tout sur le terrain.",
  alternates: { canonical: URL },
  openGraph: {
    title: 'Blog AnimaJet : idées et conseils d’animation',
    description: "Idées d'animation et conseils de pro pour faire participer vos invités.",
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'Blog AnimaJet',
  url: URL,
  description: "Idées d'animation et conseils pour faire participer vos invités lors d'événements.",
  publisher: { '@type': 'Organization', name: 'AnimaJet', url: 'https://animajet.fr' },
  blogPost: BLOG_POSTS.map((p) => ({
    '@type': 'BlogPosting',
    headline: p.title,
    url: `${URL}/${p.slug}`,
    datePublished: p.date,
    image: `https://animajet.fr${p.image}`,
  })),
}

export default function BlogIndex() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="landing-bg relative min-h-screen overflow-hidden">
        <SiteHeader />

        <section className="px-4 pt-28 pb-10 lg:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#E5C349]">
              Le blog
            </span>
            <h1
              className="mb-5 text-balance text-[clamp(2.2rem,4.6vw,3.4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-white"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Idées et conseils d&apos;animation
            </h1>
            <p className="mx-auto max-w-xl text-pretty text-lg leading-relaxed text-gray-300">
              Des idées d&apos;animation et des conseils de terrain pour faire participer vos invités, par un DJ
              animateur qui teste tout en conditions réelles.
            </p>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {BLOG_POSTS.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-colors hover:border-[#D4AF37]/40"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={p.image}
                    alt={p.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F] via-[#0D0D0F]/10 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full border border-[#D4AF37]/30 bg-[#0D0D0F]/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#E5C349]">
                    {p.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="mb-2 text-lg font-bold leading-snug text-white">{p.title}</h2>
                  <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-400">{p.excerpt}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-[#E5C349]" /> {formatDate(p.date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#E5C349]" /> {p.readingTime}
                    </span>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#D4AF37] transition-all group-hover:gap-2.5">
                    Lire l&apos;article
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <SiteFooter />
      </div>
    </>
  )
}
