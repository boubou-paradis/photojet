import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/animation-entreprise-interactive'

export const metadata: Metadata = {
  title: 'Animation Entreprise Interactive | Team Building & Événements Corporate',
  description: 'Animation entreprise interactive : séminaires, team building, soirées corporate. Photos en direct, quiz personnalisés, jeux d\'équipe. Renforcez la cohésion. Essai gratuit 24h.',
  keywords: [
    'animation entreprise',
    'animation soirée entreprise',
    'animation team building',
    'animation séminaire',
    'animation corporate',
    'jeux entreprise',
    'soirée entreprise',
    'animation CE',
    'événement corporate',
  ],
  alternates: {
    canonical: URL,
  },
  openGraph: {
    images: [{ url: '/images/animajet_logo_principal.png', width: 1200, height: 630, alt: 'AnimaJet - Animation interactive pour événements' }],
    title: 'Animation Entreprise Interactive | AnimaJet',
    description: 'Team building, séminaires, soirées corporate. Renforcez la cohésion avec des animations interactives.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION ENTREPRISE INTERACTIVE',
  title: 'L\'animation qui fédère',
  highlight: 'vos équipes',
  intro: "Séminaire, team building, soirée de fin d'année ou événement de CE : AnimaJet transforme vos rassemblements professionnels en moments de cohésion. Quiz personnalisés aux couleurs de l'entreprise, jeux d'équipe et photos en direct, tout depuis le téléphone des collaborateurs, sans application.",
  image: '/images/games/quiz.png',
  what: [
    "Réunir des collaborateurs autour d'un objectif commun, sans que personne ne reste spectateur : c'est tout l'enjeu d'une animation d'entreprise réussie. Avec AnimaJet, vous créez un quiz sur mesure (culture d'entreprise, valeurs, anecdotes internes) ou un blind test, et les équipes s'affrontent en direct sur écran géant. Le classement temps réel crée une émulation saine et beaucoup de rires.",
    "Tout repose sur un QR code : chaque participant le scanne et rejoint l'animation depuis son navigateur, sans installation ni compte. Le partage de photos en direct immortalise le séminaire ou la soirée, et l'album reste accessible ensuite pour la communication interne. Vous gardez la main sur le rythme depuis un ordinateur, et l'animation s'adapte aussi bien à une salle de réunion qu'à une grande soirée.",
    "Pour un service RH, un comité d'entreprise ou une agence événementielle B2B, AnimaJet est l'outil qui professionnalise l'animation : personnalisable à la marque de l'entreprise cliente, simple à déployer, et mémorable pour les participants. L'essai gratuit de 24h permet de préparer votre événement en conditions réelles.",
  ],
  steps: [
    { title: 'Préparez le contenu', desc: 'Quiz sur mesure, blind test, photos aux couleurs de l\'entreprise.' },
    { title: 'Partagez le QR code', desc: 'Les collaborateurs rejoignent en quelques secondes.' },
    { title: 'Lancez les jeux d\'équipe', desc: 'Classement en direct, émulation et cohésion garanties.' },
    { title: 'Valorisez l\'événement', desc: 'L\'album photo alimente votre communication interne.' },
  ],
  benefits: [
    { emoji: '🧩', title: 'Quiz sur mesure', desc: 'Culture d\'entreprise, valeurs, anecdotes : un contenu 100 % personnalisé.' },
    { emoji: '🤝', title: 'Cohésion d\'équipe', desc: 'Les équipes s\'affrontent et collaborent en direct sur écran géant.' },
    { emoji: '📸', title: 'Photos en direct', desc: 'Le séminaire ou la soirée immortalisés en temps réel.' },
    { emoji: '🏷️', title: 'Aux couleurs de la marque', desc: 'Logo et identité de l\'entreprise sur tous les écrans.' },
    { emoji: '🪑', title: 'Salle ou grande soirée', desc: 'S\'adapte du séminaire intime à l\'événement de centaines de personnes.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un QR code suffit, aucun téléchargement pour les participants.' },
  ],
  idealFor: ['Services RH', 'Comités d\'entreprise (CE/CSE)', 'Team building', 'Séminaires', 'Soirées de fin d\'année', 'Agences événementielles B2B'],
  faq: [
    { q: 'Peut-on personnaliser le quiz avec le contenu de l\'entreprise ?', a: "Oui. Vous créez vos propres questions (culture d'entreprise, valeurs, anecdotes internes) et affichez le logo et les couleurs de la société sur les écrans, pour une animation entièrement sur mesure." },
    { q: 'AnimaJet convient-il à un team building ?', a: "Tout à fait. Les quiz et jeux par équipes, avec classement en direct sur écran géant, créent une émulation et une cohésion idéales pour un team building, en salle comme en grande soirée." },
    { q: 'Combien de collaborateurs peuvent participer ?', a: "Chaque participant joue depuis son propre téléphone : l'animation s'adapte aussi bien à un petit séminaire qu'à une soirée de plusieurs centaines de personnes." },
    { q: 'Faut-il installer un logiciel ou une application ?', a: "Non. L'organisateur pilote depuis un simple navigateur et les participants scannent un QR code : aucune installation, aucun compte à créer." },
  ],
  related: [
    { label: 'Quiz & blind test', href: '/quiz-interactif' },
    { label: 'Le Bon Ordre (jeu d\'équipe)', href: '/le-bon-ordre' },
    { label: 'Photo Mystère', href: '/photo-mystere' },
    { label: 'Pour l\'événementiel', href: '/animation-evenementielle-interactive' },
    { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Animation Entreprise Interactive AnimaJet',
  description: 'Animation interactive pour entreprises : team building, séminaires et soirées corporate avec quiz personnalisés, jeux d\'équipe et photos en direct, sans application.',
  url: URL,
  serviceType: 'Animation entreprise',
  faq: content.faq,
})

export default function AnimationEntreprise() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
