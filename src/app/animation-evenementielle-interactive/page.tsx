import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/animation-evenementielle-interactive'

export const metadata: Metadata = {
  title: 'Animation Événementielle Interactive | Photos & Jeux en Direct',
  description: 'Solution d\'animation événementielle interactive : photos en direct sur écran géant, 4 jeux interactifs (quiz, roue de la destinée, photo mystère, le bon ordre), QR codes personnalisés. Idéal pour tous types d\'événements. Essai gratuit 24h.',
  keywords: [
    'animation événementielle',
    'animation interactive',
    'animation soirée',
    'photo booth événement',
    'jeux interactifs événement',
    'diaporama en direct',
    'animation QR code',
    'écran géant événement',
  ],
  alternates: {
    canonical: URL,
  },
  openGraph: {
    title: 'Animation Événementielle Interactive | AnimaJet',
    description: 'Photos en direct, 4 jeux interactifs, QR codes personnalisés. La solution complète pour animer tous vos événements.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION ÉVÉNEMENTIELLE INTERACTIVE',
  title: 'La solution complète pour',
  highlight: 'animer tous vos événements',
  intro: "Photos en direct sur écran géant, quatre jeux interactifs (quiz, roue de la destinée, photo mystère, le bon ordre) et QR codes personnalisés : AnimaJet est la boîte à outils des professionnels qui orchestrent des événements et veulent faire participer leur public, sans application.",
  image: '/photo-qr-partage.png',
  what: [
    "Quel que soit l'événement — lancement de produit, festival, soirée de gala, inauguration ou événement grand public — l'enjeu est le même : capter l'attention et faire vivre quelque chose au public plutôt que de le laisser spectateur. AnimaJet regroupe en une seule plateforme tout ce qu'il faut pour cela : du partage photo en direct qui anime l'écran géant aux jeux interactifs qui mettent l'assistance en mouvement.",
    "Le principe est universel et sans friction : un QR code s'affiche, les participants le scannent et rejoignent l'animation depuis leur navigateur, sans rien installer. L'organisateur pilote le déroulé depuis un ordinateur et garde la main du début à la fin. Chaque animation est personnalisable à la marque de l'événement ou du client, ce qui en fait un outil de prestation à part entière pour les agences et les prestataires.",
    "Pour une agence événementielle, un organisateur ou un prestataire technique, AnimaJet remplace une accumulation d'outils disparates par une solution unique, fiable et testée sur le terrain. L'essai gratuit de 24h permet de la prendre en main avant un événement client.",
  ],
  steps: [
    { title: 'Configurez l\'événement', desc: 'Jeux, photos, QR codes personnalisés à la marque.' },
    { title: 'Diffusez le QR code', desc: 'À l\'écran, sur les supports ou les badges.' },
    { title: 'Faites participer le public', desc: 'Quiz, jeux et photos s\'affichent en direct sur écran géant.' },
    { title: 'Pilotez en temps réel', desc: 'Vous gardez la main sur le rythme du début à la fin.' },
  ],
  benefits: [
    { emoji: '🎮', title: '4 jeux interactifs', desc: 'Quiz, roue de la destinée, photo mystère et le bon ordre.' },
    { emoji: '📸', title: 'Photos en direct', desc: 'L\'écran géant s\'anime des clichés du public, en temps réel.' },
    { emoji: '🏷️', title: 'Personnalisable à la marque', desc: 'Logo et couleurs de l\'événement ou du client sur tous les écrans.' },
    { emoji: '🧰', title: 'Une seule plateforme', desc: 'Remplace plusieurs outils par une solution unique et fiable.' },
    { emoji: '🎛️', title: 'Pilotage en direct', desc: 'L\'organisateur garde le contrôle du déroulé à tout moment.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un QR code suffit, aucune installation pour le public.' },
  ],
  idealFor: ['Agences événementielles', 'Organisateurs d\'événements', 'Prestataires techniques', 'DJ & animateurs', 'Festivals', 'Soirées de gala'],
  faq: [
    { q: 'AnimaJet s\'adapte-t-il à tous les types d\'événements ?', a: "Oui. De la soirée privée au festival, en passant par les galas, lancements de produit et événements d'entreprise, les animations s'adaptent à tous les formats et toutes les tailles d'audience." },
    { q: 'Peut-on personnaliser l\'animation à la marque du client ?', a: "Oui. Logo, couleurs et arrière-plan sont personnalisables : l'animation porte l'identité de l'événement ou de votre client, ce qui en fait un véritable outil de prestation." },
    { q: 'Combien de personnes peuvent participer en même temps ?', a: "Chaque participant joue depuis son propre téléphone : l'animation convient aussi bien à un petit comité qu'à un grand public de plusieurs centaines de personnes." },
    { q: 'Faut-il installer un logiciel ?', a: "Non. L'organisateur pilote depuis un navigateur et le public scanne un QR code. Aucune application à installer, ni pour vous ni pour les participants." },
  ],
  related: [
    { label: 'Pour les DJ & animateurs', href: '/animation-dj-interactive' },
    { label: 'Animation entreprise', href: '/animation-entreprise-interactive' },
    { label: 'Le guide des animations', href: '/animations-interactives-evenementielles' },
    { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Animation Événementielle Interactive AnimaJet',
  description: 'Solution d\'animation événementielle interactive : photos en direct, 4 jeux interactifs et QR codes personnalisés sur écran géant, sans application.',
  url: URL,
  serviceType: 'Animation événementielle',
  faq: content.faq,
})

export default function AnimationEvenementielle() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
