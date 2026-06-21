// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import Link from 'next/link'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Heart,
  Music,
  Trophy,
  Users,
  PencilLine,
  Smartphone,
  type LucideIcon,
} from 'lucide-react'
import SiteHeader from '@/components/marketing/SiteHeader'
import SiteFooter from '@/components/marketing/SiteFooter'
import type { AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'
import QuizDeviceShowcase from './QuizDeviceShowcase'

/**
 * Variante visuelle dédiée à /quiz-mariage.
 * Direction « premium product showcase » : mockups d'appareils, typo Playfair
 * en display, gold discipliné en accent, icônes filaires (zéro emoji),
 * composition rythmée. Le contenu SEO (H1, intro, what, steps, benefits, FAQ,
 * maillage) est rendu tel quel depuis `content` — seule la mise en forme change.
 */

// Icônes filaires homogènes qui remplacent les emojis des bénéfices (ordre du contenu).
const BENEFIT_ICONS: LucideIcon[] = [Heart, Music, Trophy, Users, PencilLine, Smartphone]

export default function QuizMariageLanding({
  content,
  jsonLd,
}: {
  content: AnimationDetailContent
  jsonLd: object
}) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="landing-bg relative min-h-screen overflow-hidden">
        <SiteHeader />

        {/* ───────────────── HERO ───────────────── */}
        <section className="relative px-4 pt-28 pb-12 lg:pt-32 lg:pb-16">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#E5C349]">
                {content.eyebrow}
              </span>
              <h1
                className="mb-6 text-balance text-[clamp(2.4rem,5.2vw,3.9rem)] font-bold leading-[1.04] tracking-[-0.02em] text-white"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                {content.title}{' '}
                <span className="text-[#E5C349]">{content.highlight}</span>
              </h1>
              <p className="mb-9 max-w-xl text-pretty text-lg leading-relaxed text-gray-300">
                {content.intro}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/#essai"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-7 py-4 font-bold text-[#0D0D0F] shadow-[0_6px_24px_rgba(212,175,55,0.28)] transition-[filter,transform] hover:brightness-110 active:scale-[0.99]"
                >
                  Essayer gratuitement
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/#video"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-7 py-4 font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5"
                >
                  Voir la démo
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7">
              <QuizDeviceShowcase />
            </div>
          </div>
        </section>

        {/* ──────────── Comment ça marche (prose) ──────────── */}
        <section className="border-y border-white/5 bg-white/[0.015] px-4 py-14 lg:py-16">
          <div className="mx-auto max-w-2xl">
            <h2
              className="mb-6 text-center text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-tight tracking-[-0.01em] text-white"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              {content.title} {content.highlight}, comment ça marche&nbsp;?
            </h2>
            <div className="space-y-4 text-[1.02rem] leading-[1.6] text-gray-300 [&>p]:text-pretty">
              {content.what.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────── Étapes : flux connecté ──────────── */}
        <section className="px-4 py-14 lg:py-16">
          <div className="mx-auto max-w-5xl">
            <h2
              className="mb-12 text-center text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold tracking-[-0.01em] text-white"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Quatre étapes, et la salle joue
            </h2>
            <div className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Ligne de liaison (desktop) */}
              <div
                aria-hidden
                className="absolute left-0 right-0 top-6 hidden h-px lg:block"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(212,175,55,0.35) 12%, rgba(212,175,55,0.35) 88%, transparent)',
                }}
              />
              {content.steps.map((s, i) => (
                <div key={i} className="relative flex flex-col">
                  <div className="relative z-10 mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#D4AF37] text-lg font-bold text-[#0D0D0F] ring-4 ring-[#0D0D0F]">
                    {i + 1}
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────── Bénéfices : icônes filaires ──────────── */}
        <section className="border-t border-white/5 bg-white/[0.015] px-4 pt-14 pb-12 lg:pt-16 lg:pb-14">
          <div className="mx-auto max-w-5xl">
            <h2
              className="mb-12 text-center text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold tracking-[-0.01em] text-white"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Pourquoi les pros l&apos;adoptent
            </h2>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 sm:grid-cols-2 lg:grid-cols-3">
              {content.benefits.map((b, i) => {
                const Icon = BENEFIT_ICONS[i] ?? Check
                return (
                  <div
                    key={i}
                    className="group bg-[#0D0D0F] p-7 transition-colors hover:bg-white/[0.02]"
                  >
                    <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#E5C349]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mb-2 text-lg font-bold text-white">{b.title}</h3>
                    <p className="text-sm leading-relaxed text-gray-400">{b.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ──────────── Idéal pour (même bande que les bénéfices) ──────────── */}
        <section className="border-b border-white/5 bg-white/[0.015] px-4 pt-2 pb-14 lg:pb-16">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-xl font-bold tracking-[-0.01em] text-white">Idéal pour</h2>
            <div className="flex flex-wrap justify-center gap-2.5">
              {content.idealFor.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-200"
                >
                  <Check className="h-4 w-4 text-[#E5C349]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────── FAQ ──────────── */}
        <section className="px-4 py-14 lg:py-16">
          <div className="mx-auto max-w-3xl">
            <h2
              className="mb-10 text-center text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold tracking-[-0.01em] text-white"
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

        {/* ──────────── CTA final ──────────── */}
        <section className="px-4 pb-14 lg:pb-16">
          <div
            className="mx-auto max-w-3xl rounded-3xl border border-[#D4AF37]/25 px-8 py-10 text-center"
            style={{
              background:
                'radial-gradient(ellipse 80% 120% at 50% -10%, rgba(212,175,55,0.12), transparent 70%), rgba(255,255,255,0.02)',
            }}
          >
            <h2
              className="mb-4 text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold tracking-[-0.01em] text-white"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Prêt à faire participer votre public&nbsp;?
            </h2>
            <p className="mb-8 text-gray-400">Testez AnimaJet gratuitement pendant 24h, sans carte bancaire.</p>
            <Link
              href="/#essai"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-8 py-4 font-bold text-[#0D0D0F] shadow-[0_6px_24px_rgba(212,175,55,0.28)] transition-[filter,transform] hover:brightness-110 active:scale-[0.99]"
            >
              Commencer mon essai gratuit
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>

        {/* ──────────── Maillage interne ──────────── */}
        <section className="border-t border-white/5 px-4 py-12 lg:py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 text-center text-xl font-bold tracking-[-0.01em] text-white">
              À découvrir aussi
            </h2>
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
