import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/animation-mariage-interactive'

export const metadata: Metadata = {
  title: 'Animation Mariage Interactive | Photo Booth & Jeux pour Mariage',
  description: 'Animation mariage interactive : photos des invités en direct sur écran géant, quiz musical, jeux interactifs. Vos invités participent, votre soirée décolle. Essai gratuit 24h.',
  keywords: [
    'animation mariage',
    'animation de mariage',
    'photo booth mariage',
    'animation soirée mariage',
    'jeux mariage',
    'diaporama mariage',
    'borne photo mariage',
    'quiz musical mariage',
    'animation invités mariage',
  ],
  alternates: {
    canonical: URL,
  },
  openGraph: {
    title: 'Animation Mariage Interactive | AnimaJet',
    description: 'Photos en direct, quiz musical, jeux interactifs. L\'animation parfaite pour votre mariage.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION MARIAGE INTERACTIVE',
  title: 'Le mariage où tous les invités',
  highlight: 'participent vraiment',
  intro: "Des grands-parents aux enfants, faites vivre votre mariage à tout le monde : quiz spécial mariés et blind test musical, photos des invités en direct sur écran géant, jeux interactifs et borne photo, le tout depuis un simple téléphone, sans application.",
  image: '/photo-qr-partage.png',
  what: [
    "Le jour J, l'enjeu d'une animation de mariage est de réunir des générations et des univers très différents autour d'un même moment. AnimaJet y répond avec des animations participatives : le quiz « connaissez-vous les mariés ? » et le blind test musical lancent les rires et les applaudissements, pendant que le partage photo fait défiler sur l'écran les clichés pris par chacun, en temps réel.",
    "Tout passe par un QR code : les invités le scannent, rejoignent l'animation en quelques secondes et participent depuis leur navigateur. Pas d'application à installer, pas de compte à créer — même les invités les moins à l'aise avec la technologie jouent sans difficulté. L'écran géant devient le cœur de la soirée, et la borne photo prolonge l'expérience avec impression et album partagé.",
    "Que vous soyez les mariés qui organisent ou un DJ qui anime, la mise en place tient en quelques minutes et vous gardez la main du début à la fin. Après la fête, l'album photo reste accessible pour revivre les meilleurs moments et les partager avec vos proches.",
  ],
  steps: [
    { title: 'Créez votre mariage', desc: 'Nom des mariés, date, photo et couleurs personnalisées.' },
    { title: 'Partagez le QR code', desc: 'Sur les tables, le faire-part ou l\'écran d\'accueil.' },
    { title: 'Lancez les animations', desc: 'Quiz des mariés, blind test, photos en direct, jeux.' },
    { title: 'Gardez les souvenirs', desc: 'L\'album photo reste accessible après la fête.' },
  ],
  benefits: [
    { emoji: '💍', title: 'Quiz spécial mariés', desc: '« Connaissez-vous les mariés ? » : le jeu qui fait rire toute la salle.' },
    { emoji: '🎵', title: 'Blind test musical', desc: 'Classement en direct, parfait pour réchauffer la piste.' },
    { emoji: '📸', title: 'Photos en direct', desc: 'Les clichés des invités s\'affichent en grand, en temps réel.' },
    { emoji: '👵', title: 'Tous les âges', desc: 'Des enfants aux grands-parents : un QR code et tout le monde joue.' },
    { emoji: '🖨️', title: 'Borne photo', desc: 'Impression sur place et album partagé téléchargeable.' },
    { emoji: '📱', title: 'Sans application', desc: 'Aucune installation, ni pour vous ni pour vos invités.' },
  ],
  idealFor: ['Futurs mariés', 'DJ de mariage', 'Wedding planners', 'Animateurs', 'Photographes', 'Salles de réception'],
  faq: [
    { q: 'Quelle animation de mariage choisir pour faire participer tout le monde ?', a: "Le quiz « connaissez-vous les mariés ? », le blind test musical et le partage photo en direct sont les plus fédérateurs : ils font participer toutes les générations, depuis le téléphone de chacun, sans exclure personne." },
    { q: 'Les invités doivent-ils télécharger une application ?', a: "Non. Ils scannent un QR code (sur les tables ou l'écran) et participent directement dans leur navigateur. Aucune application, aucun compte à créer." },
    { q: 'Peut-on personnaliser l\'animation aux couleurs du mariage ?', a: "Oui. Vous affichez votre photo, vos couleurs et le nom des mariés sur les écrans et les QR codes pour une ambiance totalement à votre image." },
    { q: 'Récupère-t-on les photos après le mariage ?', a: "Oui. Toutes les photos partagées sont rassemblées dans un album accessible après l'événement, que vous pouvez télécharger et partager avec vos invités." },
  ],
  related: [
    { label: 'Blind test mariage', href: '/blind-test-mariage' },
    { label: 'Diaporama live mariage', href: '/diaporama-live-mariage' },
    { label: 'Quiz de mariage', href: '/quiz-mariage' },
    { label: 'Logiciel DJ mariage', href: '/logiciel-dj-mariage' },
    { label: 'Partage photo en direct', href: '/partage-photo-evenement' },
    { label: 'Pour les DJ & animateurs', href: '/animation-dj-interactive' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Animation Mariage Interactive AnimaJet',
  description: 'Animation de mariage interactive : quiz des mariés, blind test musical, photos en direct sur écran géant, jeux et borne photo, sans application.',
  url: URL,
  serviceType: 'Animation de mariage',
  faq: content.faq,
})

export default function AnimationMariage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
