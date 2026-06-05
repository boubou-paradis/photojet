// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import SiteHeader from '@/components/marketing/SiteHeader'
import SiteFooter from '@/components/marketing/SiteFooter'

export interface AnimationDetailContent {
  /** Fil d'ariane / eyebrow */
  eyebrow: string
  /** H1 */
  title: string
  /** mot mis en avant (doré) dans le H1 */
  highlight: string
  /** sous-titre */
  intro: string
  /** image illustrative (chemin public) */
  image: string
  /** paragraphe(s) "qu'est-ce que c'est" */
  what: string[]
  /** étapes de déroulé */
  steps: { title: string; desc: string }[]
  /** bénéfices */
  benefits: { emoji: string; title: string; desc: string }[]
  /** idéal pour (chips) */
  idealFor: string[]
  /** FAQ */
  faq: { q: string; a: string }[]
  /** maillage interne */
  related: { label: string; href: string }[]
}

/** Construit le graphe JSON-LD (Service + FAQPage) d'une page animation. */
export function buildAnimationJsonLd({
  name,
  description,
  url,
  serviceType,
  faq,
}: {
  name: string
  description: string
  url: string
  serviceType: string
  faq: { q: string; a: string }[]
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name,
        description,
        serviceType,
        url,
        provider: { '@type': 'Organization', name: 'AnimaJet', url: 'https://animajet.fr' },
        areaServed: 'France',
        offers: {
          '@type': 'Offer',
          price: '29.90',
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }
}

export default function AnimationDetailPage({
  content,
  jsonLd,
}: {
  content: AnimationDetailContent
  jsonLd: object
}) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen relative overflow-hidden landing-bg">
        <SiteHeader />

        {/* HERO */}
        <section className="relative pt-28 lg:pt-32 pb-16 px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold tracking-wide mb-5">
                {content.eyebrow}
              </span>
              <h1 className="font-heading text-4xl lg:text-5xl font-black text-white leading-[1.1] mb-5">
                {content.title}{' '}
                <span className="text-gold-gradient">{content.highlight}</span>
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-xl">{content.intro}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/#essai"
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] text-[#0D0D0F] font-bold hover:brightness-110 shadow-[0_4px_24px_rgba(212,175,55,0.3)] transition-all"
                >
                  Essayer gratuitement
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/#video"
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-white/25 bg-white/5 text-white font-semibold hover:bg-white/10 transition-all"
                >
                  Voir la démo
                </Link>
              </div>
            </div>

            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-[#D4AF37]/25 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <Image
                src={content.image}
                alt={`${content.title} ${content.highlight} — AnimaJet`}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F]/50 to-transparent" />
            </div>
          </div>
        </section>

        <div className="relative z-10 content-layer">
          {/* Qu'est-ce que c'est */}
          <section className="py-16 px-4 section-glow">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-heading text-3xl font-bold text-white mb-6">
                {content.title} {content.highlight}, comment ça marche ?
              </h2>
              <div className="space-y-4 text-gray-300 leading-relaxed text-left">
                {content.what.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </section>

          {/* Étapes */}
          <section className="py-16 px-4 section-glow">
            <div className="max-w-5xl mx-auto">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {content.steps.map((s, i) => (
                  <div key={i} className="card-float rounded-2xl p-6 border-[#D4AF37]/15 h-full">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F4D03F] flex items-center justify-center mb-4 shadow-lg shadow-[#D4AF37]/30">
                      <span className="text-xl font-bold text-[#0D0D0F]">{i + 1}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Bénéfices */}
          <section className="py-16 px-4 section-glow">
            <div className="max-w-5xl mx-auto">
              <h2 className="font-heading text-3xl font-bold text-white text-center mb-12">
                Pourquoi les pros l&apos;adoptent
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {content.benefits.map((b, i) => (
                  <div key={i} className="card-float rounded-2xl p-6 border-[#D4AF37]/15">
                    <div className="text-3xl mb-3">{b.emoji}</div>
                    <h3 className="text-lg font-bold text-white mb-2">{b.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{b.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Idéal pour */}
          <section className="py-16 px-4 section-glow">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="font-heading text-2xl font-bold text-white mb-6">Idéal pour</h2>
              <div className="flex flex-wrap justify-center gap-3">
                {content.idealFor.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-gray-200 text-sm"
                  >
                    <Check className="h-4 w-4 text-[#D4AF37]" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-16 px-4 section-glow">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-heading text-3xl font-bold text-white text-center mb-10">Questions fréquentes</h2>
              <div className="space-y-3">
                {content.faq.map((f, i) => (
                  <details key={i} className="group card-float rounded-xl border-[#D4AF37]/15 px-5 [&[open]]:border-[#D4AF37]/40">
                    <summary className="flex items-center justify-between gap-4 cursor-pointer py-4 list-none [&::-webkit-details-marker]:hidden text-white font-semibold">
                      {f.q}
                      <ChevronDown className="h-5 w-5 text-[#D4AF37] flex-shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="pb-4 text-gray-400 leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* CTA final */}
          <section className="py-16 px-4 section-glow">
            <div className="max-w-3xl mx-auto text-center card-float rounded-3xl p-10 border-[#D4AF37]/25">
              <h2 className="font-heading text-3xl font-bold text-white mb-4">
                Prêt à faire participer votre public ?
              </h2>
              <p className="text-gray-400 mb-7">
                Testez AnimaJet gratuitement pendant 24h, sans carte bancaire.
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

          {/* Maillage interne */}
          <section className="py-16 px-4 section-glow">
            <div className="max-w-5xl mx-auto">
              <h2 className="font-heading text-2xl font-bold text-white text-center mb-8">
                À découvrir aussi
              </h2>
              <div className="flex flex-wrap justify-center gap-3">
                {content.related.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl card-float border-[#D4AF37]/15 hover:border-[#D4AF37]/40 text-gray-200 text-sm font-medium transition-colors"
                  >
                    {r.label}
                    <ArrowRight className="h-4 w-4 text-[#D4AF37]" />
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <SiteFooter />
        </div>
      </div>
    </>
  )
}
