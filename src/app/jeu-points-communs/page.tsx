import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/jeu-points-communs'

export const metadata: Metadata = {
  title: 'Matching : le jeu des points communs pour vos soirées',
  description: "Matching, le jeu de soirée où chacun répond depuis son téléphone : à la fin, chaque invité découvre qui a répondu comme lui. Sans appli. Essai gratuit 24h !",
  keywords: ['jeu des points communs', 'jeu pour faire connaissance', 'jeu brise-glace soirée', 'animation soirée célibataires', 'jeu interactif téléphone', 'animation mariage invités', 'team building brise-glace'],
  alternates: { canonical: URL },
  openGraph: {
    images: [{ url: '/images/animajet_logo_principal.png', width: 1200, height: 630, alt: 'AnimaJet - Animation interactive pour événements' }],
    title: 'Matching : le jeu des points communs | AnimaJet',
    description: "Chacun répond depuis son téléphone, la salle découvre ses tendances sur l'écran géant, et chaque invité découvre en privé qui a répondu comme lui.",
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION MATCHING',
  title: 'Matching,',
  highlight: 'le jeu des points communs',
  intro: "Mer ou montagne ? Sucré ou salé ? Chacun répond depuis son téléphone, la salle découvre ses tendances en direct sur l'écran géant, et à la fin chaque invité découvre en privé les personnes qui ont répondu comme lui. Résultat : « J'ai 80 % de points communs avec Luna. C'est qui, Luna ? » Les conversations démarrent toutes seules.",
  image: '/images/games/matching-v2.png',
  what: [
    "Matching est un jeu de soirée léger et convivial. Vous posez des questions simples et amusantes (« Ton apéro idéal ? », « L'ananas sur la pizza ? »), les invités répondent depuis leur téléphone en scannant le QR code de la soirée, sans application ni compte.",
    "Pendant le vote, les réponses restent cachées. Quand vous cliquez sur « Révéler », les pourcentages de la salle s'affichent sur l'écran géant : « 68 % de la salle rêve d'une terrasse au soleil ». C'est le moment de commenter et de faire rire.",
    "À la fin, chaque joueur découvre sur son téléphone ses 5 meilleurs points communs : les personnes qui ont donné le plus de réponses identiques aux siennes, avec un pourcentage honnête (« 8 réponses identiques sur 10 »). Pas de profil, pas de messagerie : juste une bonne excuse pour aller se parler.",
  ],
  steps: [
    { title: 'Préparez vos questions', desc: 'Chargez le pack de 20 questions prêtes ou écrivez les vôtres, en quelques minutes.' },
    { title: 'Les invités scannent', desc: 'Le QR code de la soirée mène au jeu : un pseudo, et c\'est parti.' },
    { title: 'Révélez les réponses', desc: 'Question après question, la salle découvre ses tendances sur l\'écran géant.' },
    { title: 'Découvrez vos points communs', desc: 'Chaque téléphone affiche le Top 5 des personnes qui ont répondu pareil.' },
  ],
  benefits: [
    { emoji: '🗣️', title: 'Brise-glace garanti', desc: 'Chacun repart avec des noms à aller rencontrer dans la salle.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un scan du QR code suffit, aucun compte à créer.' },
    { emoji: '🎤', title: 'Vous gardez le rythme', desc: 'Vous lancez, révélez et commentez chaque question, au clic ou à la télécommande.' },
    { emoji: '🔒', title: 'Résultats privés', desc: 'Personne ne voit les réponses des autres ; apparaître chez les autres est facultatif.' },
    { emoji: '📦', title: 'Prêt en 2 minutes', desc: 'Un pack de 20 questions de soirée, toutes modifiables.' },
    { emoji: '🎵', title: 'Musique d\'ambiance', desc: 'Une musique tourne en boucle sur votre sono pendant toute la partie.' },
  ],
  idealFor: ['Soirées célibataires', 'Mariages', 'Afterworks', 'Team building', 'Campings', 'EVJF / EVG'],
  faq: [
    { q: 'Qu\'est-ce que le jeu Matching ?', a: "Matching est un jeu de soirée où chaque invité répond à des questions légères depuis son téléphone. La salle découvre ses tendances sur l'écran géant, puis chacun découvre en privé les 5 personnes qui ont répondu le plus comme lui." },
    { q: 'Est-ce un site de rencontre ?', a: "Non. Matching est une animation de salle : pas de profil, pas de messagerie, pas de like. Le jeu donne simplement une bonne raison d'aller discuter avec ses voisins de soirée." },
    { q: 'Les invités doivent-ils installer une application ?', a: "Non. Ils scannent le QR code de la soirée avec leur téléphone, choisissent un pseudo et jouent directement dans leur navigateur." },
    { q: 'Les réponses sont-elles confidentielles ?', a: "Oui. Personne ne voit les réponses des autres. Un joueur n'apparaît dans le Top 5 des autres que s'il a coché la case prévue, et les réponses sont effacées au plus tard 24 h après la partie." },
    { q: 'Combien de temps dure une partie ?', a: "Comptez environ 8 minutes pour 10 questions. Vous choisissez entre 5 et 20 questions selon le rythme de votre soirée." },
    { q: 'Puis-je écrire mes propres questions ?', a: "Oui. Vous partez du pack de démarrage ou d'une page blanche, et vous sauvegardez vos questions dans votre bibliothèque pour les réutiliser." },
  ],
  related: [
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Photo Mystère', href: '/photo-mystere' },
    { label: 'Roue de la Destinée', href: '/roue-de-la-destinee' },
    { label: 'AnimaBuzz', href: '/jeu-buzzer' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Matching AnimaJet',
  description: "Jeu de soirée interactif : les invités répondent depuis leur téléphone, la salle découvre ses tendances sur écran géant et chacun découvre en privé les personnes qui ont répondu comme lui.",
  url: URL,
  serviceType: 'Animation jeu interactif',
  faq: content.faq,
})

export default function MatchingLandingPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
