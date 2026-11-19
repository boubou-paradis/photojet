// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'
import { GAME_MEDIA } from '@/lib/game-media'

const URL = 'https://animajet.fr/jeu-animabingo'

export const metadata: Metadata = {
  title: 'AnimaBingo : animation loto sur écran géant et téléphone',
  description: "AnimaBingo anime votre loto 90 boules : tirage sur écran géant, cartons sur le téléphone des invités ou sur papier, quine, double quine et carton plein vérifiés en un clic. Sans appli. Essai gratuit 24h !",
  keywords: ['animation loto', 'loto sur écran géant', 'loto sur téléphone', 'bingo soirée', 'logiciel loto animation', 'loto camping', 'loto association', 'carton de loto à imprimer'],
  alternates: { canonical: URL },
  openGraph: {
    images: [{ url: '/images/og-animajet.jpg', width: 1200, height: 630, alt: 'AnimaJet — Les animations interactives qui font vibrer vos événements' }],
    title: 'AnimaBingo : le loto animé sur écran géant | AnimaJet',
    description: "Les boules tombent sur l'écran géant, les invités posent leurs jetons sur leur téléphone et crient « QUINE ! » d'un geste. Vérification immédiate, cartons papier imprimables.",
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION LOTO',
  title: 'AnimaBingo,',
  highlight: 'le loto animé sur écran géant',
  intro: "Transformez votre loto en vrai spectacle : la machine fait tourner les boules sur l'écran géant, une voix annonce chaque numéro et le tableau des 90 numéros se remplit sous les yeux de toute la salle. Vos invités jouent sur leur téléphone ou sur des cartons papier, et chaque quine est vérifiée en un clic.",
  image: '/images/games/animabingo.png',
  what: [
    "AnimaBingo est un loto 90 boules pensé pour l'animation. Les invités scannent le QR code de la soirée, donnent leur prénom et reçoivent leur carton sur leur téléphone. Ils posent leurs jetons d'un doigt et appuient sur « QUINE ! » quand une ligne est complète, sans application et sans compte.",
    "Vous gardez la main depuis la régie : tirage boule par boule ou automatique, au clic ou à la télécommande. La partie s'enchaîne en trois temps (quine, double quine puis carton plein) et chaque demande arrive déjà vérifiée : vous validez, le prénom du gagnant s'affiche en grand sous les confettis.",
    "Les joueurs sans téléphone ne sont pas oubliés : imprimez des cartons papier numérotés, tous différents, et jouez avec les deux en même temps. La partie est enregistrée en continu : une coupure de réseau, un écran rechargé ou un autre jeu lancé au milieu ne font rien perdre, ni boules, ni jetons, ni gagnants.",
  ],
  steps: [
    { title: 'Lancez AnimaBingo', desc: 'Choisissez les étapes de la partie et le nombre de cartons par joueur, imprimez des cartons papier si besoin.' },
    { title: 'Les invités scannent', desc: 'Le QR code de la soirée leur donne leur carton sur le téléphone, en quelques secondes.' },
    { title: 'Tirez les boules', desc: "La machine tourne sur l'écran géant, la voix annonce le numéro, le tableau se remplit." },
    { title: 'Validez les gagnants', desc: 'Les demandes arrivent vérifiées : un clic, et le gagnant apparaît en grand.' },
  ],
  benefits: [
    { emoji: '🎱', title: 'Le vrai loto 90 boules', desc: 'Cartons de 15 numéros sur 3 lignes, quine, double quine et carton plein.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un scan du QR code suffit : carton et jetons directement dans le navigateur.' },
    { emoji: '✅', title: 'Vérification instantanée', desc: 'Fini les cartons relus à voix haute : chaque demande arrive déjà contrôlée.' },
    { emoji: '🖨️', title: 'Cartons papier inclus', desc: 'Imprimez des cartons numérotés, tous différents, pour jouer avec ou sans téléphone.' },
    { emoji: '🎙️', title: 'Une voix annonce les numéros', desc: 'Chaque boule est annoncée à voix haute, avec les moments forts de la partie.' },
    { emoji: '🛡️', title: 'Partie jamais perdue', desc: 'Coupure de réseau, page rechargée, autre jeu lancé : tout reprend exactement où il était.' },
  ],
  idealFor: ['Campings', 'Associations & comités des fêtes', 'Clubs & EHPAD', 'Soirées d\'entreprise', 'Mariages', 'Anniversaires'],
  faq: [
    { q: 'Qu\'est-ce qu\'AnimaBingo ?', a: "AnimaBingo est une animation loto 90 boules : le tirage s'affiche sur écran géant avec une machine animée et une voix qui annonce les numéros, et les invités jouent sur leur téléphone ou sur des cartons papier." },
    { q: 'Les invités doivent-ils installer une application ?', a: "Non. Ils scannent le QR code de la soirée et reçoivent leur carton directement dans le navigateur de leur téléphone, avec simplement leur prénom." },
    { q: 'Peut-on jouer avec des cartons papier ?', a: "Oui. Depuis la régie, vous imprimez des cartons papier numérotés (6 par feuille A4), tous différents. Joueurs papier et joueurs sur téléphone participent à la même partie." },
    { q: 'Comment sont vérifiées les quines ?', a: "Quand un joueur appuie sur « QUINE ! », sa demande arrive dans la régie déjà comparée aux numéros sortis. Vous validez en un clic et son prénom s'affiche sur l'écran géant. Un jeton posé sur un numéro pas encore sorti est signalé au joueur." },
    { q: 'Que se passe-t-il en cas de coupure réseau ?', a: "Rien n'est perdu : la partie est enregistrée en continu. Les téléphones gardent leurs jetons, une quine demandée hors ligne part toute seule au retour du réseau, et la régie reprend la partie exactement où elle était." },
    { q: 'Peut-on organiser un loto avec des lots ?', a: "AnimaJet est un outil d'animation : il ne vend rien, n'encaisse rien et ne gère aucun lot. L'organisateur reste seul responsable du respect de la réglementation applicable à son événement." },
  ],
  related: [
    { label: 'AnimaBuzz', href: '/jeu-buzzer' },
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'AnimaVote', href: '/jeu-vote' },
    { label: 'Roue de la Destinée', href: '/roue-de-la-destinee' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'AnimaBingo AnimaJet',
  description: "Animation loto 90 boules : tirage sur écran géant avec annonce vocale, cartons sur téléphone ou papier, quine, double quine et carton plein vérifiés en un clic. Sans application.",
  url: URL,
  serviceType: 'Animation jeu interactif',
  faq: content.faq,
})

export default function AnimaBingoLandingPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} media={GAME_MEDIA['/jeu-animabingo']} />
}
