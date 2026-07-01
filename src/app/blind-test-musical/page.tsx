import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/blind-test-musical'

export const metadata: Metadata = {
  title: 'Blind Test Musical Interactif | Sur Écran Géant, Réponses au Téléphone',
  description: 'Organisez un blind test musical interactif : diffusez les extraits, vos invités répondent depuis leur téléphone, le classement s\'affiche en direct sur écran géant. Sans application. Essai gratuit 24h.',
  keywords: ['blind test musical', 'blind test interactif', 'blind test soirée', 'jeu blind test', 'quiz musical', 'blind test écran géant'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Blind Test Musical Interactif | AnimaJet',
    description: 'Diffusez les extraits, vos invités buzzent depuis leur téléphone, le classement s\'affiche en direct sur écran géant.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'BLIND TEST MUSICAL',
  title: 'Le blind test musical',
  highlight: 'qui réveille toute la salle',
  intro: "Diffusez un extrait, vos invités reconnaissent le titre et répondent depuis leur téléphone : le blind test musical d'AnimaJet affiche le classement en direct sur écran géant. L'animation qui fait monter l'ambiance d'une soirée, d'un mariage ou d'un bar, sans application à installer.",
  image: '/hero-animajet-1.jpg',
  what: [
    "Le blind test musical est l'une des animations les plus fédératrices : tout le monde a une chanson en tête, et la reconnaître avant les autres déclenche immédiatement l'esprit de compétition. Avec AnimaJet, vous lancez les extraits depuis votre écran, et les participants répondent en quelques secondes sur leur téléphone. Rapidité et bonnes réponses sont prises en compte, et le classement s'actualise en temps réel sur grand écran.",
    "Vous composez votre blind test comme vous le souhaitez : décennies, genres, thèmes (variété française, tubes des années 80, musiques de films…) ou playlist adaptée à votre public. Tout passe par un QR code : vos invités scannent, rejoignent la partie et jouent dans leur navigateur, sans aucune application ni compte à créer. Des plus jeunes aux plus grands, chacun participe depuis son propre smartphone.",
    "Pensé pour les animateurs et les DJ, le blind test s'intègre entre deux moments de la soirée pour relancer l'énergie, et se rejoue autant de fois que vous le voulez avec de nouvelles playlists. Vous gardez la main sur le rythme du début à la fin, et le podium final, affiché en grand, garantit les applaudissements.",
  ],
  steps: [
    { title: 'Composez votre playlist', desc: 'Décennies, genres ou thèmes adaptés à votre public.' },
    { title: 'Partagez le QR code', desc: 'Les invités rejoignent le blind test en quelques secondes.' },
    { title: 'Diffusez les extraits', desc: 'Chacun répond depuis son téléphone, le classement s\'affiche en direct.' },
    { title: 'Révélez le podium', desc: 'Le classement final sur écran géant, applaudissements garantis.' },
  ],
  benefits: [
    { emoji: '🎵', title: 'Reconnaissance de titres', desc: 'Diffusez les extraits, les invités buzzent depuis leur téléphone.' },
    { emoji: '🏆', title: 'Classement en direct', desc: 'Rapidité et bonnes réponses affichées en temps réel sur écran géant.' },
    { emoji: '🎚️', title: 'Playlist personnalisable', desc: 'Décennies, genres, thèmes : adaptez le blind test à votre public.' },
    { emoji: '🔥', title: 'Relance l\'ambiance', desc: 'L\'animation idéale entre deux moments pour réveiller la salle.' },
    { emoji: '🔁', title: 'Rejouable à volonté', desc: 'Renouvelez les playlists autant de fois que vous le souhaitez.' },
    { emoji: '📱', title: 'Sans application', desc: 'Vos invités jouent dans leur navigateur, aucun téléchargement.' },
  ],
  idealFor: ['DJ & animateurs', 'Mariages', 'Soirées d\'entreprise', 'Bars & restaurants', 'Soirées entre amis', 'Anniversaires'],
  faq: [
    { q: 'Comment fonctionne un blind test musical avec AnimaJet ?', a: "Vous diffusez un extrait musical depuis votre écran, et vos invités répondent depuis leur téléphone après avoir scanné un QR code. La rapidité et les bonnes réponses sont comptabilisées, et le classement s'affiche en direct sur l'écran géant." },
    { q: 'Faut-il une application pour participer ?', a: "Non. Les participants scannent un QR code et jouent directement dans le navigateur de leur téléphone, sans aucune application ni compte à créer." },
    { q: 'Peut-on choisir les musiques du blind test ?', a: "Oui. Vous composez votre propre sélection — décennies, genres, thèmes ou playlist adaptée à votre public — et la renouvelez autant de fois que vous le souhaitez." },
    { q: 'Le blind test convient-il à un mariage ou une soirée d\'entreprise ?', a: "Tout à fait. Le blind test musical fédère toutes les générations et s'adapte aussi bien à un mariage qu'à une soirée d'entreprise, un bar ou une soirée entre amis." },
  ],
  related: [
    { label: 'Blind test mariage', href: '/blind-test-mariage' },
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Quiz de mariage', href: '/quiz-mariage' },
    { label: 'Pour les DJ & animateurs', href: '/animation-dj-interactive' },
    { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Blind Test Musical Interactif AnimaJet',
  description: 'Blind test musical interactif : diffusion d\'extraits, réponses depuis le téléphone et classement en direct sur écran géant, sans application.',
  url: URL,
  serviceType: 'Blind test musical interactif',
  faq: content.faq,
})

export default function BlindTestMusicalPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
