import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/photo-mystere'

export const metadata: Metadata = {
  title: 'Jeu Photo Mystère : la photo cachée à deviner',
  description: "Découvrez Photo Mystère, le jeu où l'image se dévoile case par case sur écran géant : le premier qui la reconnaît gagne la manche. Essai gratuit 24h !",
  keywords: ['photo mystère', 'jeu photo deviner', 'jeu image cachée', 'animation photo événement', 'jeu interactif soirée', 'devine la photo'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Jeu Photo Mystère : la photo cachée à deviner | AnimaJet',
    description: "Une image se dévoile case par case sur l'écran géant, le premier à la reconnaître crie la réponse et remporte la manche.",
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION PHOTO MYSTÈRE',
  title: 'Photo Mystère,',
  highlight: 'le jeu photo qui rend accro',
  intro: "Une image se cache derrière des cases qui se révèlent une à une sur l'écran géant. Dès qu'un invité reconnaît la photo, il lève la main et crie : l'animateur accourt micro en main pour valider. Simple à comprendre, impossible à lâcher, Photo Mystère embarque toute la salle en quelques secondes.",
  image: '/images/games/photo-mystere.png',
  what: [
    "Photo Mystère est un jeu de devinette visuel animé en direct par votre animateur. Sur l'écran géant, des cases se retirent une à une pour dévoiler peu à peu une image cachée — une personne, un objet ou un lieu — pendant que la salle cherche à l'identifier.",
    "Dès qu'un invité pense avoir trouvé, il lève la main et crie sa réponse. L'animateur le rejoint au micro pour valider : si c'est juste, l'image est entièrement révélée et il remporte la manche ; sinon, les cases continuent de tomber jusqu'à la bonne réponse ou l'image complète.",
    "Vous choisissez vos propres photos : célébrités, lieux, objets ou images personnalisées (les mariés enfants, le logo d'une entreprise, des clins d'œil à la soirée). Courte, visuelle et universelle, l'animation fonctionne avec tous les publics, des enfants aux grands-parents.",
  ],
  steps: [
    { title: 'Importez vos photos', desc: 'Ajoutez les images à faire deviner, personnalisées si besoin.' },
    { title: 'Lancez la révélation', desc: 'Les cases tombent une à une sur l\'écran géant pour dévoiler l\'image.' },
    { title: 'Les invités réagissent', desc: 'Celui qui reconnaît l\'image lève la main et crie sa réponse.' },
    { title: 'L\'animateur valide', desc: 'Micro en main, il valide la bonne réponse et désigne le gagnant de la manche.' },
  ],
  benefits: [
    { emoji: '🖼️', title: 'Visuel et universel', desc: 'Tout le monde comprend en un instant, quel que soit l\'âge.' },
    { emoji: '🤫', title: 'Suspense croissant', desc: 'La révélation progressive crée une tension irrésistible.' },
    { emoji: '🎯', title: 'Photos personnalisées', desc: 'Glissez des images sur-mesure pour des fous rires garantis.' },
    { emoji: '⏱️', title: 'Format court', desc: 'Idéal pour relancer l\'énergie entre deux animations.' },
    { emoji: '🎤', title: 'Animé en direct', desc: 'L\'animateur orchestre chaque manche au micro, dans l\'ambiance.' },
    { emoji: '🙌', title: 'Toute la salle joue', desc: 'Pas d\'inscription : il suffit de lever la main et de crier.' },
  ],
  idealFor: ['Mariages', 'Soirées d\'entreprise', 'Campings', 'Anniversaires', 'Bars & restaurants', 'Animations famille'],
  faq: [
    { q: 'Qu\'est-ce que le jeu Photo Mystère ?', a: "Le jeu Photo Mystère est une animation où une photo cachée se dévoile case par case sur écran géant : le premier invité qui reconnaît l'image crie sa réponse et remporte la manche." },
    { q: 'Puis-je utiliser mes propres photos ?', a: "Oui, vous importez vos images pour des manches personnalisées et inoubliables." },
    { q: 'Le jeu convient-il aux enfants ?', a: "Tout à fait : le principe visuel est accessible à tous les âges." },
    { q: 'Comment les invités participent-ils ?', a: "Sans téléphone : dès qu'un invité reconnaît l'image, il lève la main et crie sa réponse, et l'animateur le rejoint au micro pour la valider." },
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
  description: "Jeu de photo à deviner animé en direct sur écran géant : l'image se dévoile case par case et le premier à la reconnaître crie la réponse pour remporter la manche.",
  url: URL,
  serviceType: 'Animation jeu photo',
  faq: content.faq,
})

export default function PhotoMysterePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
