import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/animation-anniversaire'

export const metadata: Metadata = {
  title: 'Animation Anniversaire Interactive | Jeux & Photos sur Écran Géant',
  description: 'Des idées d\'animation pour anniversaire qui font participer tous les invités : quiz, photos en direct, jeux interactifs depuis le téléphone. Essai gratuit 24h.',
  keywords: ['animation anniversaire', 'idée animation anniversaire', 'jeux anniversaire adulte', 'animation fête anniversaire', 'quiz anniversaire', 'animation anniversaire interactive'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Animation Anniversaire Interactive | AnimaJet',
    description: 'Quiz, photos en direct et jeux interactifs pour un anniversaire dont on se souvient.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION ANNIVERSAIRE',
  title: 'L\'animation d\'anniversaire',
  highlight: 'dont on se souvient',
  intro: "Pour un anniversaire surprise, une fête de 30 ans ou les 60 ans de papa, AnimaJet fait participer tous les invités : quiz personnalisé sur la personne fêtée, photos en direct sur grand écran et jeux interactifs, le tout depuis leur téléphone et sans rien installer.",
  image: '/images/games/roue-de-la-destinee.png',
  what: [
    "Animer un anniversaire, c'est créer des moments où tout le monde participe, des plus jeunes aux plus âgés. Avec AnimaJet, vous lancez un quiz spécial dédié à la personne fêtée — son enfance, ses anecdotes, ses goûts — et les invités s'affrontent depuis leur smartphone, avec un classement qui s'affiche en direct sur l'écran.",
    "Entre deux jeux, le partage de photos en direct fait défiler les souvenirs envoyés par les convives, tandis que les messages de félicitations s'intercalent dans le diaporama. La Roue de la Destinée et Photo Mystère ajoutent une dose de surprise et de rire, parfaites pour relancer l'ambiance après le gâteau.",
    "Tout se met en place en quelques minutes, sans matériel compliqué : un écran ou un vidéoprojecteur, un QR code à partager, et la fête est lancée. À la fin, l'album photo reste téléchargeable pour garder une trace de la soirée.",
  ],
  steps: [
    { title: 'Préparez le quiz', desc: 'Des questions sur la personne fêtée, pour rire ensemble.' },
    { title: 'Partagez le QR code', desc: 'Les invités rejoignent en quelques secondes.' },
    { title: 'Lancez les animations', desc: 'Quiz, photos en direct, jeux surprises.' },
    { title: 'Gardez les souvenirs', desc: 'L\'album photo reste téléchargeable après la fête.' },
  ],
  benefits: [
    { emoji: '🎂', title: 'Quiz personnalisé', desc: 'Des questions sur le héros du jour, pour des fous rires garantis.' },
    { emoji: '📸', title: 'Photos en direct', desc: 'Les souvenirs des invités s\'affichent sur grand écran.' },
    { emoji: '👨‍👩‍👧', title: 'Tous les âges', desc: 'Petits et grands participent, un téléphone suffit.' },
    { emoji: '🎡', title: 'Jeux surprises', desc: 'Roue de la Destinée et Photo Mystère relancent l\'ambiance.' },
    { emoji: '⚡', title: 'Prêt en minutes', desc: 'Un écran, un QR code, et la fête commence.' },
    { emoji: '📥', title: 'Album souvenir', desc: 'Toutes les photos restent téléchargeables après la soirée.' },
  ],
  idealFor: ['Anniversaires adultes', 'Fêtes surprise', '18 / 30 / 40 / 50 ans', 'Anniversaires en famille', 'DJ & animateurs', 'Soirées entre amis'],
  faq: [
    { q: 'Quelle animation pour un anniversaire adulte ?', a: "Le quiz personnalisé sur la personne fêtée est l'animation phare : questions sur sa vie, ses anecdotes, ses goûts. Couplé aux photos en direct et aux jeux surprises, il fait participer tous les invités." },
    { q: 'Faut-il du matériel particulier ?', a: "Un écran ou un vidéoprojecteur suffit pour afficher le grand écran, et les invités jouent depuis leur propre téléphone. Aucune application à installer." },
    { q: 'Les enfants peuvent-ils participer ?', a: "Oui, dès qu'ils savent scanner un QR code et lire. Les animations conviennent à tous les âges présents à la fête." },
    { q: 'Puis-je récupérer les photos après l\'anniversaire ?', a: "Oui, toutes les photos partagées restent disponibles dans un album téléchargeable que vous pouvez garder et partager." },
  ],
  related: [
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Partage photo en direct', href: '/partage-photo-evenement' },
    { label: 'Soirée privée', href: '/animation-soiree-privee' },
    { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Animation anniversaire AnimaJet',
  description: 'Animations interactives pour anniversaire : quiz personnalisé, photos en direct et jeux sur écran géant, depuis le téléphone des invités.',
  url: URL,
  serviceType: 'Animation d\'anniversaire interactive',
  faq: content.faq,
})

export default function AnimationAnniversairePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
