import { Metadata } from 'next'
import AnimationDetailPage, { buildSoftwareAppJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/logiciel-dj-mariage'

export const metadata: Metadata = {
  title: 'Logiciel DJ Mariage | Animations Interactives pour DJ de Mariage',
  description: 'Le logiciel d\'animation pensé pour les DJ de mariage : quiz et blind test, photos en direct, jeux interactifs sur écran géant. Sans application. Essai gratuit 24h.',
  keywords: ['logiciel DJ mariage', 'logiciel animation mariage', 'animation DJ mariage', 'jeux DJ mariage', 'quiz mariage interactif', 'outil DJ mariage', 'application DJ mariage'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Logiciel DJ Mariage | AnimaJet',
    description: 'Quiz, blind test, photos en direct : le logiciel qui rend vos mariages inoubliables.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'LOGICIEL DJ MARIAGE',
  title: 'Le logiciel des DJ',
  highlight: 'qui font danser les mariages',
  intro: "Vous êtes DJ de mariage et vous cherchez à sortir du simple mix ? AnimaJet est le logiciel d'animation qui fait participer toute la salle : quiz spécial mariés, blind test musical, photos en direct sur écran géant et jeux interactifs, le tout depuis le téléphone des invités.",
  image: '/images/hero-animajet.png',
  what: [
    "AnimaJet a été conçu par un DJ animateur, pour les DJ animateurs. Le logiciel rassemble en une seule plateforme tout ce qui transforme un mariage en moment mémorable : un quiz interactif et blind test musical où les mariés et leurs proches s'affrontent, le partage de photos en direct qui anime l'écran, et plusieurs jeux pensés pour rythmer la soirée.",
    "Tout fonctionne sans application : vos invités scannent un QR code et rejoignent l'animation en quelques secondes. Vous, vous pilotez le rythme depuis votre écran, exactement comme vous gérez votre mix. Les animations s'intègrent naturellement entre deux sets, pour relancer l'énergie quand la piste se vide.",
    "Côté image de marque, c'est votre logo et vos couleurs qui s'affichent, pas les nôtres. Vous proposez une prestation premium et différenciante à vos couples, et vous justifiez un tarif à la hauteur. L'essai gratuit de 24h vous permet de tester en conditions réelles avant votre prochaine date.",
  ],
  steps: [
    { title: 'Créez le mariage', desc: 'Nom des mariés, date, personnalisation à votre marque.' },
    { title: 'Partagez le QR code', desc: 'Les invités rejoignent les animations en 5 secondes.' },
    { title: 'Lancez les jeux', desc: 'Quiz, blind test, photos en direct entre vos sets.' },
    { title: 'Faites monter la salle', desc: 'Classements et écran géant relancent l\'ambiance.' },
  ],
  benefits: [
    { emoji: '🎚️', title: 'Pensé par un DJ', desc: 'Conçu pour s\'intégrer à votre prestation, pas la remplacer.' },
    { emoji: '🎵', title: 'Quiz & blind test musical', desc: 'L\'animation phare des mariages, classement en direct.' },
    { emoji: '📸', title: 'Photos en direct', desc: 'L\'écran s\'anime des souvenirs envoyés par les invités.' },
    { emoji: '🏷️', title: 'Votre marque', desc: 'Logo et couleurs personnalisés : c\'est VOUS qu\'on voit.' },
    { emoji: '💍', title: 'Prestation premium', desc: 'Différenciez-vous et justifiez un tarif plus élevé.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un QR code suffit, vos invités jouent en quelques secondes.' },
  ],
  idealFor: ['DJ de mariage', 'Animateurs', 'MC / Maîtres de cérémonie', 'Wedding planners', 'Prestataires mariage', 'Agences'],
  faq: [
    { q: 'AnimaJet remplace-t-il mon matériel de DJ ?', a: "Non, c'est un complément. AnimaJet ajoute une couche d'animation interactive (quiz, blind test, photos en direct) qui s'intègre entre vos sets, sans rien changer à votre installation son et lumière." },
    { q: 'Le blind test musical est-il inclus ?', a: "Oui. Le quiz interactif permet de créer un blind test musical : vous diffusez un extrait, les invités répondent depuis leur téléphone et le classement s'affiche en direct." },
    { q: 'Puis-je afficher ma propre marque ?', a: "Oui. Vous personnalisez le logo et l'arrière-plan : ce sont votre identité et vos couleurs que les invités voient, pas celles d'AnimaJet." },
    { q: 'Comment tester avant un vrai mariage ?', a: "L'essai gratuit de 24h (en semaine, sans carte bancaire) vous donne accès à toutes les fonctionnalités pour vous entraîner en conditions réelles." },
  ],
  related: [
    { label: 'Pour les DJ & animateurs', href: '/animation-dj-interactive' },
    { label: 'Animation de mariage', href: '/animation-mariage-interactive' },
    { label: 'Blind test mariage', href: '/blind-test-mariage' },
    { label: 'Diaporama live mariage', href: '/diaporama-live-mariage' },
    { label: 'Quiz & blind test', href: '/quiz-interactif' },
    { label: "25 idées d'animation pour mariage", href: '/blog/idees-animation-mariage' },
  ],
}

const jsonLd = buildSoftwareAppJsonLd({
  name: 'AnimaJet — Logiciel DJ mariage',
  description: 'Logiciel d\'animation interactive pour DJ de mariage : quiz et blind test musical, photos en direct, jeux sur écran géant, sans application.',
  url: URL,
  featureList: ['Quiz et blind test musical', 'Photos en direct sur écran', 'Jeux interactifs', 'Personnalisation à votre marque', 'Sans application'],
  faq: content.faq,
})

export default function LogicielDjMariagePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
