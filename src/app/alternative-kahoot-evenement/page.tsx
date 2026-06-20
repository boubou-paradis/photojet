import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import SiteHeader from '@/components/marketing/SiteHeader'
import SiteFooter from '@/components/marketing/SiteFooter'
import { buildAnimationJsonLd } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/alternative-kahoot-evenement'

export const metadata: Metadata = {
  title: 'Alternative à Kahoot pour vos Événements Festifs | AnimaJet',
  description: "AnimaJet est une alternative à Kahoot pensée pour l'animation festive d'événements : mariages, soirées d'entreprise, bars. Quiz et blind test musical, photos en direct, sans application. Essai gratuit 24h.",
  keywords: ['alternative Kahoot', 'Kahoot pour mariage', 'Kahoot soirée entreprise', 'alternative à Kahoot événement', 'quiz événement', 'animation soirée interactive'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Alternative à Kahoot pour vos événements festifs | AnimaJet',
    description: "AnimaJet répond à un besoin différent de Kahoot : l'animation festive d'événements (mariages, soirées d'entreprise, bars).",
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

// Tableau comparatif — critères d'usage, factuels (pas de jugement de valeur)
const comparison: { criterion: string; kahoot: string; animajet: string }[] = [
  { criterion: 'Contexte de prédilection', kahoot: 'Éducation, formation et engagement en classe ou en entreprise', animajet: 'Animation festive d\'événements : mariages, soirées d\'entreprise, bars' },
  { criterion: 'Objectif principal', kahoot: 'Apprendre, réviser et mesurer les connaissances', animajet: 'Faire participer le public et créer de l\'ambiance' },
  { criterion: 'Quiz musical & blind test pour soirée', kahoot: 'Ce n\'est pas son usage de prédilection', animajet: 'Intégrés, avec classement en direct' },
  { criterion: 'Partage des photos des invités en direct', kahoot: 'Hors de son périmètre', animajet: 'Photos affichées en direct sur écran géant' },
  { criterion: 'Impression photo sur place', kahoot: 'Hors de son périmètre', animajet: 'Borne photo et impression incluses' },
  { criterion: 'Conçu pour l\'animateur / le DJ', kahoot: 'Ce n\'est pas son orientation', animajet: 'Oui, développé par un DJ animateur' },
]

const faq = [
  { q: 'Peut-on utiliser Kahoot pour un mariage ?', a: "Oui, c'est tout à fait possible : Kahoot permet de créer des quiz que les invités rejoignent depuis leur téléphone. Kahoot a toutefois été conçu pour l'éducation et la formation. Pour un mariage, AnimaJet ajoute des fonctions pensées pour la fête : blind test musical, partage de photos en direct, borne photo et personnalisation aux couleurs des mariés. Le meilleur choix dépend de l'ambiance recherchée." },
  { q: 'Quelle est la différence entre AnimaJet et Kahoot ?', a: "Les deux outils font participer un groupe depuis un smartphone, mais avec des objectifs différents : Kahoot est orienté éducation et formation, AnimaJet est orienté animation festive d'événements (mariages, soirées d'entreprise, bars). La différence se situe dans l'usage, pas dans une supériorité de l'un sur l'autre." },
  { q: 'AnimaJet fonctionne-t-il sans application, comme un quiz en ligne ?', a: "Oui. Vos invités scannent un QR code et participent directement dans le navigateur de leur téléphone, sans installer d'application ni créer de compte." },
  { q: 'AnimaJet convient-il aux soirées d\'entreprise ?', a: "Oui. Au-delà du quiz, AnimaJet ajoute le blind test musical, le partage de photos en direct et la personnalisation à la marque de l'entreprise, pour transformer un séminaire ou une soirée corporate en moment fédérateur." },
]

const related = [
  { label: 'Quiz interactif', href: '/quiz-interactif' },
  { label: 'Blind test musical', href: '/blind-test-musical' },
  { label: 'Animation de mariage', href: '/animation-mariage-interactive' },
  { label: 'Soirées d\'entreprise', href: '/animation-entreprise-interactive' },
]

const jsonLd = buildAnimationJsonLd({
  name: 'AnimaJet — alternative à Kahoot pour l\'événementiel festif',
  description: "AnimaJet est une solution d'animation festive d'événements (mariages, soirées d'entreprise, bars) : quiz et blind test musical, photos en direct, borne photo, sans application.",
  url: URL,
  serviceType: 'Animation interactive pour événements festifs',
  faq,
})

export default function AlternativeKahootPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen relative overflow-hidden landing-bg">
        <SiteHeader />

        {/* HERO */}
        <section className="relative pt-28 lg:pt-32 pb-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold tracking-wide mb-5">
              ALTERNATIVE À KAHOOT
            </span>
            <h1 className="font-heading text-4xl lg:text-5xl font-black text-white leading-[1.1] mb-5">
              AnimaJet, l&apos;alternative à Kahoot{' '}
              <span className="text-gold-gradient">pensée pour vos événements festifs</span>
            </h1>
            <p className="text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto mb-8">
              Kahoot est un outil reconnu pour l&apos;éducation et la formation, en classe comme en entreprise. AnimaJet répond à un besoin différent : l&apos;animation festive d&apos;événements comme les mariages, les soirées d&apos;entreprise et les soirées en bar. Si vous cherchez une solution pensée dès le départ pour faire la fête et créer de l&apos;ambiance, voici en quoi AnimaJet se distingue par son usage.
            </p>
            <Link
              href="/#essai"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] text-[#0D0D0F] font-bold hover:brightness-110 shadow-[0_4px_24px_rgba(212,175,55,0.3)] transition-all"
            >
              Essayer gratuitement 24h
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>

        <div className="relative z-10 content-layer">
          {/* Tableau comparatif */}
          <section className="py-12 px-4 section-glow">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-heading text-3xl font-bold text-white text-center mb-8">
                Kahoot et AnimaJet : une différence d&apos;usage
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-[#D4AF37]/15">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-white/5 text-white">
                      <th className="px-4 py-4 font-semibold">Critère d&apos;usage</th>
                      <th className="px-4 py-4 font-semibold">Kahoot</th>
                      <th className="px-4 py-4 font-semibold text-[#D4AF37]">AnimaJet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((row) => (
                      <tr key={row.criterion} className="border-t border-white/10 align-top">
                        <th scope="row" className="px-4 py-4 font-semibold text-white/90">{row.criterion}</th>
                        <td className="px-4 py-4 text-gray-400">{row.kahoot}</td>
                        <td className="px-4 py-4 text-gray-200 bg-[#D4AF37]/[0.06]">{row.animajet}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                Tableau fourni à titre informatif, sur des critères d&apos;usage. Kahoot est une marque tierce, sans lien avec AnimaJet.
              </p>
            </div>
          </section>

          {/* Corps */}
          <section className="py-12 px-4 section-glow">
            <div className="max-w-3xl mx-auto space-y-8 text-gray-300 leading-relaxed">
              <div className="space-y-3">
                <h2 className="font-heading text-2xl font-bold text-white">Deux outils, deux objectifs</h2>
                <p>
                  Kahoot et AnimaJet partent d&apos;une même idée simple — faire participer un groupe depuis son téléphone — mais servent des objectifs différents. Kahoot s&apos;est imposé dans l&apos;éducation et la formation : il aide à apprendre, à réviser et à animer une session pédagogique. AnimaJet, lui, a été conçu pour l&apos;événementiel festif, là où l&apos;enjeu n&apos;est pas de transmettre un savoir mais de créer une ambiance et des souvenirs.
                </p>
              </div>
              <div className="space-y-3">
                <h2 className="font-heading text-2xl font-bold text-white">Ce que change le contexte festif</h2>
                <p>
                  Animer un mariage, une soirée d&apos;entreprise ou une soirée en bar demande des fonctionnalités spécifiques. AnimaJet intègre un quiz et un blind test musical pensés pour la piste, le partage des photos des invités en direct sur écran géant, une borne photo avec impression sur place, et une personnalisation complète à votre marque ou à celle des mariés. L&apos;ensemble fonctionne sans application : un QR code suffit pour que tous les invités, de tous âges, participent en quelques secondes.
                </p>
              </div>
              <div className="space-y-3">
                <h2 className="font-heading text-2xl font-bold text-white">Pensé par et pour les pros de la fête</h2>
                <p>
                  AnimaJet a été développé par un DJ animateur, à partir de l&apos;expérience du terrain : relancer une salle qui retombe, garder la main sur le rythme et marquer les esprits. C&apos;est cette origine qui oriente chaque fonctionnalité vers l&apos;animation festive plutôt que vers la formation.
                </p>
              </div>
              <div className="space-y-3">
                <h2 className="font-heading text-2xl font-bold text-white">En résumé</h2>
                <p>
                  Le choix dépend de votre besoin : pour former ou enseigner, des outils comme Kahoot sont parfaitement adaptés ; pour animer un événement festif et faire monter l&apos;ambiance, AnimaJet a été pensé exactement pour cela. Vous pouvez le tester gratuitement pendant 24h avant votre prochain événement.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-12 px-4 section-glow">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-heading text-3xl font-bold text-white text-center mb-10">Questions fréquentes</h2>
              <div className="space-y-3">
                {faq.map((f, i) => (
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
                Prêt à animer votre prochain événement ?
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
                {related.map((r) => (
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
