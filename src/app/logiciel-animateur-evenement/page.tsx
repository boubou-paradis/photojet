import { Metadata } from 'next'
import AnimationDetailPage, { buildSoftwareAppJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/logiciel-animateur-evenement'

export const metadata: Metadata = {
  title: 'Logiciel Animateur Événement | Outil d\'Animation Tout-en-Un',
  description: 'Le logiciel tout-en-un des animateurs d\'événements : quiz, blind test, photos en direct, jeux interactifs sur écran géant. Sans application. Essai gratuit 24h.',
  keywords: ['logiciel animateur', 'logiciel animation événement', 'outil animateur soirée', 'application animation événement', 'jeux interactifs animateur', 'animation événementielle logiciel'],
  alternates: { canonical: URL },
  openGraph: {
    images: [{ url: '/images/animajet_logo_principal.png', width: 1200, height: 630, alt: 'AnimaJet - Animation interactive pour événements' }],
    title: 'Logiciel Animateur Événement | AnimaJet',
    description: 'Quiz, photos en direct, jeux interactifs : la boîte à outils complète de l\'animateur.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'LOGICIEL ANIMATEUR',
  title: 'La boîte à outils des',
  highlight: 'animateurs d\'événements',
  intro: "Quel que soit l'événement que vous animez — mariage, soirée d'entreprise, anniversaire, événement privé — AnimaJet réunit dans un seul logiciel toutes les animations interactives dont vous avez besoin pour faire participer le public, sans installer la moindre application.",
  image: '/images/games/quiz.png',
  what: [
    "AnimaJet est le logiciel tout-en-un de l'animateur moderne. Plutôt que de jongler entre plusieurs outils, vous disposez d'une plateforme unique : quiz interactif et blind test, Roue de la Destinée, Photo Mystère, Le Bon Ordre, partage de photos en direct, borne photo et diaporama géant. De quoi composer le programme d'animation parfait pour chaque prestation.",
    "Le principe reste toujours le même, et il est redoutablement efficace : vos invités scannent un QR code et participent depuis leur téléphone, pendant que l'action se déroule sur le grand écran. Vous, vous orchestrez tout depuis votre tableau de bord — lancement des jeux, modération, rythme — comme un véritable chef d'orchestre de la soirée.",
    "Conçu pour les professionnels, AnimaJet se personnalise à votre image (logo, couleurs) et vous permet de proposer une offre différenciante à vos clients. L'essai gratuit de 24h vous laisse découvrir l'ensemble des animations avant de vous engager.",
  ],
  steps: [
    { title: 'Créez votre événement', desc: 'En 2 minutes, personnalisé à votre marque.' },
    { title: 'Composez le programme', desc: 'Choisissez vos animations selon le public.' },
    { title: 'Partagez le QR code', desc: 'Les invités rejoignent depuis leur téléphone.' },
    { title: 'Animez sur grand écran', desc: 'Vous pilotez tout depuis votre tableau de bord.' },
  ],
  benefits: [
    { emoji: '🧰', title: 'Tout-en-un', desc: 'Quiz, jeux, photos, diaporama : une seule plateforme.' },
    { emoji: '🎯', title: 'Adapté à chaque public', desc: 'Composez le bon programme pour chaque type d\'événement.' },
    { emoji: '🖥️', title: 'Pilotage centralisé', desc: 'Lancez, modérez, rythmez depuis un tableau de bord unique.' },
    { emoji: '🏷️', title: 'À votre image', desc: 'Logo et couleurs personnalisés sur tous les écrans.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un QR code suffit pour faire participer tout le monde.' },
    { emoji: '🚀', title: 'Offre différenciante', desc: 'Proposez à vos clients une animation que les autres n\'ont pas.' },
  ],
  idealFor: ['Animateurs', 'DJ', 'Agences événementielles', 'Wedding planners', 'Comités d\'entreprise', 'Prestataires loisirs'],
  faq: [
    { q: 'Quelles animations sont incluses dans le logiciel ?', a: "Quiz interactif et blind test, Roue de la Destinée, Photo Mystère, Le Bon Ordre, partage de photos en direct, borne photo et diaporama live : tout est inclus dans l'abonnement." },
    { q: 'Le logiciel s\'adapte-t-il à différents types d\'événements ?', a: "Oui. Vous composez librement votre programme d'animation selon le public : mariage, soirée d'entreprise, anniversaire, événement privé, camping, bar ou restaurant." },
    { q: 'Mes clients verront-ils ma marque ou celle d\'AnimaJet ?', a: "La vôtre. Vous personnalisez le logo et l'arrière-plan affichés sur les écrans et les QR codes." },
    { q: 'Y a-t-il un engagement ?', a: "Non. Vous commencez par un essai gratuit de 24h, puis l'abonnement est mensuel et sans engagement." },
  ],
  related: [
    { label: 'Pour les DJ & animateurs', href: '/animation-dj-interactive' },
    { label: 'Logiciel DJ mariage', href: '/logiciel-dj-mariage' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
    { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  ],
}

const jsonLd = buildSoftwareAppJsonLd({
  name: 'AnimaJet — Logiciel animateur événement',
  description: 'Logiciel d\'animation tout-en-un pour animateurs d\'événements : quiz, blind test, jeux interactifs, photos en direct et diaporama, sans application.',
  url: URL,
  featureList: ['Quiz et blind test', 'Roue, Photo Mystère, Le Bon Ordre', 'Partage de photos en direct', 'Borne photo et diaporama', 'Personnalisation à votre marque'],
  faq: content.faq,
})

export default function LogicielAnimateurEvenementPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
