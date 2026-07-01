import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/blind-test-mariage'

export const metadata: Metadata = {
  title: 'Blind Test Mariage | Quiz Musical Interactif pour Invités | AnimaJet',
  description: 'Un blind test musical pour votre mariage : vos invités devinent les titres depuis leur téléphone, classement en direct sur écran géant. Essai gratuit 24h.',
  keywords: ['blind test mariage', 'blind test musical mariage', 'jeu musical mariage invités', 'animation blind test mariage', 'quiz musical mariage smartphone', 'blind test soirée mariage', 'blind test QR code'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Blind Test Mariage Interactif | AnimaJet',
    description: 'Vos invités reconnaissent les titres depuis leur téléphone, le classement s\'affiche en direct sur écran géant. L\'animation musicale qui enflamme la salle.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'BLIND TEST MARIAGE',
  title: 'Le blind test qui fait chanter',
  highlight: 'toute la salle de mariage',
  intro: "Faites deviner à vos invités les chansons qui comptent pour vous : votre premier slow, le tube de votre rencontre, les classiques que tout le monde reprend en chœur. Le blind test de mariage AnimaJet lance les extraits, vos invités répondent depuis leur téléphone, et le classement s'affiche en direct sur grand écran. Sans application, du plus jeune au plus grand.",
  image: '/hero-animajet-1.jpg',
  what: [
    "Le blind test est l'animation musicale qui met tout de suite l'ambiance à un mariage : chacun a une chanson en tête, et la reconnaître avant les autres déclenche l'esprit de compétition et les éclats de rire. Avec AnimaJet, vous lancez les extraits depuis votre écran et vos invités répondent en quelques secondes sur leur téléphone. Rapidité et bonnes réponses comptent, et le classement s'actualise en temps réel sur le grand écran de la salle.",
    "Ce qui rend un blind test de mariage inoubliable, c'est la personnalisation : composez votre playlist autour de votre histoire — la musique de votre première danse, la chanson qui passait le soir de votre rencontre, les tubes de votre génération et de celle de vos parents. Mêlez les décennies pour que les grands-parents comme les enfants aient leur moment de gloire. Tout passe par un simple QR code : vos invités scannent, rejoignent la partie et jouent dans leur navigateur, sans rien installer.",
    "Pensé pour les DJ de mariage comme pour les mariés qui préparent la surprise, le blind test se glisse entre deux moments de la soirée — après le dîner, avant d'ouvrir la piste — pour relancer l'énergie et rassembler tout le monde. Vous gardez la main sur le rythme du début à la fin, et le podium final, affiché en grand, garantit les applaudissements. Il se rejoue autant de fois que vous le voulez, avec de nouvelles playlists.",
  ],
  steps: [
    { title: 'Composez votre playlist', desc: 'Votre histoire en musique : premier slow, tubes de votre génération, classiques.' },
    { title: 'Le QR code sur les tables', desc: 'Les invités rejoignent le blind test en quelques secondes, sans application.' },
    { title: 'Diffusez les extraits', desc: 'Chacun répond depuis son téléphone, le classement s\'affiche en direct.' },
    { title: 'Révélez le podium', desc: 'Le classement final sur grand écran, applaudissements garantis.' },
  ],
  benefits: [
    { emoji: '🎵', title: 'Votre histoire en musique', desc: 'Premier slow, chanson de votre rencontre : personnalisez le blind test autour de vous.' },
    { emoji: '🏆', title: 'Classement en direct', desc: 'Rapidité et bonnes réponses affichées en temps réel sur grand écran.' },
    { emoji: '👵', title: 'Toutes les générations', desc: 'Mêlez les décennies : des enfants aux grands-parents, chacun a son moment.' },
    { emoji: '🔥', title: 'Relance l\'ambiance', desc: 'L\'animation idéale entre le dîner et l\'ouverture de la piste.' },
    { emoji: '🔁', title: 'Rejouable à volonté', desc: 'Renouvelez les playlists autant de fois que vous le souhaitez.' },
    { emoji: '📱', title: 'Sans application', desc: 'Vos invités jouent dans leur navigateur, aucun téléchargement.' },
  ],
  idealFor: ['Futurs mariés', 'DJ de mariage', 'Animateurs', 'Témoins & organisateurs', 'Wedding planners', 'Salles de réception'],
  faq: [
    { q: 'Comment organiser un blind test pour un mariage ?', a: "Vous composez votre playlist (idéalement autour de votre histoire et des goûts de vos invités), puis vous diffusez les extraits depuis votre écran. Vos invités reconnaissent les titres et répondent depuis leur téléphone après avoir scanné un QR code ; le classement s'affiche en direct sur le grand écran." },
    { q: 'Les invités doivent-ils installer une application ?', a: "Non. Ils scannent un QR code et jouent directement dans le navigateur de leur téléphone, sans aucune application ni compte à créer. Des enfants aux grands-parents, tout le monde peut participer." },
    { q: 'Peut-on personnaliser les musiques autour du couple ?', a: "Oui, c'est tout l'intérêt d'un blind test de mariage : intégrez la musique de votre première danse, la chanson de votre rencontre, les tubes de votre génération et de celle de vos parents. Vous composez librement la sélection." },
    { q: 'Quelle est la différence avec le quiz de mariage ?', a: "Le blind test de mariage porte uniquement sur la musique (reconnaître les titres), tandis que le quiz de mariage peut mêler questions sur les mariés, anecdotes et blind test. Vous pouvez utiliser les deux au cours de la soirée." },
    { q: 'Qui anime le blind test, les mariés ou le DJ ?', a: "Les deux sont possibles. La préparation prend quelques minutes et le pilotage est simple : que vous soyez les mariés qui préparent une surprise ou le DJ qui anime la soirée, vous gardez la main sur le rythme du début à la fin." },
  ],
  related: [
    { label: 'Blind test musical (tous événements)', href: '/blind-test-musical' },
    { label: 'Quiz de mariage', href: '/quiz-mariage' },
    { label: 'Animation de mariage', href: '/animation-mariage-interactive' },
    { label: 'Diaporama live mariage', href: '/diaporama-live-mariage' },
    { label: 'Logiciel DJ mariage', href: '/logiciel-dj-mariage' },
    { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Blind Test Mariage Interactif AnimaJet',
  description: 'Blind test musical pour mariage : diffusion d\'extraits personnalisés autour du couple, réponses depuis le téléphone et classement en direct sur grand écran, sans application.',
  url: URL,
  serviceType: 'Blind test musical pour mariage',
  faq: content.faq,
})

export default function BlindTestMariagePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
