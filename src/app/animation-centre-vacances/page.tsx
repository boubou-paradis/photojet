import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/animation-centre-vacances'

export const metadata: Metadata = {
  title: 'Animation Centre de Vacances | Veillées & Jeux Interactifs',
  description: 'Animez vos veillées en centre de vacances, colo ou club : quiz, photos en direct et jeux interactifs sur écran, depuis le téléphone. Essai gratuit 24h.',
  keywords: ['animation centre de vacances', 'animation colonie de vacances', 'veillée colo', 'animation club vacances', 'jeux veillée', 'animation centre de loisirs'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Animation Centre de Vacances | AnimaJet',
    description: 'Quiz, photos en direct et jeux interactifs pour des veillées inoubliables.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION CENTRE DE VACANCES',
  title: 'Les veillées de vacances',
  highlight: 'qui rassemblent tout le monde',
  intro: "Colonies de vacances, clubs, centres de loisirs ou villages vacances : AnimaJet donne à vos équipes d'animation un outil clé en main pour des veillées interactives où petits et grands participent ensemble, depuis leur téléphone, sans matériel à transporter.",
  image: '/images/games/le-bon-ordre.png',
  what: [
    "Animer une veillée demande du rythme et des idées qui fédèrent. AnimaJet rassemble en une plateforme tout ce qu'il faut : quiz interactif par équipes, jeux de rapidité comme Le Bon Ordre, Photo Mystère et Roue de la Destinée, ainsi que le partage de photos qui fait défiler sur l'écran les moments forts du séjour.",
    "Le fonctionnement est idéal pour un centre : un seul écran ou vidéoprojecteur dans la salle commune, un QR code projeté, et tous les vacanciers rejoignent l'animation depuis leur smartphone. Les animateurs gardent la main sur le rythme et la modération, pour des veillées cadrées et sécurisées.",
    "Léger à mettre en place et réutilisable soir après soir, AnimaJet évite d'avoir à réinventer une animation chaque jour. Les photos du séjour s'accumulent dans un album, parfait pour clôturer le séjour sur un beau diaporama souvenir.",
  ],
  steps: [
    { title: 'Préparez la veillée', desc: 'Quiz par équipes, jeux, photos du séjour.' },
    { title: 'Projetez le QR code', desc: 'Les vacanciers rejoignent en quelques secondes.' },
    { title: 'Lancez les jeux', desc: 'Compétition par équipes sur grand écran.' },
    { title: 'Clôturez en beauté', desc: 'Un diaporama souvenir du séjour complet.' },
  ],
  benefits: [
    { emoji: '🏕️', title: 'Pensé pour les colos', desc: 'Des veillées clé en main, réutilisables chaque soir.' },
    { emoji: '👥', title: 'Jeu par équipes', desc: 'Le Bon Ordre et le quiz fédèrent les groupes.' },
    { emoji: '📸', title: 'Photos du séjour', desc: 'Les moments forts s\'affichent sur l\'écran commun.' },
    { emoji: '🛡️', title: 'Modération', desc: 'Les animateurs valident les contenus, pour un cadre sécurisé.' },
    { emoji: '🎒', title: 'Zéro matériel lourd', desc: 'Un écran et des téléphones suffisent, rien à transporter.' },
    { emoji: '🎬', title: 'Diaporama de fin', desc: 'Clôturez le séjour avec un album souvenir.' },
  ],
  idealFor: ['Colonies de vacances', 'Centres de loisirs', 'Villages vacances', 'Clubs ados', 'Camps & séjours', 'Équipes d\'animation'],
  faq: [
    { q: 'AnimaJet convient-il à une colonie de vacances ?', a: "Oui. Les jeux par équipes (quiz, Le Bon Ordre) et le partage de photos sont parfaits pour des veillées qui rassemblent enfants, ados et animateurs autour d'un même écran." },
    { q: 'Les animateurs peuvent-ils modérer les contenus ?', a: "Oui. La modération permet de valider chaque photo ou message avant affichage, pour garder un cadre adapté et sécurisé pour les mineurs." },
    { q: 'Peut-on réutiliser AnimaJet chaque soir du séjour ?', a: "Absolument. Vous pouvez relancer des animations soir après soir sans tout reconfigurer, ce qui fait gagner un temps précieux aux équipes." },
    { q: 'Quel matériel faut-il dans le centre ?', a: "Un seul écran ou vidéoprojecteur dans la salle commune, et le téléphone des participants. Aucune installation lourde n'est nécessaire." },
  ],
  related: [
    { label: 'Le Bon Ordre', href: '/le-bon-ordre' },
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Campings & vacances', href: '/animation-camping-interactive' },
    { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Animation centre de vacances AnimaJet',
  description: 'Animations interactives pour centres de vacances et colonies : veillées, quiz par équipes, photos en direct et jeux depuis le téléphone.',
  url: URL,
  serviceType: 'Animation de centre de vacances interactive',
  faq: content.faq,
})

export default function AnimationCentreVacancesPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
