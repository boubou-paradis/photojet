import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import SiteHeader from '@/components/marketing/SiteHeader'
import SiteFooter from '@/components/marketing/SiteFooter'

const URL = 'https://animajet.fr/animations-interactives-evenementielles'

export const metadata: Metadata = {
  title: 'Animations interactives pour événements : le guide',
  description: "Quiz, roue de la chance, photo mystère, partage photo : le guide des animations interactives pour vos événements, sans application. Essai gratuit 24h.",
  keywords: [
    'animations interactives',
    'animation interactive événementielle',
    'animation événement smartphone',
    'jeux interactifs événement',
    'animation écran géant',
    'animation QR code',
    'faire participer les invités',
    'animation soirée interactive',
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Animations Interactives Événementielles | AnimaJet',
    description: "Le guide complet des animations interactives qui font participer vos invités depuis leur téléphone, sur écran géant.",
    url: URL,
    type: 'article',
    locale: 'fr_FR',
  },
}

const animations = [
  { name: 'Quiz interactif', href: '/quiz-interactif', img: '/images/games/quiz.png', desc: 'Vos invités répondent depuis leur téléphone, le classement s\'affiche en direct sur écran géant.' },
  { name: 'Roue de la Destinée', href: '/roue-de-la-destinee', img: '/images/games/roue-de-la-destinee.png', desc: 'Une roue jackpot premium pour distribuer lots, gages et défis dans un suspense total.' },
  { name: 'Photo Mystère', href: '/photo-mystere', img: '/images/games/photo-mystere.png', desc: 'Une photo se dévoile peu à peu : le premier qui devine remporte la manche.' },
  { name: 'Le Bon Ordre', href: '/le-bon-ordre', img: '/images/games/le-bon-ordre.png', desc: 'Un jeu de classement malin qui fait réfléchir et débattre toute la salle.' },
  { name: 'Partage photo en direct', href: '/partage-photo-evenement', img: '/photo-qr-partage.png', desc: 'Les photos des invités s\'affichent en direct sur écran géant, album partagé à la clé.' },
  { name: 'Borne photo', href: '/borne-photo', img: '/images/borne-photo.png', desc: 'Le photobooth nouvelle génération : impression instantanée et album connecté.' },
]

const segments = [
  { label: 'DJ & animateurs', href: '/animation-dj-interactive' },
  { label: 'Mariages', href: '/animation-mariage-interactive' },
  { label: 'Entreprises', href: '/animation-entreprise-interactive' },
  { label: 'Campings', href: '/animation-camping-interactive' },
  { label: 'Bars & restaurants', href: '/animation-bar-restaurant-interactive' },
  { label: 'Événementiel', href: '/animation-evenementielle-interactive' },
]

const faqs = [
  { q: "Qu'est-ce qu'une animation interactive événementielle ?", a: "C'est une animation où le public n'est plus spectateur mais acteur : les invités participent depuis leur téléphone (quiz, jeux, partage photo) et les résultats s'affichent en direct sur un écran géant. L'objectif est de créer de la participation, de l'émotion et des souvenirs collectifs." },
  { q: 'Faut-il une application pour les animations AnimaJet ?', a: "Non. Toutes les animations fonctionnent via un simple QR code : les invités le scannent avec leur téléphone et participent directement dans leur navigateur, sans rien installer." },
  { q: 'Quel matériel faut-il pour animer une soirée avec AnimaJet ?', a: "Un écran ou un vidéoprojecteur pour l'affichage, une connexion internet, et un appareil pour piloter (ordinateur ou tablette). Vos invités utilisent leur propre smartphone." },
  { q: 'Ces animations conviennent-elles aux mariages ?', a: "Oui. Quiz spécial mariés, photo mystère personnalisée, partage photo en direct et borne photo font partie des animations de mariage les plus appréciées, car elles font participer tous les invités, des enfants aux grands-parents." },
  { q: 'Combien coûtent les animations interactives AnimaJet ?', a: "L'abonnement est à 29,90€/mois sans engagement, et un Pass Événement à 14,90€ existe pour un week-end ponctuel. Vous pouvez tester gratuitement pendant 24h en semaine, sans carte bancaire." },
  { q: 'AnimaJet est-il fait pour les professionnels ?', a: "Oui, AnimaJet a été développé par un DJ animateur pour les professionnels de l'événementiel : DJ, animateurs, campings, bars, restaurants et entreprises. Tout est pensé pour que l'animateur garde la main et gagne du temps." },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      headline: 'Animations interactives événementielles : le guide complet',
      description: "Le guide des animations interactives pour l'événementiel : quiz, roue, photo mystère, partage photo, borne photo.",
      author: { '@type': 'Organization', name: 'AnimaJet' },
      publisher: { '@type': 'Organization', name: 'AnimaJet', logo: { '@type': 'ImageObject', url: 'https://animajet.fr/images/animajet_logo_principal.png' } },
      mainEntityOfPage: URL,
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ],
}

