import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/animation-dj-interactive'

export const metadata: Metadata = {
  title: 'Animation DJ Interactive | Outils pour DJ & Animateurs',
  description: 'Outils d\'animation pour DJ et animateurs : photos en direct, quiz interactifs, roue de la fortune. Professionnalisez vos prestations. Essai gratuit 24h.',
  keywords: [
    'animation DJ',
    'outils DJ',
    'logiciel animation DJ',
    'logiciel animation',
    'outil DJ animateur',
    'plateforme animation soirée',
    'quiz musical',
    'animation animateur',
    'borne photo DJ',
    'diaporama DJ',
  ],
  alternates: {
    canonical: URL,
  },
  openGraph: {
    images: [{ url: '/images/animajet_logo_principal.png', width: 1200, height: 630, alt: 'AnimaJet - Animation interactive pour événements' }],
    title: 'Animation DJ Interactive | AnimaJet',
    description: 'Photos en direct, quiz interactifs. L\'outil indispensable pour DJ et animateurs professionnels.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION DJ INTERACTIVE',
  title: 'L\'outil indispensable',
  highlight: 'des DJ & animateurs',
  intro: "Vous êtes DJ ou animateur et vous voulez offrir plus qu'un simple mix ? AnimaJet ajoute à vos prestations une couche d'animation interactive : quiz et blind test, photos en direct sur écran géant, roue de la fortune et jeux que vos invités pilotent depuis leur téléphone, sans application.",
  image: '/hero-animajet-1.jpg',
  what: [
    "AnimaJet a été conçu par un DJ animateur, pour les DJ animateurs. L'idée est simple : vous donner des animations prêtes à lancer qui font participer toute la salle, sans alourdir votre installation ni vous voler la vedette. Entre deux sets, vous lancez un quiz musical, une roue de la fortune ou un partage photo en direct, et l'énergie remonte instantanément.",
    "Tout fonctionne sans application : vos invités scannent un QR code et rejoignent l'animation en quelques secondes. Vous gardez la main depuis votre ordinateur ou votre tablette, exactement comme vous gérez votre mix. Les résultats, classements et photos s'affichent en direct sur l'écran géant, pour une ambiance collective impossible à obtenir avec une animation passive.",
    "C'est aussi un argument commercial : vous proposez une prestation premium et différenciante, vous affichez votre logo et vos couleurs (jamais les nôtres), et vous justifiez un tarif à la hauteur. L'essai gratuit de 24h vous permet de tester en conditions réelles avant votre prochaine date.",
  ],
  steps: [
    { title: 'Créez l\'événement', desc: 'Nom, date, personnalisation à votre marque, en 2 minutes.' },
    { title: 'Partagez le QR code', desc: 'Vos invités rejoignent les animations en 5 secondes.' },
    { title: 'Lancez les animations', desc: 'Quiz, blind test, roue, photos en direct entre vos sets.' },
    { title: 'Faites monter la salle', desc: 'Classements et écran géant relancent l\'ambiance.' },
  ],
  benefits: [
    { emoji: '🎧', title: 'Pensé par un DJ', desc: 'Conçu pour s\'intégrer à votre prestation, pas la remplacer.' },
    { emoji: '🎵', title: 'Quiz & blind test', desc: 'L\'animation phare, avec classement en direct sur écran géant.' },
    { emoji: '🎡', title: 'Roue de la fortune', desc: 'Lots, gages et défis dans un suspense total.' },
    { emoji: '📸', title: 'Photos en direct', desc: 'L\'écran s\'anime des souvenirs envoyés par les invités.' },
    { emoji: '🏷️', title: 'Votre marque', desc: 'Logo et couleurs personnalisés : c\'est VOUS qu\'on voit.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un QR code suffit, vos invités jouent en quelques secondes.' },
  ],
  idealFor: ['DJ', 'Animateurs', 'MC / Maîtres de cérémonie', 'Organisateurs d\'événements', 'Agences événementielles', 'Prestataires son & lumière'],
  faq: [
    { q: 'AnimaJet remplace-t-il mon matériel de DJ ?', a: "Non, c'est un complément. AnimaJet ajoute une couche d'animation interactive (quiz, blind test, roue, photos en direct) qui s'intègre entre vos sets, sans rien changer à votre installation son et lumière." },
    { q: 'Faut-il que les invités installent une application ?', a: "Non. Vos invités scannent un QR code avec l'appareil photo de leur téléphone et participent directement dans leur navigateur, sans aucune installation." },
    { q: 'Puis-je personnaliser l\'outil à ma marque ?', a: "Oui. Vous affichez votre logo et votre arrière-plan sur les écrans et les QR codes : ce sont votre identité et vos couleurs que les invités voient, pas celles d'AnimaJet." },
    { q: 'Comment tester avant une vraie prestation ?', a: "L'essai gratuit de 24h (en semaine, sans carte bancaire) vous donne accès à toutes les fonctionnalités pour vous entraîner en conditions réelles." },
  ],
  related: [
    { label: 'Logiciel DJ mariage', href: '/logiciel-dj-mariage' },
    { label: 'Animation de mariage', href: '/animation-mariage-interactive' },
    { label: 'Quiz & blind test', href: '/quiz-interactif' },
    { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'AnimaJet pour DJ & animateurs',
  description: 'Plateforme d\'animation interactive pour DJ et animateurs : quiz et blind test, roue de la fortune, photos en direct sur écran géant, sans application.',
  url: URL,
  serviceType: 'Animation pour DJ et animateurs',
  faq: content.faq,
})

export default function AnimationDJ() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
