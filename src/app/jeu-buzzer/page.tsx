import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/jeu-buzzer'

export const metadata: Metadata = {
  title: 'AnimaBuzz : un buzzer de jeu sur le téléphone des invités',
  description: "AnimaBuzz transforme le téléphone de chaque invité en vrai buzzer de jeu : le plus rapide prend la main sur l'écran géant. Jusqu'à 200 joueurs, sans appli. Essai gratuit 24h !",
  keywords: ['buzzer téléphone', 'buzzer quiz', 'buzzer en ligne', 'jeu de buzzer soirée', 'buzzer blind test', 'buzzer pour animateur', 'animation quiz mariage'],
  alternates: { canonical: URL },
  openGraph: {
    images: [{ url: '/images/animajet_logo_principal.png', width: 1200, height: 630, alt: 'AnimaJet - Animation interactive pour événements' }],
    title: 'AnimaBuzz : le buzzer live sur téléphone | AnimaJet',
    description: "Chaque invité buzze depuis son téléphone, l'écran géant affiche le plus rapide et les suivants. Idéal pour vos quiz, blind tests et jeux de soirée.",
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION BUZZER',
  title: 'AnimaBuzz,',
  highlight: 'le buzzer live sur téléphone',
  intro: "Plus besoin de matériel : le téléphone de chaque invité devient un vrai buzzer de jeu. Vous ouvrez les buzzers, toute la salle appuie, et l'écran géant affiche en un éclair qui a été le plus rapide. Parfait pour un blind test, un quiz animé au micro ou n'importe quel jeu de rapidité.",
  image: '/images/games/animabuzz.png',
  what: [
    "AnimaBuzz est un buzzer de jeu qui tourne sur les téléphones de vos invités. Ils scannent le QR code de la soirée, choisissent un pseudo (et leur équipe si vous jouez par équipes), et leur écran se transforme en gros bouton à presser, sans application ni compte.",
    "Vous gardez la main sur le déroulé : vous posez la question au micro, vous ouvrez les buzzers, et le premier qui appuie s'affiche sur l'écran géant avec son et animation. Les joueurs suivants sont classés eux aussi : en cas de mauvaise réponse, le 2e prend la main, sans avoir à relancer.",
    "L'ordre des buzz est décidé par le serveur, pas par le téléphone : chacun a sa chance, et un même joueur ne peut pas buzzer deux fois dans la manche. Vous pouvez ajouter un chrono, jouer en solo ou par équipes, et piloter la partie au clic ou à la télécommande.",
  ],
  steps: [
    { title: 'Lancez AnimaBuzz', desc: 'Choisissez solo ou équipes, un chrono si vous le souhaitez, et vos sons.' },
    { title: 'Les invités scannent', desc: 'Le QR code de la soirée mène au buzzer : un pseudo, et c\'est prêt.' },
    { title: 'Ouvrez les buzzers', desc: 'Posez votre question au micro, puis ouvrez : toute la salle appuie.' },
    { title: 'Le plus rapide répond', desc: 'L\'écran géant affiche le gagnant et les suivants ; bonne ou mauvaise réponse, vous enchaînez.' },
  ],
  benefits: [
    { emoji: '⚡', title: 'Ordre incontestable', desc: 'Le classement des buzz est fait par le serveur, dans l\'ordre exact d\'arrivée.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un scan du QR code suffit, aucun compte à créer, aucun matériel à louer.' },
    { emoji: '👥', title: 'Jusqu\'à 200 joueurs', desc: 'En solo ou par équipes : le premier qui appuie fait buzzer toute l\'équipe.' },
    { emoji: '🎤', title: 'Vous gardez le rythme', desc: 'Ouvrez, validez une bonne ou une mauvaise réponse, au clic ou à la télécommande.' },
    { emoji: '🔊', title: 'Sons de plateau télé', desc: 'Sons de buzz, de bonne et de mauvaise réponse inclus, ou vos propres sons.' },
    { emoji: '⏱️', title: 'Chrono en option', desc: 'De 5 à 30 secondes pour faire monter la pression, ou sans chrono.' },
  ],
  idealFor: ['Blind tests', 'Quiz au micro', 'Mariages', 'Soirées d\'entreprise', 'Campings', 'Anniversaires'],
  faq: [
    { q: 'Qu\'est-ce qu\'AnimaBuzz ?', a: "AnimaBuzz est un buzzer de jeu en ligne : le téléphone de chaque invité devient un bouton de buzzer, et l'écran géant affiche instantanément qui a appuyé le premier, puis les suivants." },
    { q: 'Les invités doivent-ils installer une application ?', a: "Non. Ils scannent le QR code de la soirée avec leur téléphone, choisissent un pseudo et jouent directement dans leur navigateur." },
    { q: 'Comment savoir qui a vraiment buzzé en premier ?', a: "L'ordre est décidé par le serveur au moment où chaque buzz arrive, et chaque joueur ne peut buzzer qu'une fois par manche. Les joueurs suivants restent classés pour reprendre la main en cas de mauvaise réponse." },
    { q: 'Combien de joueurs peuvent participer ?', a: "Jusqu'à 200 téléphones par partie, en solo ou répartis en équipes. En mode équipes, le premier membre qui appuie fait buzzer toute son équipe." },
    { q: 'Peut-on l\'utiliser pour un blind test ?', a: "Oui, c'est l'usage idéal : vous lancez la musique sur votre sono, vous ouvrez les buzzers, et le plus rapide donne sa réponse au micro. Vous validez ensuite bonne ou mauvaise réponse en un clic ou à la télécommande." },
    { q: 'Que deviennent les données des joueurs ?', a: "Seuls le pseudo et l'équipe sont demandés. Les données de la partie sont effacées automatiquement au plus tard 24 h après la fin." },
  ],
  related: [
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Photo Mystère', href: '/photo-mystere' },
    { label: 'Matching', href: '/jeu-points-communs' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'AnimaBuzz AnimaJet',
  description: "Buzzer de jeu sur téléphone : les invités buzzent depuis leur smartphone, l'écran géant affiche le plus rapide et les suivants. Jusqu'à 200 joueurs, sans application.",
  url: URL,
  serviceType: 'Animation jeu interactif',
  faq: content.faq,
})

export default function AnimaBuzzLandingPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
