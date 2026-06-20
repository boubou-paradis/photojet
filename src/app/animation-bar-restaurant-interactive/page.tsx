import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/animation-bar-restaurant-interactive'

export const metadata: Metadata = {
  title: 'Animation Bar & Restaurant | Blind Test, Quiz & Soirées Interactives',
  description: 'Remplissez votre bar ou restaurant en semaine : soirées quiz, jeux interactifs et partage photo en direct sur écran géant. Vos clients jouent depuis leur téléphone, sans application. Essai gratuit 24h.',
  keywords: [
    'animation bar',
    'animation restaurant',
    'animation bar restaurant',
    'soirée quiz bar',
    'blind test bar',
    'quiz restaurant',
    'fidélisation clientèle bar',
    'soirée à thème bar',
    'animation pub brasserie',
  ],
  alternates: {
    canonical: URL,
  },
  openGraph: {
    title: 'Animation Bar & Restaurant Interactive | AnimaJet',
    description: 'Soirées quiz et jeux interactifs pour remplir votre établissement et fidéliser vos clients.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION BAR & RESTAURANT',
  title: 'Remplissez votre salle',
  highlight: 'avec des soirées interactives',
  intro: "Soirée quiz, blind test musical, jeux interactifs et partage photo en direct sur écran géant : AnimaJet anime votre bar ou votre restaurant et fait jouer vos clients depuis leur téléphone. De quoi remplir votre salle en semaine et fidéliser votre clientèle, sans application.",
  image: '/hero-animajet-1.jpg',
  what: [
    "Une soirée quiz ou un blind test, c'est l'animation qui transforme un soir creux en salle comble. Avec AnimaJet, vous lancez votre soirée à thème en quelques minutes : les clients scannent un QR code posé sur les tables, répondent depuis leur téléphone, et le classement s'affiche en direct sur l'écran de l'établissement. L'ambiance monte, les tablées s'affrontent, et les clients restent plus longtemps — et consomment davantage.",
    "Le blind test musical est un format particulièrement efficace en bar : vous diffusez des extraits, les équipes buzzent depuis leur navigateur, et le suspense fait vibrer toute la salle. Le partage de photos en direct anime aussi les soirées plus festives, tandis que la roue de la destinée permet de distribuer des lots maison (une tournée, un dessert, une réduction) pour récompenser les gagnants.",
    "Pour un bar, un pub, une brasserie ou un restaurant, c'est une animation récurrente et rentable : pas de matériel à louer, un rendez-vous hebdomadaire qui fidélise, et votre établissement à votre image sur l'écran. L'essai gratuit de 24h permet de tester votre première soirée sans engagement.",
  ],
  steps: [
    { title: 'Préparez votre soirée', desc: 'Quiz, blind test ou jeux, en quelques minutes.' },
    { title: 'Posez les QR codes', desc: 'Sur les tables et au comptoir.' },
    { title: 'Les clients jouent', desc: 'Les tablées s\'affrontent, le classement s\'affiche en direct.' },
    { title: 'Fidélisez', desc: 'Un rendez-vous hebdomadaire qui remplit votre salle.' },
  ],
  benefits: [
    { emoji: '🎵', title: 'Blind test musical', desc: 'Le format star des soirées bar, classement en temps réel.' },
    { emoji: '📈', title: 'Salle remplie en semaine', desc: 'Un rendez-vous qui attire et retient la clientèle.' },
    { emoji: '🍻', title: 'Lots maison', desc: 'La roue distribue tournées, desserts ou réductions aux gagnants.' },
    { emoji: '🔁', title: 'Animation récurrente', desc: 'Renouvelez quiz et thèmes chaque semaine, sans effort.' },
    { emoji: '🏷️', title: 'À votre enseigne', desc: 'Votre logo et vos couleurs sur l\'écran de l\'établissement.' },
    { emoji: '📱', title: 'Sans application', desc: 'Vos clients scannent un QR code et jouent, sans rien installer.' },
  ],
  idealFor: ['Bars & pubs', 'Restaurants', 'Brasseries', 'Clubs & discothèques', 'Cafés-concerts', 'Établissements à thème'],
  faq: [
    { q: 'Comment organiser une soirée quiz dans mon bar ?', a: "Vous créez votre quiz ou blind test en quelques minutes, posez des QR codes sur les tables et affichez l'écran de jeu sur votre téléviseur. Les clients répondent depuis leur téléphone et le classement s'actualise en direct." },
    { q: 'Le blind test musical est-il inclus ?', a: "Oui. Le quiz interactif permet de créer un blind test : vous diffusez un extrait, les équipes répondent depuis leur navigateur, et le classement s'affiche en temps réel sur l'écran." },
    { q: 'Faut-il du matériel particulier ?', a: "Un écran ou un téléviseur, une connexion internet et un appareil pour piloter suffisent. Aucun boîtier ni télécommande à louer : vos clients utilisent leur propre téléphone." },
    { q: 'Est-ce rentable pour fidéliser la clientèle ?', a: "Une soirée quiz hebdomadaire crée un rendez-vous récurrent qui attire les clients en semaine et les fait rester plus longtemps. Sans coût de matériel, l'animation s'amortit rapidement." },
  ],
  related: [
    { label: 'Quiz & blind test', href: '/quiz-interactif' },
    { label: 'Roue de la Destinée', href: '/roue-de-la-destinee' },
    { label: 'Photo Mystère', href: '/photo-mystere' },
    { label: 'Pour l\'événementiel', href: '/animation-evenementielle-interactive' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Animation Bar & Restaurant Interactive AnimaJet',
  description: 'Animation interactive pour bars et restaurants : soirées quiz, blind test musical, jeux et partage photo en direct sur écran géant, sans application.',
  url: URL,
  serviceType: 'Animation bar et restaurant',
  faq: content.faq,
})

export default function AnimationBarRestaurant() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
