import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/jeu-vote'

export const metadata: Metadata = {
  title: 'AnimaVote : le vote du public en direct sur téléphone',
  description: "AnimaVote fait voter vos invités depuis leur téléphone : élection, choix du public, résultats en direct ou révélés en podium sur écran géant. Jusqu'à 300 votants, sans appli. Essai gratuit 24h !",
  keywords: ['vote en direct', 'vote du public soirée', 'vote par téléphone', 'élection miss camping', 'élection meilleur costume', 'sondage en direct événement', 'vote mariage animation'],
  alternates: { canonical: URL },
  openGraph: {
    images: [{ url: '/images/og-animajet.jpg', width: 1200, height: 630, alt: 'AnimaJet — Les animations interactives qui font vibrer vos événements' }],
    title: 'AnimaVote : le vote live sur téléphone | AnimaJet',
    description: "Chaque invité vote depuis son téléphone, l'écran géant affiche les résultats en direct ou les révèle en podium. Idéal pour élire une Miss, le meilleur costume ou la prochaine activité.",
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION VOTE',
  title: 'AnimaVote,',
  highlight: 'le vote live sur téléphone',
  intro: "Faites élire le favori de la salle en quelques secondes : le téléphone de chaque invité devient un bulletin de vote. Les résultats montent en direct sur l'écran géant, ou restent secrets jusqu'à une révélation spectaculaire, place après place. Parfait pour une élection Miss ou Mister, le meilleur costume ou le choix de la prochaine animation.",
  image: '/images/games/animavote.png',
  what: [
    "AnimaVote est un vote en direct qui tourne sur les téléphones de vos invités. Ils scannent le QR code de la soirée et voient les choix s'afficher : photo, numéro, nom. Ils choisissent, confirment, et leur vote est verrouillé, sans application, sans compte et sans pseudo.",
    "Vous décidez de la mise en scène : résultats en direct sur l'écran géant, ou cachés jusqu'à la fin pour garder le suspense. À la fermeture, un compte à rebours laisse passer les derniers bulletins, puis vous révélez le gagnant, le podium place par place sous les confettis, ou le classement complet.",
    "Chaque téléphone ne peut voter qu'une fois, contrôlé par le serveur. En cas d'égalité, AnimaVote ne désigne jamais de gagnant au hasard : vous lancez un second tour avec les finalistes, sur les mêmes téléphones, sans rescanner. Le vote est anonyme : seuls des totaux sont affichés.",
  ],
  steps: [
    { title: 'Préparez le vote', desc: 'Un titre et vos choix, avec photo, numéro, emoji ou couleur. Tout est enregistré automatiquement.' },
    { title: 'Les invités scannent', desc: 'Le QR code de la soirée mène au bulletin : aucun pseudo, aucune appli.' },
    { title: 'Ouvrez le vote', desc: 'Chacun choisit et confirme ; l\'écran géant suit la participation en direct.' },
    { title: 'Révélez le gagnant', desc: 'Fermez avec un compte à rebours, puis dévoilez le podium place par place.' },
  ],
  benefits: [
    { emoji: '🔒', title: 'Un vote par téléphone', desc: 'Vote confirmé puis verrouillé, double vote bloqué par le serveur.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un scan du QR code suffit, aucun compte ni pseudo à créer.' },
    { emoji: '👥', title: 'Jusqu\'à 300 votants', desc: 'Toute la salle participe, du camping au grand mariage.' },
    { emoji: '🏆', title: 'Révélation spectaculaire', desc: 'Gagnant, podium place par place ou classement complet sur l\'écran géant.' },
    { emoji: '⚖️', title: 'Second tour en cas d\'égalité', desc: 'Les finalistes s\'affrontent sur les mêmes téléphones, sans rescanner.' },
    { emoji: '🎤', title: 'Vous gardez le rythme', desc: 'Ouvrez, fermez et révélez au clic ou à la télécommande, avec sons inclus.' },
  ],
  idealFor: ['Élections Miss & Mister', 'Concours de costumes', 'Mariages', 'Campings', 'Soirées d\'entreprise', 'Anniversaires'],
  faq: [
    { q: 'Qu\'est-ce qu\'AnimaVote ?', a: "AnimaVote est un vote du public en direct : les invités votent depuis leur téléphone et l'écran géant affiche les résultats en temps réel ou les révèle à la fin, en podium ou en classement complet." },
    { q: 'Les invités doivent-ils installer une application ?', a: "Non. Ils scannent le QR code de la soirée avec leur téléphone et votent directement dans leur navigateur, sans compte ni pseudo." },
    { q: 'Peut-on voter plusieurs fois ?', a: "Non. Chaque téléphone vote une seule fois par vote : le choix est confirmé puis verrouillé, et le serveur refuse tout second bulletin, même après un rechargement de la page." },
    { q: 'Les résultats sont-ils visibles pendant le vote ?', a: "C'est vous qui choisissez : en direct sur l'écran géant pour suivre la course, ou cachés jusqu'à la révélation pour garder le suspense. En mode caché, seul le nombre de votes s'affiche." },
    { q: 'Que se passe-t-il en cas d\'égalité ?', a: "AnimaVote affiche l'égalité sans désigner de gagnant au hasard. Vous créez en un clic un second tour avec les finalistes : il s'ouvre directement sur les téléphones des invités, sans rescanner." },
    { q: 'Le vote est-il anonyme ?', a: "Oui. Aucun nom n'est demandé et personne ne voit qui a voté pour qui : seuls des totaux sont affichés. Les données du vote sont effacées automatiquement au plus tard 24 h après la fin." },
  ],
  related: [
    { label: 'AnimaBuzz', href: '/jeu-buzzer' },
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Matching', href: '/jeu-points-communs' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'AnimaVote AnimaJet',
  description: "Vote du public en direct sur téléphone : les invités votent depuis leur smartphone, l'écran géant affiche les résultats en direct ou les révèle en podium. Jusqu'à 300 votants, sans application.",
  url: URL,
  serviceType: 'Animation jeu interactif',
  faq: content.faq,
})

export default function AnimaVoteLandingPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
