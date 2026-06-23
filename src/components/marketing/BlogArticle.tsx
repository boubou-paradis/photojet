// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ChevronDown, CalendarDays, Clock, ArrowLeft } from 'lucide-react'
import SiteHeader from '@/components/marketing/SiteHeader'
import SiteFooter from '@/components/marketing/SiteFooter'

export interface BlogSection {
  /** ancre optionnelle (pour sommaire / liens) */
  id?: string
  /** titre H2 */
  heading: string
  /** paragraphes (HTML autorisé : liens internes <a href="/...">) */
  body?: string[]
  /** tableau optionnel (ex. cadre de décision) */
  table?: { head: string[]; rows: string[][] }
  /** grille de cartes optionnelle (ex. liste d'idées) */
  cards?: { title: string; desc: string }[]
  /** sous-sections H3 */
  subsections?: { heading: string; body: string[] }[]
}

export interface BlogArticleContent {
  eyebrow: string
  /** H1 */
  title: string
  /** chapô / intro (HTML autorisé) */
  intro: string
  heroImage: string
  heroAlt: string
  /** ISO (YYYY-MM-DD) */
  datePublished: string
  dateModified: string
  readingTime: string
  author: { name: string; role: string; bio: string; avatar?: string }
  sections: BlogSection[]
  faq: { q: string; a: string }[]
  related: { label: string; href: string }[]
  cta?: { title: string; text: string }
}

const SITE = 'https://animajet.fr'

