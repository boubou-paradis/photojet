import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/animation-camping-interactive'

export const metadata: Metadata = {
  title: 'Animation Camping Interactive | Soirées & Jeux pour Vacanciers',
  description: 'Animez vos soirées camping : quiz, roue de la destinée, photo mystère et partage photo en direct sur écran géant. Vos vacanciers participent depuis leur téléphone, sans application. Essai gratuit 24h.',
  keywords: [
    'animation camping',
    'animation camping interactive',
    'soirée camping',
    'animation vacanciers',
    'jeux camping',
    'quiz camping',
    'animation club enfants camping',
    'soirée animation camping',
    'écran géant camping',
  ],
  alternates: {
    canonical: URL,
  },
  openGraph: {
    title: 'Animation Camping Interactive | AnimaJet',
    description: 'Quiz, jeux interactifs et partage photo en direct. Faites participer tous vos vacanciers depuis leur téléphone.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION CAMPING INTERACTIVE',
  title: 'Des soirées camping',
  highlight: 'dont tout le monde se souvient',
  intro: "Quiz familial, roue de la destinée, photo mystère et partage photo en direct sur écran géant : AnimaJet anime vos soirées de camping et fait participer familles et vacanciers depuis leur téléphone, sans application ni matériel compliqué à installer.",
  image: '/images/games/roue-de-la-destinee.png',
  what: [
    "Au camping, une bonne soirée d'animation rassemble des familles entières, des enfants aux grands-parents, autour de l'écran de la salle commune ou de la terrasse du bar. AnimaJet propose des jeux pensés pour cette ambiance conviviale : un quiz accessible à tous, une roue de la destinée qui distribue défis et petits lots, et une photo mystère qui fait monter le suspense manche après manche.",
    "Le fonctionnement est idéal pour un public de vacances : un QR code affiché à l'écran, les vacanciers le scannent avec leur téléphone et jouent immédiatement, sans rien installer. Le partage de photos en direct fait défiler les souvenirs de la semaine sur grand écran, et crée une vraie vie de groupe entre les campeurs. L'animateur pilote tout depuis une tablette ou un ordinateur, sans stress.",
    "Pour un camping, un village vacances ou une base de loisirs, c'est une animation clé en main qui renouvelle le programme des soirées sans investir dans du matériel lourd. L'essai gratuit de 24h permet de tester avant la haute saison.",
  ],
  steps: [
    { title: 'Créez la soirée', desc: 'Quiz, roue, photo mystère : en quelques minutes.' },
    { title: 'Affichez le QR code', desc: 'Sur l\'écran de la salle commune ou du bar.' },
    { title: 'Les vacanciers jouent', desc: 'Familles et enfants participent depuis leur téléphone.' },
    { title: 'Animez toute la semaine', desc: 'Renouvelez les jeux soir après soir.' },
  ],
  benefits: [
    { emoji: '👨‍👩‍👧‍👦', title: 'Pour toute la famille', desc: 'Des enfants aux grands-parents : un QR code et tout le monde joue.' },
    { emoji: '🎡', title: 'Roue de la destinée', desc: 'Défis et petits lots dans un suspense qui amuse tous les âges.' },
    { emoji: '🖼️', title: 'Photo mystère', desc: 'Une photo se dévoile peu à peu : qui devinera en premier ?' },
    { emoji: '📸', title: 'Souvenirs de la semaine', desc: 'Les photos des vacanciers défilent en direct sur grand écran.' },
    { emoji: '🧳', title: 'Sans matériel lourd', desc: 'Un écran et une connexion suffisent : rien à transporter.' },
    { emoji: '📱', title: 'Sans application', desc: 'Aucun téléchargement, parfait pour un public de passage.' },
  ],
  idealFor: ['Campings', 'Villages vacances', 'Clubs vacances', 'Mobil-homes & résidences', 'Bases de loisirs', 'Animateurs saisonniers'],
  faq: [
    { q: 'Les vacanciers doivent-ils installer une application ?', a: "Non. Ils scannent un QR code affiché à l'écran et jouent directement depuis leur navigateur. C'est idéal pour un public de passage qui change chaque semaine." },
    { q: 'Les animations conviennent-elles aux enfants comme aux adultes ?', a: "Oui. Le quiz, la roue de la destinée et la photo mystère sont pensés pour réunir toutes les générations autour du même écran, dans une ambiance familiale." },
    { q: 'Quel matériel faut-il prévoir au camping ?', a: "Un écran ou un vidéoprojecteur dans la salle commune ou au bar, une connexion internet, et une tablette ou un ordinateur pour piloter. Les vacanciers utilisent leur propre téléphone." },
    { q: 'Peut-on animer plusieurs soirées dans la semaine ?', a: "Oui. Vous renouvelez les jeux et les questions autant de fois que vous le souhaitez pour proposer un programme varié tout au long du séjour." },
  ],
  related: [
    { label: 'Centres de vacances', href: '/animation-centre-vacances' },
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Photo Mystère', href: '/photo-mystere' },
    { label: 'Partage photo en direct', href: '/partage-photo-evenement' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Animation Camping Interactive AnimaJet',
  description: 'Animation interactive pour campings et villages vacances : quiz familial, roue de la destinée, photo mystère et partage photo en direct, sans application.',
  url: URL,
  serviceType: 'Animation camping',
  faq: content.faq,
})

export default function AnimationCamping() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
