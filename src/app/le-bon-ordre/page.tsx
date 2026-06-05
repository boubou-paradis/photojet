import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/le-bon-ordre'

export const metadata: Metadata = {
  title: 'Le Bon Ordre | Jeu de Classement Interactif pour Événements',
  description: 'Remettez les éléments dans le bon ordre : un jeu de réflexion interactif où vos invités classent dates, prix ou tailles depuis leur téléphone. Sur écran géant, sans application. Essai gratuit 24h.',
  keywords: ['jeu le bon ordre', 'jeu de classement', 'jeu réflexion soirée', 'animation interactive', 'jeu équipe événement', 'quiz classement'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Le Bon Ordre | AnimaJet',
    description: 'Un jeu de classement malin où vos invités remettent les éléments dans le bon ordre.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION LE BON ORDRE',
  title: 'Le Bon Ordre,',
  highlight: 'le jeu qui fait réfléchir',
  intro: "Présentez une série d'éléments à remettre dans le bon ordre — du plus ancien au plus récent, du moins cher au plus cher, du plus petit au plus grand. Vos invités classent depuis leur téléphone et marquent des points selon leur justesse. Malin, fédérateur et toujours surprenant.",
  image: '/images/games/le-bon-ordre.png',
  what: [
    "Le Bon Ordre est un jeu de logique et de classement interactif. Vous proposez une liste d'éléments mélangés (événements historiques, films par date, produits par prix, villes par population…) et vos invités doivent les remettre dans l'ordre exact.",
    "Chaque joueur réorganise les éléments sur son téléphone, puis valide. Le score dépend de la précision du classement : c'est un jeu qui récompense autant le savoir que le bon sens, et qui crée toujours des débats animés.",
    "Facile à personnaliser, Le Bon Ordre devient un formidable outil de team building en entreprise, un jeu culture en soirée, ou une animation sur-mesure autour du couple lors d'un mariage.",
  ],
  steps: [
    { title: 'Créez vos listes', desc: 'Définissez les éléments à classer et le bon ordre attendu.' },
    { title: 'Partagez le QR code', desc: 'Les invités rejoignent le jeu depuis leur téléphone.' },
    { title: 'Chacun classe', desc: 'Les joueurs réorganisent les éléments et valident leur réponse.' },
    { title: 'Découvrez les scores', desc: 'Le classement révèle qui a vu le plus juste.' },
  ],
  benefits: [
    { emoji: '🧠', title: 'Jeu de réflexion', desc: 'Stimule la logique et la culture, au-delà de la simple chance.' },
    { emoji: '🤝', title: 'Fédérateur', desc: 'Génère des échanges et des débats entre les participants.' },
    { emoji: '🏢', title: 'Idéal team building', desc: 'Parfait pour les séminaires et soirées d\'entreprise.' },
    { emoji: '✏️', title: 'Listes personnalisées', desc: 'Adaptez les thèmes à votre public et à l\'occasion.' },
    { emoji: '📱', title: 'Sans application', desc: 'Chaque joueur participe via un simple QR code.' },
    { emoji: '📊', title: 'Score à la précision', desc: 'Le classement récompense la justesse de l\'ordre.' },
  ],
  idealFor: ['Soirées d\'entreprise', 'Séminaires & team building', 'Mariages', 'Bars à quiz', 'Campings', 'Soirées culture'],
  faq: [
    { q: 'Quels types de listes puis-je créer ?', a: "Tout ce qui s'ordonne : dates, prix, tailles, distances, popularité… Vous personnalisez entièrement les listes." },
    { q: 'Le jeu est-il adapté au team building ?', a: "Oui, c'est l'une des meilleures animations pour faire réfléchir et échanger une équipe." },
    { q: 'Comment le score est-il calculé ?', a: "Le score dépend de la précision du classement de chaque joueur par rapport au bon ordre." },
    { q: 'Faut-il télécharger quelque chose ?', a: "Non, vos invités jouent depuis leur navigateur après avoir scanné le QR code." },
  ],
  related: [
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Roue de la Destinée', href: '/roue-de-la-destinee' },
    { label: 'Photo Mystère', href: '/photo-mystere' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Le Bon Ordre AnimaJet',
  description: 'Jeu de classement interactif où les invités remettent des éléments dans le bon ordre depuis leur téléphone.',
  url: URL,
  serviceType: 'Animation jeu de classement',
  faq: content.faq,
})

export default function LeBonOrdrePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
