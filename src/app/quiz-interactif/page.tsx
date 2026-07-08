import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/quiz-interactif'

export const metadata: Metadata = {
  title: 'Animation Quiz Interactif sur Écran Géant',
  description: 'Lancez une animation quiz interactif : vos invités répondent depuis leur téléphone, buzzer et classement en direct sur écran géant. Essai gratuit 24h.',
  keywords: ['quiz interactif', 'quiz interactif smartphone', 'quiz sans application événement', 'quiz événement interactif', 'quiz événement', 'quiz soirée', 'animation quiz', 'quiz écran géant', 'quiz smartphone', 'quiz QR code', 'blind test', 'blind test interactif', 'blind test musical', 'quiz mariage'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Animation Quiz Interactif sur Écran Géant | AnimaJet',
    description: 'Vos invités répondent depuis leur téléphone, le classement s\'affiche en direct sur écran géant.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION QUIZ',
  title: 'Le quiz interactif qui',
  highlight: 'fait monter la salle',
  intro: "Posez vos questions sur écran géant, vos invités répondent depuis leur téléphone. Le bon répondant le plus rapide marque le plus de points, et le classement se met à jour en direct. L'ambiance d'un plateau télé, sans aucune application à installer.",
  image: '/images/games/quiz.png',
  what: [
    "Le quiz interactif AnimaJet transforme n'importe quelle salle en plateau de jeu. Vous projetez les questions sur votre écran ou vidéoprojecteur, et chaque participant joue depuis son smartphone après avoir scanné un simple QR code.",
    "Chaque question est chronométrée : plus on répond vite et juste, plus on gagne de points. À la révélation de la bonne réponse, vous pouvez afficher une photo et diffuser un extrait audio pour renforcer le suspense. Le classement en temps réel pousse tout le monde à se dépasser.",
    "Vous créez vos propres questions (culture générale, spécial mariés, spécial entreprise, musique…) ou improvisez sur le moment. Tout est pensé pour que l'animateur garde la main et le rythme.",
  ],
  steps: [
    { title: 'Créez vos questions', desc: 'Saisissez vos questions et réponses, ou réutilisez un quiz existant.' },
    { title: 'Partagez le QR code', desc: 'Les invités scannent et rejoignent la partie en 5 secondes.' },
    { title: 'Lancez les manches', desc: 'Les questions s\'affichent sur écran géant, chacun répond sur son téléphone.' },
    { title: 'Révélez le podium', desc: 'Classement en direct et podium final pour couronner les champions.' },
  ],
  benefits: [
    { emoji: '⚡', title: 'Participation immédiate', desc: 'Tout le monde joue, même les plus timides : un téléphone suffit.' },
    { emoji: '📺', title: 'Spectacle sur écran géant', desc: 'Questions, buzzer, classement : l\'ambiance d\'un vrai jeu télévisé.' },
    { emoji: '🎵', title: 'Photo + audio au reveal', desc: 'Renforcez le suspense avec une image et un son sur la bonne réponse.' },
    { emoji: '🏆', title: 'Classement en temps réel', desc: 'La compétition relance l\'énergie de la salle à chaque manche.' },
    { emoji: '📱', title: 'Sans application', desc: 'Aucun téléchargement : un scan de QR code et c\'est parti.' },
    { emoji: '🎛️', title: 'L\'animateur garde la main', desc: 'Rythme, pauses, révélations : vous pilotez tout depuis votre écran.' },
  ],
  idealFor: ['DJ & animateurs', 'Mariages', 'Soirées d\'entreprise', 'Bars & restaurants', 'Campings', 'Anniversaires'],
  faq: [
    { q: 'Combien de personnes peuvent jouer au quiz en même temps ?', a: "Le quiz est conçu pour de grands groupes : de quelques invités à toute une salle. Chacun joue depuis son propre téléphone." },
    { q: 'Mes invités doivent-ils installer une application ?', a: "Non. Ils scannent le QR code affiché à l'écran et rejoignent la partie directement dans leur navigateur." },
    { q: 'Puis-je créer mes propres questions ?', a: "Oui, vous créez et personnalisez entièrement vos questions et réponses, avec photo et audio si vous le souhaitez." },
    { q: 'Le quiz fonctionne-t-il pour un mariage ?', a: "Parfaitement : quiz spécial mariés, blind test musical, questions sur les invités… c'est l'une des animations les plus appréciées en mariage." },
  ],
  related: [
    { label: 'Roue de la Destinée', href: '/roue-de-la-destinee' },
    { label: 'Photo Mystère', href: '/photo-mystere' },
    { label: 'Le Bon Ordre', href: '/le-bon-ordre' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Quiz Interactif AnimaJet',
  description: 'Quiz interactif sur écran géant où les invités répondent depuis leur téléphone, avec classement en temps réel.',
  url: URL,
  serviceType: 'Animation quiz interactif',
  faq: content.faq,
})

export default function QuizInteractifPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
