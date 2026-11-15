import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'
import { GAME_MEDIA } from '@/lib/game-media'

const URL = 'https://animajet.fr/jeu-a-demi-mot'

export const metadata: Metadata = {
  title: 'À Demi-Mot : le jeu d’expressions à deviner en équipe',
  description: "À Demi-Mot : une expression se dévoile lettre par lettre sur l'écran géant, les équipes buzzent depuis un téléphone pour la deviner. 2 à 20 équipes, sans appli. Essai gratuit 24h !",
  keywords: ['jeu expression à deviner', 'jeu de lettres soirée', 'jeu en équipe buzzer', 'animation bar quiz', 'jeu proverbes soirée', 'jeu télévisé soirée', 'animation équipes mariage'],
  alternates: { canonical: URL },
  openGraph: {
    images: [{ url: '/images/og-animajet.jpg', width: 1200, height: 630, alt: 'AnimaJet — Les animations interactives qui font vibrer vos événements' }],
    title: 'À Demi-Mot : l’expression à deviner en équipe | AnimaJet',
    description: "Les lettres apparaissent une à une sur l'écran géant, la première équipe qui buzze prend la main. Un vrai jeu de plateau télé pour vos soirées.",
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'JEU D’ÉQUIPES',
  title: 'À Demi-Mot,',
  highlight: 'l’expression à deviner en équipe',
  intro: "Quelques lettres, à vous de trouver : une expression française se dévoile lettre par lettre sur l'écran géant, comme dans un jeu télévisé. Les équipes se concertent à voix haute et le capitaine buzze depuis son téléphone. Première équipe qui buzze, première à répondre : l'ambiance d'un plateau télé dans votre salle.",
  image: '/images/games/a-demi-mot-v2.png',
  what: [
    "À Demi-Mot oppose de 2 à 20 équipes. Chaque équipe désigne un capitaine : il scanne le QR code de la soirée, choisit son équipe, et son téléphone devient le buzzer de toute la table. Les autres participent à l'oral, sans téléphone.",
    "Sur l'écran géant, une expression cachée se dévoile lettre par lettre dans un décor de plateau en 3D. Le premier buzz reçu prend la main : l'équipe a quelques secondes pour répondre. Bonne réponse, elle marque les points ; mauvaise réponse, elle est bloquée pour cette énigme et le dévoilement reprend pour les autres.",
    "Vous arbitrez depuis votre ordinateur, avec la réponse affichée uniquement sur votre écran, jamais sur la TV ni sur les téléphones. Tours de lettres pour relancer le suspense, Finale Déclic où chaque lettre encore cachée rapporte des points en plus, podium final : la partie se déroule toute seule, au clavier ou à la télécommande.",
  ],
  steps: [
    { title: 'Choisissez vos énigmes', desc: 'Plus de 120 expressions et proverbes prêts à jouer, ou les vôtres. Votre bibliothèque est gardée d’une soirée à l’autre.' },
    { title: 'Les capitaines scannent', desc: 'Le QR code de la soirée : chaque capitaine choisit son équipe. Une équipe, un téléphone, aucune appli.' },
    { title: 'Les lettres tombent', desc: 'L’expression se dévoile sur l’écran géant ; la première équipe qui buzze prend la main.' },
    { title: 'Vous arbitrez', desc: 'Bonne ou mauvaise réponse en un clic ou à la télécommande, puis le podium final.' },
  ],
  benefits: [
    { emoji: '📺', title: 'Un vrai plateau télé', desc: 'Décor 3D, lettres qui se retournent, sons de jeu : l’écran géant fait le spectacle.' },
    { emoji: '👥', title: 'Jusqu’à 20 équipes', desc: 'Toute la salle joue en équipes, un seul téléphone par table suffit.' },
    { emoji: '⚡', title: 'Le plus rapide prend la main', desc: 'L’ordre des buzz est décidé par le serveur, au premier arrivé.' },
    { emoji: '🔒', title: 'Réponse secrète', desc: 'La solution ne s’affiche que sur votre écran d’animateur.' },
    { emoji: '📚', title: 'Énigmes incluses', desc: 'Expressions, proverbes, bar et restaurant : prêt à jouer, et modifiable.' },
    { emoji: '🎤', title: 'Vous gardez le rythme', desc: 'Clavier ou télécommande de présentation, sons joués depuis votre ordinateur.' },
  ],
  idealFor: ['Bars & restaurants', 'Campings', 'Mariages', 'Soirées d’entreprise', 'Anniversaires', 'Soirées jeux'],
  faq: [
    { q: 'Qu’est-ce qu’À Demi-Mot ?', a: "À Demi-Mot est un jeu d'équipes : une expression française se dévoile lettre par lettre sur l'écran géant et les équipes buzzent depuis un téléphone pour la deviner. La première équipe qui buzze répond à l'oral, l'animateur arbitre." },
    { q: 'Combien de téléphones faut-il ?', a: "Un seul par équipe : celui du capitaine, qui sert de buzzer. Les autres joueurs participent à voix haute. Le capitaine scanne le QR code de la soirée, sans application ni compte." },
    { q: 'Combien d’équipes peuvent jouer ?', a: "De 2 à 20 équipes, chacune avec son nom et sa couleur. Si un capitaine doit changer de téléphone, l'animateur le remplace en un clic, sans perdre les points de l'équipe." },
    { q: 'Faut-il préparer les énigmes ?', a: "Non. Plus de 120 expressions et proverbes sont fournis, classés en jeux thématiques. Vous pouvez aussi ajouter les vôtres, avec des variantes de réponse acceptées, et les retrouver à chaque soirée." },
    { q: 'Les invités peuvent-ils voir la réponse ?', a: "Non. La solution n'est affichée que dans la régie de l'animateur. L'écran géant et les téléphones ne reçoivent que les lettres déjà dévoilées." },
    { q: 'Faut-il un ordinateur puissant pour la 3D ?', a: "Non. Le plateau en 3D s'adapte à l'ordinateur, et bascule tout seul sur une version sans 3D si la machine est trop lente. Faites une partie d'essai sur votre matériel avant l'événement." },
  ],
  related: [
    { label: 'AnimaBuzz', href: '/jeu-buzzer' },
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'AnimaVote', href: '/jeu-vote' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'À Demi-Mot AnimaJet',
  description: "Jeu d'équipes d'expressions à deviner : une expression se dévoile lettre par lettre sur l'écran géant, les équipes buzzent depuis un téléphone de capitaine. De 2 à 20 équipes, sans application.",
  url: URL,
  serviceType: 'Animation jeu interactif',
  faq: content.faq,
})

export default function ADemiMotLandingPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} media={GAME_MEDIA['/jeu-a-demi-mot']} />
}
