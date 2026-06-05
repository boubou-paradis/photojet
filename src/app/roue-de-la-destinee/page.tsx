import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/roue-de-la-destinee'

export const metadata: Metadata = {
  title: 'Roue de la Destinée | Roue de la Chance Interactive pour Événements',
  description: 'Une roue de la chance premium sur écran géant : gages, lots, défis. Le suspense monte à chaque tour. Animation interactive sans application. Essai gratuit 24h.',
  keywords: ['roue de la chance', 'roue de la destinée', 'roue interactive', 'roue gagnante événement', 'animation roue', 'roue jackpot', 'roue cadeaux soirée'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Roue de la Destinée | AnimaJet',
    description: 'Une roue jackpot premium sur écran géant : gages, lots et défis pour électriser votre soirée.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION ROUE',
  title: 'La Roue de la Destinée,',
  highlight: 'le grand frisson du tirage',
  intro: "Faites tourner une roue jackpot premium sur votre écran géant. Gages, lots, défis ou questions : à chaque tour, le suspense est total et toute la salle retient son souffle. Une animation simple à lancer et terriblement efficace.",
  image: '/images/games/roue-de-la-destinee.png',
  what: [
    "La Roue de la Destinée est une roue de la chance interactive, affichée en grand sur votre écran ou vidéoprojecteur. Vous définissez vous-même les segments : lots à gagner, gages à réaliser, défis à relever, ou questions surprises.",
    "Au lancement, la roue s'anime avec un rendu jackpot premium — couleurs, lumières et ralenti final — pour créer un véritable moment de suspense collectif. Idéale pour distribuer des cadeaux, pimenter une soirée ou désigner un volontaire avec le sourire.",
    "Personnalisable en quelques secondes, la roue s'adapte à tous les contextes : tombola de mariage, animation de stand, soirée de camping, jeu en bar ou temps fort de séminaire.",
  ],
  steps: [
    { title: 'Configurez les segments', desc: 'Ajoutez vos lots, gages, défis ou questions en quelques clics.' },
    { title: 'Affichez sur écran géant', desc: 'La roue premium s\'affiche en grand pour toute la salle.' },
    { title: 'Lancez le tour', desc: 'Le suspense monte pendant que la roue ralentit jusqu\'au résultat.' },
    { title: 'Révélez le gagnant', desc: 'Le segment gagnant est mis en valeur : applaudissements garantis.' },
  ],
  benefits: [
    { emoji: '🎰', title: 'Effet jackpot premium', desc: 'Un rendu lumineux et un ralenti final qui captivent toute la salle.' },
    { emoji: '🎁', title: 'Parfait pour les lots', desc: 'Distribuez cadeaux et récompenses de façon spectaculaire et équitable.' },
    { emoji: '🎭', title: 'Gages & défis', desc: 'Pimentez la soirée avec des gages drôles ou des défis à relever.' },
    { emoji: '⚙️', title: 'Personnalisable en 1 min', desc: 'Modifiez les segments à la volée selon le moment de la soirée.' },
    { emoji: '📺', title: 'Plein écran immersif', desc: 'Conçue pour le vidéoprojecteur et les grands écrans.' },
    { emoji: '🙌', title: 'Moment collectif', desc: 'Tout le monde regarde le même écran : l\'émotion est partagée.' },
  ],
  idealFor: ['DJ & animateurs', 'Tombolas de mariage', 'Soirées camping', 'Bars & clubs', 'Stands & salons', 'Séminaires'],
  faq: [
    { q: 'Puis-je mettre mes propres lots sur la roue ?', a: "Oui, vous personnalisez entièrement les segments : lots, gages, défis, questions ou prénoms." },
    { q: 'Combien de segments puis-je ajouter ?', a: "La roue accepte jusqu'à 20 segments, ce qui couvre la quasi-totalité des usages." },
    { q: 'La roue s\'affiche-t-elle bien sur vidéoprojecteur ?', a: "Oui, elle est pensée pour le plein écran et les grands affichages, avec un rendu premium." },
    { q: 'Faut-il une application pour les participants ?', a: "Non : la roue est pilotée par l'animateur et s'affiche sur l'écran. Aucune installation nécessaire." },
  ],
  related: [
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Photo Mystère', href: '/photo-mystere' },
    { label: 'Le Bon Ordre', href: '/le-bon-ordre' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Roue de la Destinée AnimaJet',
  description: 'Roue de la chance interactive premium sur écran géant avec lots, gages et défis personnalisables.',
  url: URL,
  serviceType: 'Animation roue de la chance',
  faq: content.faq,
})

export default function RouePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