/** Construit le graphe JSON-LD (BlogPosting + FAQPage + BreadcrumbList) d'un article. */
export function buildBlogJsonLd({
  slug,
  title,
  description,
  image,
  datePublished,
  dateModified,
  author,
  faq,
}: {
  slug: string
  title: string
  description: string
  image: string
  datePublished: string
  dateModified: string
  author: { name: string; role: string }
  faq: { q: string; a: string }[]
}) {
  const url = `${SITE}/blog/${slug}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: title,
        description,
        image: `${SITE}${image}`,
        datePublished,
        dateModified,
        inLanguage: 'fr-FR',
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        author: { '@type': 'Person', name: author.name, jobTitle: author.role },
        publisher: {
          '@type': 'Organization',
          name: 'AnimaJet',
          logo: { '@type': 'ImageObject', url: `${SITE}/images/animajet_logo_principal.png` },
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
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
          { '@type': 'ListItem', position: 3, name: title, item: url },
        ],
      },
    ],
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BlogArticle({
  content,
  jsonLd,
}: {
  content: BlogArticleContent
  jsonLd: object
}) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="landing-bg relative min-h-screen overflow-hidden">
        <SiteHeader />

        <article className="px-4 pt-28 pb-10 lg:pt-32">
          <div className="mx-auto max-w-3xl">
            {/* Fil d'ariane */}
            <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
              <Link href="/blog" className="inline-flex items-center gap-1.5 transition-colors hover:text-[#E5C349]">
                <ArrowLeft className="h-4 w-4" /> Blog
              </Link>
            </nav>

            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#E5C349]">
              {content.eyebrow}
            </span>

            <h1
              className="mb-5 text-balance text-[clamp(2.1rem,4.6vw,3.4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-white"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              {content.title}
            </h1>

            <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-[#E5C349]" /> Mis à jour le {formatDate(content.dateModified)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#E5C349]" /> {content.readingTime} de lecture
              </span>
            </div>

            <p
              className="mb-8 text-pretty text-lg leading-relaxed text-gray-300 [&_a]:font-medium [&_a]:text-[#E5C349] [&_a:hover]:underline"
              dangerouslySetInnerHTML={{ __html: content.intro }}
            />
          </div>

          {/* Image hero */}
          <div className="mx-auto max-w-4xl">
            <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
              <Image
                src={content.heroImage}
                alt={content.heroAlt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 56rem"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F]/45 to-transparent" />
            </div>
          </div>
        </article>

        {/* Corps de l'article */}
        <div className="px-4 pb-6">
          <div className="mx-auto max-w-3xl">
            {content.sections.map((s, i) => (
              <section key={i} id={s.id} className="scroll-mt-24 py-7 lg:py-8">
                <h2
                  className="mb-5 text-[clamp(1.6rem,3vw,2.2rem)] font-bold leading-tight tracking-[-0.01em] text-white"
                  style={{ fontFamily: 'var(--font-playfair)' }}
                >
                  {s.heading}
                </h2>

                {s.body?.map((p, j) => (
                  <p
                    key={j}
                    className="mb-4 text-[1.05rem] leading-[1.7] text-gray-300 [&_a]:font-medium [&_a]:text-[#E5C349] [&_a:hover]:underline"
                    dangerouslySetInnerHTML={{ __html: p }}
                  />
                ))}

                {s.table && (
                  <div className="my-6 overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="bg-white/[0.04]">
                          {s.table.head.map((h, k) => (
                            <th key={k} className="px-4 py-3 font-bold text-white">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.table.rows.map((row, k) => (
                          <tr key={k} className="border-t border-white/8">
                            {row.map((cell, l) => (
                              <td key={l} className="px-4 py-3 text-gray-300">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {s.cards && (
                  <div className="my-6 grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 sm:grid-cols-2">
                    {s.cards.map((c, k) => (
                      <div key={k} className="bg-[#0D0D0F] p-6">
                        <h3 className="mb-2 text-base font-bold text-white">{c.title}</h3>
                        <p className="text-sm leading-relaxed text-gray-400">{c.desc}</p>
                      </div>
                    ))}
                  </div>
                )}

                {s.subsections?.map((sub, k) => (
                  <div key={k} className="mt-6">
                    <h3 className="mb-3 text-xl font-bold text-white">{sub.heading}</h3>
                    {sub.body.map((p, l) => (
                      <p
                        key={l}
                        className="mb-4 text-[1.05rem] leading-[1.7] text-gray-300 [&_a]:font-medium [&_a]:text-[#E5C349] [&_a:hover]:underline"
                        dangerouslySetInnerHTML={{ __html: p }}
                      />
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>

        {/* Encart auteur (E-E-A-T) */}
        <section className="px-4 py-8">
          <div className="mx-auto flex max-w-3xl items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border border-[#D4AF37]/30">
              <Image src={content.author.avatar ?? '/images/hero-animajet.png'} alt={content.author.name} fill className="object-cover" sizes="56px" />
            </div>
            <div>
              <p className="font-bold text-white">{content.author.name}</p>
              <p className="mb-2 text-sm text-[#E5C349]">{content.author.role}</p>
              <p className="text-sm leading-relaxed text-gray-400">{content.author.bio}</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 py-10 lg:py-12">
          <div className="mx-auto max-w-3xl">
            <h2
              className="mb-8 text-center text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.01em] text-white"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Questions fréquentes
            </h2>
            <div className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/8">
              {content.faq.map((f, i) => (
                <details key={i} className="group bg-white/[0.02] px-5 open:bg-white/[0.035]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-semibold text-white [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="h-5 w-5 flex-shrink-0 text-[#E5C349] transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="pb-5 leading-relaxed text-gray-400">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="px-4 pb-12 lg:pb-14">
          <div
            className="mx-auto max-w-3xl rounded-3xl border border-[#D4AF37]/25 px-8 py-10 text-center"
            style={{
              background:
                'radial-gradient(ellipse 80% 120% at 50% -10%, rgba(212,175,55,0.12), transparent 70%), rgba(255,255,255,0.02)',
            }}
          >
            <h2
              className="mb-4 text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.01em] text-white"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              {content.cta?.title ?? 'Prêt à faire participer vos invités ?'}
            </h2>
            <p className="mb-8 text-gray-400">{content.cta?.text ?? 'Testez AnimaJet gratuitement pendant 24h, sans carte bancaire.'}</p>
            <Link
              href="/#essai"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-8 py-4 font-bold text-[#0D0D0F] shadow-[0_6px_24px_rgba(212,175,55,0.28)] transition-[filter,transform] hover:brightness-110 active:scale-[0.99]"
            >
              Commencer mon essai gratuit
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>

        {/* Maillage interne */}
        <section className="border-t border-white/5 px-4 py-12 lg:py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 text-center text-xl font-bold tracking-[-0.01em] text-white">À découvrir aussi</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {content.related.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-gray-200 transition-colors hover:border-[#D4AF37]/40 hover:text-white"
                >
                  {r.label}
                  <ArrowRight className="h-4 w-4 text-[#E5C349] transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </>
  )
}
