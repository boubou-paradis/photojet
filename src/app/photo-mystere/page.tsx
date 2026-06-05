import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/photo-mystere'

export const metadata: Metadata = {
  title: 'Photo Mystère | Jeu de Photo à Deviner sur Écran Géant',
  description: 'Une photo se dévoile peu à peu sur écran géant : le premier qui devine gagne. Un jeu interactif simple et addictif où vos invités jouent depuis leur téléphone. Essai gratuit 24h.',
  keywords: ['photo mystère', 'jeu photo deviner', 'jeu image cachée', 'animation photo événement', 'jeu interactif soirée', 'devine la photo'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Photo Mystère | AnimaJet',
    description: 'Une photo se dévoile progressivement, le premier qui devine remporte la manche.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION PHOTO MYSTÈRE',
  title: 'Photo Mystère,',
  highlight: 'le jeu qui rend accro',
  intro: "Une photo apparaît floutée ou dévoilée petit à petit sur l'écran géant. Le premier de vos invités à reconnaître l'image remporte la manche. Simple à comprendre, impossible à lâcher : Photo Mystère embarque toute la salle en quelques secondes.",
  image: '/images/games/photo-mystere.png',
  what: [
    "Photo Mystère est un jeu de devinette visuel projeté sur votre écran. L'image se révèle progressivement — floutée puis nette, ou dévoilée morceau par morceau — pendant que vos invités tentent de l'identifier depuis leur téléphone.",
    "Vous choisissez vos propres photos : célébrités, lieux, objets, ou images personnalisées (les mariés enfants, le logo d'une entreprise, des clins d'œil à la soirée). Plus on devine vite, plus on marque de points.",
    "C'est l'animation parfaite pour relancer l'attention entre deux temps forts : courte, visuelle et universelle, elle fonctionne avec tous les publics, des enfants aux grands-parents.",
  ],
  steps: [
    { title: 'Importez vos photos', desc: 'Ajoutez les images à faire deviner, personnalisées si besoin.' },
    { title: 'Partagez le QR code', desc: 'Les invités rejoignent le jeu depuis leur téléphone.' },
    { title: 'Lancez la révélation', desc: 'La photo se dévoile progressivement sur écran géant.' },
    { title: 'Le plus rapide gagne', desc: 'Le premier à deviner marque les points, classement à l\'appui.' },
  ],
  benefits: [
    { emoji: '🖼️', title: 'Visuel et universel', desc: 'Tout le monde comprend en un instant, quel que soit l\'âge.' },
    { emoji: '🤫', title: 'Suspense croissant', desc: 'La révélation progressive crée une tension irrésistible.' },
    { emoji: '🎯', title: 'Photos personnalisées', desc: 'Glissez des images sur-mesure pour des fous rires garantis.' },
    { emoji: '⏱️', title: 'Format court', desc: 'Idéal pour relancer l\'énergie entre deux animations.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un QR code suffit pour que tout le monde joue.' },
    { emoji: '🏆', title: 'Classement en direct', desc: 'La compétition motive et entretient la participation.' },
  ],
  idealFor: ['Mariages', 'Soirées d\'entreprise', 'Campings', 'Anniversaires', 'Bars & restaurants', 'Animations famille'],
  faq: [
    { q: 'Puis-je utiliser mes propres photos ?', a: "Oui, vous importez vos images pour des manches personnalisées et inoubliables." },
    { q: 'Le jeu convient-il aux enfants ?', a: "Tout à fait : le principe visuel est accessible à tous les âges." },
    { q: 'Comment les invités participent-ils ?', a: "Ils scannent le QR code et jouent depuis leur navigateur, sans application." },
    { q: 'Combien de temps dure une partie ?', a: "Chaque manche est courte (quelques minutes), parfaite pour rythmer une soirée." },
  ],
  related: [
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Roue de la Destinée', href: '/roue-de-la-destinee' },
    { label: 'Le Bon Ordre', href: '/le-bon-ordre' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Photo Mystère AnimaJet',
  description: 'Jeu de photo à deviner sur écran géant : l\'image se dévoile progressivement, le premier qui devine gagne.',
  url: URL,
  serviceType: 'Animation jeu photo',
  faq: content.faq,
})

export default function PhotoMysterePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