export default function PillarPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen relative overflow-hidden landing-bg">
        <SiteHeader />

        {/* HERO */}
        <section className="relative pt-28 lg:pt-36 pb-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold tracking-wide mb-5">
              LE GUIDE COMPLET
            </span>
            <h1 className="font-heading text-4xl lg:text-6xl font-black text-white leading-[1.1] mb-6">
              Les animations interactives qui{' '}
              <span className="text-gold-gradient">transforment vos événements</span>
            </h1>
            <p className="text-lg lg:text-xl text-gray-300 leading-relaxed mb-8 max-w-2xl mx-auto">
              Faites participer tous vos invités depuis leur téléphone. Quiz, roue de la destinée, photo mystère, partage photo en direct sur écran géant — sans aucune application à installer.
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
          {/* Corps de l'article */}
          <article className="py-12 px-4">
            <div className="max-w-3xl mx-auto space-y-12 text-gray-300 leading-relaxed text-[17px]">

              <section className="space-y-4">
                <h2 className="font-heading text-3xl font-bold text-white">Qu'est-ce qu'une animation interactive ?</h2>
                <p>
                  Une <strong className="text-white">animation interactive événementielle</strong> est une animation où votre public cesse d'être spectateur pour devenir acteur. Au lieu de regarder un spectacle, les invités <strong className="text-white">participent en temps réel depuis leur smartphone</strong> : ils répondent à un quiz, font tourner une roue, devinent une photo, envoient leurs clichés. Les résultats s'affichent instantanément sur un écran géant, créant une énergie collective impossible à obtenir avec une animation passive.
                </p>
                <p>
                  Le principe est aussi simple qu'efficace : un <strong className="text-white">QR code</strong> s'affiche à l'écran, chaque invité le scanne avec son téléphone, et la participation commence — sans application à télécharger, sans compte à créer. En quelques secondes, toute une salle est connectée et joue ensemble.
                </p>
                <p>
                  Cette mécanique répond à un besoin concret des professionnels de l'événementiel : <strong className="text-white">capter l'attention</strong> d'un public de plus en plus sollicité, et transformer une assemblée silencieuse en une foule qui rit, applaudit et se souvient.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="font-heading text-3xl font-bold text-white">Pourquoi les animations interactives fonctionnent</h2>
                <p>
                  Les meilleures soirées ne sont pas celles où l'on regarde, mais celles où l'on <strong className="text-white">participe</strong>. Plusieurs ressorts expliquent l'efficacité des animations interactives :
                </p>
                <ul className="space-y-3">
                  {[
                    ['Participation universelle', "Un téléphone suffit. Même les invités timides ou peu à l'aise osent jouer, parce qu'ils participent depuis leur écran, sans être exposés."],
                    ['Émotion collective', "Tout le monde regarde le même écran géant au même moment : le suspense, les rires et les applaudissements sont partagés."],
                    ['Souvenirs durables', "Les photos partagées, les podiums et les fous rires créent des souvenirs que les invités évoquent encore longtemps après."],
                    ["Moins de travail pour l'animateur", "Plus besoin d'improviser pendant des heures : les animations sont prêtes à lancer et tiennent la salle à votre place."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex gap-3">
                      <Check className="h-5 w-5 text-[#D4AF37] flex-shrink-0 mt-1" />
                      <span><strong className="text-white">{t} :</strong> {d}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  Pour un professionnel, l'enjeu est double : <strong className="text-white">marquer les esprits</strong> le soir même, et <strong className="text-white">se démarquer</strong> de la concurrence pour décrocher la prochaine prestation. Une animation interactive bien menée devient un argument commercial à part entière.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="font-heading text-3xl font-bold text-white">Sans application : comment ça marche</h2>
                <p>
                  L'un des plus grands freins aux animations digitales a longtemps été l'installation d'une application. AnimaJet supprime cet obstacle : <strong className="text-white">tout passe par le navigateur du téléphone</strong>. L'invité scanne le QR code affiché à l'écran avec son appareil photo, une page web s'ouvre, et il participe immédiatement.
                </p>
                <p>
                  Côté organisateur, le déroulé tient en quatre étapes : <strong className="text-white">créer la session</strong> (en 2 minutes), <strong className="text-white">partager le QR code</strong>, laisser <strong className="text-white">les invités participer</strong>, et regarder <strong className="text-white">tout s'afficher sur l'écran géant</strong>. Vous pilotez le rythme depuis votre ordinateur ou votre tablette, et gardez la main du début à la fin.
                </p>
              </section>

              {/* Les animations — grille avec liens (maillage) */}
              <section className="space-y-6">
                <h2 className="font-heading text-3xl font-bold text-white">Les animations interactives disponibles</h2>
                <p>
                  AnimaJet réunit plusieurs animations complémentaires que vous combinez selon le moment de la soirée. Chacune dispose de son guide dédié :
                </p>
                <div className="grid sm:grid-cols-2 gap-5 not-prose">
                  {animations.map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      className="card-float rounded-2xl overflow-hidden border-[#D4AF37]/15 hover:border-[#D4AF37]/40 group flex flex-col"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <Image
                          src={a.img}
                          alt={`${a.name} — animation interactive AnimaJet`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 100vw, 50vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F] via-[#0D0D0F]/10 to-transparent" />
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="text-lg font-bold text-white mb-1.5 flex items-center gap-1.5">
                          {a.name}
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed flex-1">{a.desc}</p>
                        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#D4AF37] group-hover:gap-2.5 transition-all">
                          En savoir plus <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="font-heading text-3xl font-bold text-white">Une animation pour chaque type d'événement</h2>
                <p>
                  Les animations interactives s'adaptent à tous les contextes. Un <Link href="/animation-mariage-interactive" className="text-[#D4AF37] hover:underline">mariage</Link> n'a pas les mêmes attentes qu'un <Link href="/animation-entreprise-interactive" className="text-[#D4AF37] hover:underline">séminaire d'entreprise</Link>, une soirée de <Link href="/animation-camping-interactive" className="text-[#D4AF37] hover:underline">camping</Link> ou un <Link href="/animation-bar-restaurant-interactive" className="text-[#D4AF37] hover:underline">quiz en bar</Link>. C'est pourquoi AnimaJet propose des approches dédiées :
                </p>
                <div className="grid sm:grid-cols-2 gap-3 not-prose">
                  {segments.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      className="flex items-center justify-between gap-2 px-5 py-3.5 rounded-xl card-float border-[#D4AF37]/15 hover:border-[#D4AF37]/40 text-gray-200 font-medium transition-colors"
                    >
                      {s.label}
                      <ArrowRight className="h-4 w-4 text-[#D4AF37]" />
                    </Link>
                  ))}
                </div>
                <p>
                  Dans chaque cas, l'objectif reste le même : <strong className="text-white">faire participer tout le monde</strong> et transformer l'événement en expérience mémorable.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="font-heading text-3xl font-bold text-white">Développé par un DJ animateur, pour les pros</h2>
                <p>
                  AnimaJet n'a pas été conçu dans un bureau, mais <strong className="text-white">derrière les platines</strong>. Après des années à animer mariages, soirées et événements, le fondateur a créé l'outil qu'il aurait rêvé d'avoir : une plateforme simple, fiable, qui fait participer toute la salle et qui s'affiche sur écran géant. Chaque animation a été <strong className="text-white">testée sur le terrain, en conditions réelles</strong>, soirée après soirée.
                </p>
                <p>
                  C'est cette origine qui fait la différence : AnimaJet parle le langage des professionnels de l'événementiel, parce qu'il est né de leurs contraintes — gagner du temps, garder la main, et créer de l'ambiance sans matériel compliqué.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="font-heading text-3xl font-bold text-white">Combien coûte une animation interactive ?</h2>
                <p>
                  AnimaJet propose un <strong className="text-white">abonnement mensuel à 29,90€</strong>, sans engagement et résiliable à tout moment, qui donne accès à l'ensemble des animations. Pour un besoin ponctuel, le <strong className="text-white">Pass Événement à 14,90€</strong> couvre un week-end complet. Et pour vous faire une idée, vous pouvez <strong className="text-white">tester gratuitement pendant 24h en semaine</strong>, sans carte bancaire.
                </p>
              </section>

              {/* FAQ */}
              <section className="space-y-4 not-prose">
                <h2 className="font-heading text-3xl font-bold text-white">Questions fréquentes</h2>
                <div className="space-y-3">
                  {faqs.map((f, i) => (
                    <details key={i} className="group card-float rounded-xl border-[#D4AF37]/15 px-5 [&[open]]:border-[#D4AF37]/40">
                      <summary className="flex items-center justify-between gap-4 cursor-pointer py-4 list-none [&::-webkit-details-marker]:hidden text-white font-semibold">
                        {f.q}
                        <ChevronDown className="h-5 w-5 text-[#D4AF37] flex-shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="pb-4 text-gray-400 leading-relaxed">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            </div>
          </article>

          {/* CTA final */}
          <section className="py-16 px-4 section-glow">
            <div className="max-w-3xl mx-auto text-center card-float rounded-3xl p-10 border-[#D4AF37]/25">
              <h2 className="font-heading text-3xl font-bold text-white mb-4">
                Transformez votre prochain événement
              </h2>
              <p className="text-gray-400 mb-7">
                Testez toutes les animations gratuitement pendant 24h, sans carte bancaire.
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
