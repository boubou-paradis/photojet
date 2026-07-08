import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/animation-soiree-privee'

export const metadata: Metadata = {
  title: 'Animation Soirée Privée : jeux & photos en direct',
  description: 'Quiz, blind test, photos en direct sur écran géant : l\'animation de soirée privée que vos amis n\'oublieront pas. Sans appli. Essai gratuit 24h.',
  keywords: ['animation soirée privée', 'animation soirée entre amis', 'jeux soirée privée', 'idée animation soirée', 'quiz entre amis', 'animation fête maison'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Animation Soirée Privée : jeux & photos en direct | AnimaJet',
    description: 'Quiz, blind test et photos en direct pour une soirée entre amis inoubliable.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION SOIRÉE PRIVÉE',
  title: 'La soirée entre amis',
  highlight: 'qui passe au niveau supérieur',
  intro: "Une crémaillère, un réveillon, une soirée à thème ou simplement une réunion entre amis : AnimaJet transforme votre soirée privée en moment fort grâce à un quiz, un blind test musical, des photos en direct et des jeux interactifs, tous accessibles depuis le téléphone de vos invités.",
  image: '/images/hero-animajet.png',
  what: [
    "Pas besoin d'être un professionnel pour offrir une animation digne d'un grand événement. Avec AnimaJet, vous créez votre soirée en quelques minutes, partagez un QR code, et vos amis rejoignent les jeux directement depuis leur smartphone. Le quiz et le blind test musical deviennent vite le clou de la soirée, avec un classement en direct qui réveille l'esprit de compétition.",
    "Le partage de photos en direct fait défiler sur l'écran les meilleurs moments capturés par tout le monde, et les messages s'intercalent dans le diaporama pour une ambiance conviviale. La Roue de la Destinée distribue gages et défis, parfaite pour pimenter la soirée et créer des souvenirs mémorables.",
    "Tout reste simple : un téléviseur ou un vidéoprojecteur pour l'écran, votre téléphone pour piloter, et c'est parti. Après la soirée, l'album photo reste accessible pour revivre les meilleurs moments avec votre groupe.",
  ],
  steps: [
    { title: 'Créez votre soirée', desc: 'En 2 minutes, depuis votre canapé.' },
    { title: 'Partagez le QR code', desc: 'Vos amis rejoignent en quelques secondes.' },
    { title: 'Lancez quiz & jeux', desc: 'Blind test, photos en direct, défis surprises.' },
    { title: 'Revivez la soirée', desc: 'L\'album photo reste accessible après.' },
  ],
  benefits: [
    { emoji: '🎵', title: 'Blind test musical', desc: 'L\'animation qui met tout le monde d\'accord, classement en direct.' },
    { emoji: '📸', title: 'Photos en direct', desc: 'Les meilleurs moments s\'affichent en grand sur l\'écran.' },
    { emoji: '🎲', title: 'Défis & gages', desc: 'La Roue de la Destinée pimente la soirée.' },
    { emoji: '🙌', title: 'Sans être pro', desc: 'Tout se met en place en quelques minutes, sans compétence.' },
    { emoji: '📱', title: 'Sans application', desc: 'Vos amis jouent depuis leur navigateur, un QR code suffit.' },
    { emoji: '📥', title: 'Album partagé', desc: 'Gardez et partagez toutes les photos après la soirée.' },
  ],
  idealFor: ['Soirées entre amis', 'Crémaillères', 'Réveillons', 'Soirées à thème', 'Fêtes maison', 'EVJF / EVG'],
  faq: [
    { q: 'Faut-il être animateur professionnel pour utiliser AnimaJet ?', a: "Non, pas du tout. AnimaJet est conçu pour être pris en main en quelques minutes : vous créez la soirée, partagez un QR code et lancez les jeux, même sans aucune expérience d'animation." },
    { q: 'Le blind test musical est-il possible pour une soirée privée ?', a: "Oui. Le quiz interactif permet de créer un blind test : vous diffusez des extraits et vos amis répondent depuis leur téléphone, avec un classement en temps réel." },
    { q: 'De quel matériel ai-je besoin ?', a: "Un téléviseur ou un vidéoprojecteur pour afficher le grand écran, et le téléphone de chacun pour participer. Rien d'autre à installer." },
    { q: 'Combien d\'amis peuvent participer ?', a: "De quelques personnes à un grand groupe : chacun joue depuis son propre téléphone, sans limite contraignante pour une soirée privée." },
  ],
  related: [
    { label: 'Quiz & blind test', href: '/quiz-interactif' },
    { label: 'Photo Mystère', href: '/photo-mystere' },
    { label: 'Anniversaire', href: '/animation-anniversaire' },
    { label: 'Partage photo en direct', href: '/partage-photo-evenement' },
    { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Animation soirée privée AnimaJet',
  description: 'Animations interactives pour soirée privée entre amis : quiz, blind test musical, photos en direct et jeux depuis le téléphone.',
  url: URL,
  serviceType: 'Animation de soirée privée interactive',
  faq: content.faq,
})

export default function AnimationSoireePriveePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
