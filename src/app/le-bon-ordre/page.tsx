import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/le-bon-ordre'

export const metadata: Metadata = {
  title: "Le Bon Ordre | Jeu d'Équipe sur Écran Géant pour Événements",
  description: "Deux équipes s'affrontent en direct : une séquence s'affiche sur l'écran géant et chaque équipe se positionne avec ses pancartes pour la reconstituer le plus vite possible. L'équipe la plus rapide marque le point. Essai gratuit 24h.",
  keywords: ['jeu le bon ordre', "jeu d'équipe mariage", 'jeu écran géant', 'animation par équipes', 'jeu équipe événement', 'animation mariage'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Le Bon Ordre | AnimaJet',
    description: "Un duel par équipes où la séquence affichée à l'écran doit être reconstituée à la pancarte le plus vite possible.",
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION LE BON ORDRE',
  title: 'Le Bon Ordre,',
  highlight: "le duel d'équipes en direct",
  intro: "Deux équipes s'affrontent en direct : une séquence de numéros s'affiche sur l'écran géant, et chaque équipe doit se positionner dans le bon ordre, pancartes en main, le plus vite possible. L'équipe la plus rapide marque le point. Rythmé, physique et spectaculaire, Le Bon Ordre met le feu à la salle.",
  image: '/images/games/le-bon-ordre.png',
  what: [
    "Le Bon Ordre est un jeu d'équipe 100 % physique qui se joue sur grand écran. Lors d'un mariage, les mariés choisissent chacun cinq personnes pour former leur équipe — l'équipe du marié contre l'équipe de la mariée — et chaque membre reçoit une pancarte numérotée de 1 à 5.",
    "À chaque manche, un numéro est généré et projeté sur l'écran géant. Les deux équipes doivent alors se replacer dans l'ordre affiché en brandissant leurs pancartes. La première équipe à reconstituer la bonne séquence remporte la manche et marque un point.",
    "Le chronomètre rythme la partie : à la fin du temps imparti, l'équipe qui a marqué le plus de points l'emporte. Sans aucun téléphone, c'est un défi fédérateur et survolté, idéal aussi en team building d'entreprise ou en soirée festive.",
  ],
  steps: [
    { title: 'Formez les deux équipes', desc: 'Chaque camp choisit 5 joueurs qui reçoivent une pancarte de 1 à 5.' },
    { title: 'Affichez la séquence', desc: 'Un numéro est généré et projeté sur l\'écran géant.' },
    { title: 'Les équipes se positionnent', desc: 'Chaque équipe se range dans le bon ordre, pancartes en main, le plus vite possible.' },
    { title: 'La plus rapide marque', desc: 'L\'équipe la plus rapide gagne la manche ; au chrono final, le meilleur score l\'emporte.' },
  ],
  benefits: [
    { emoji: '🏁', title: 'Duel de rapidité', desc: 'Deux équipes s\'affrontent contre la montre à chaque manche.' },
    { emoji: '🤝', title: 'Esprit d\'équipe', desc: 'Cinq joueurs par camp se coordonnent pour gagner.' },
    { emoji: '📺', title: 'Sur écran géant', desc: 'La séquence et les scores s\'affichent en grand pour toute la salle.' },
    { emoji: '🏃', title: '100 % physique', desc: 'Les joueurs se déplacent et brandissent leurs pancartes, sans téléphone.' },
    { emoji: '🏢', title: 'Idéal team building', desc: 'Parfait pour les séminaires et soirées d\'entreprise.' },
    { emoji: '🏆', title: 'Score en direct', desc: 'Les points s\'accumulent manche après manche jusqu\'au verdict final.' },
  ],
  idealFor: ['Mariages', 'Soirées d\'entreprise', 'Séminaires & team building', 'Anniversaires', 'Campings', 'Soirées festives'],
  faq: [
    { q: 'Comment se déroule une manche ?', a: "Un numéro s'affiche sur l'écran géant et les deux équipes doivent se positionner dans le bon ordre avec leurs pancartes. La première à réussir marque le point." },
    { q: 'Combien de joueurs par équipe ?', a: "Cinq joueurs par équipe, chacun muni d'une pancarte numérotée de 1 à 5 ; lors d'un mariage, les mariés composent eux-mêmes leur équipe." },
    { q: 'Comment gagne-t-on la partie ?', a: "Chaque manche remportée rapporte un point. À la fin du chronomètre, l'équipe qui a le plus de points gagne la partie." },
    { q: 'Faut-il un téléphone pour jouer ?', a: "Non, Le Bon Ordre est un jeu 100 % physique : tout se passe sur l'écran géant et avec les pancartes, sans application ni smartphone." },
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
  description: "Jeu d'équipe 100 % physique sur écran géant : deux équipes munies de pancartes numérotées reconstituent la séquence affichée le plus vite possible.",
  url: URL,
  serviceType: "Animation jeu d'équipe",
  faq: content.faq,
})

export default function LeBonOrdrePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
