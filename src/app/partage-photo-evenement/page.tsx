import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/partage-photo-evenement'

export const metadata: Metadata = {
  title: 'Partage Photo en Direct : galerie sur écran géant',
  description: 'Vos invités envoient leurs photos, la galerie s\'affiche en direct sur écran géant. Album partagé téléchargeable, sans appli. Essai gratuit 24h.',
  keywords: ['partage photo événement', 'partage photos événement', 'partage photo mariage QR code', 'photo invités écran géant mariage', 'galerie photo collaborative mariage', 'animation photos en direct', 'animation photo direct', 'mur photo interactif', 'photo en direct écran géant', 'album photo partagé', 'photo live soirée', 'wall photo événement'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Partage Photo en Direct | AnimaJet',
    description: 'Les photos de vos invités s\'affichent en direct sur écran géant, avec album partagé téléchargeable.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'PARTAGE PHOTO EN DIRECT',
  title: 'Le partage photo en direct,',
  highlight: 'le mur de souvenirs vivant',
  intro: "Vos invités prennent des photos avec leur téléphone et les envoient en un geste : elles s'affichent aussitôt en direct sur votre écran géant. Un mur photo qui se remplit en temps réel pendant la soirée, et un album partagé que tout le monde pourra télécharger.",
  image: '/photo-qr-partage.png',
  what: [
    "Le partage photo en direct transforme votre écran en un mur de souvenirs vivant. Après avoir scanné le QR code, chaque invité peut envoyer ses photos depuis son téléphone : elles apparaissent immédiatement dans le diaporama projeté sur grand écran.",
    "Vous gardez le contrôle grâce à la modération : validez les photos avant affichage si vous le souhaitez. Toutes les images sont rassemblées dans un album partagé, téléchargeable en un clic (ZIP) à la fin de l'événement.",
    "C'est l'animation idéale pour les mariages et les soirées : elle capte des moments spontanés que personne d'autre ne photographie, crée du lien autour de l'écran, et offre un magnifique souvenir collectif après la fête.",
  ],
  steps: [
    { title: 'Affichez le QR code', desc: 'Les invités le scannent pour accéder à l\'envoi de photos.' },
    { title: 'Ils envoient leurs photos', desc: 'Depuis leur téléphone, en quelques secondes, sans application.' },
    { title: 'Affichage en direct', desc: 'Les photos apparaissent aussitôt dans le diaporama sur écran géant.' },
    { title: 'Album partagé', desc: 'Toutes les photos sont rassemblées et téléchargeables en ZIP.' },
  ],
  benefits: [
    { emoji: '📸', title: 'Souvenirs spontanés', desc: 'Captez les moments que le photographe officiel ne voit pas.' },
    { emoji: '📺', title: 'Mur photo en direct', desc: 'Le diaporama se remplit en temps réel et anime la salle.' },
    { emoji: '🛡️', title: 'Modération', desc: 'Validez les photos avant affichage pour rester serein.' },
    { emoji: '📦', title: 'Album téléchargeable', desc: 'Récupérez toutes les photos en un clic, au format ZIP.' },
    { emoji: '🎨', title: 'À votre image', desc: 'Logo et arrière-plan personnalisés sur le diaporama.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un simple QR code, aucune installation pour les invités.' },
  ],
  idealFor: ['Mariages', 'Soirées d\'entreprise', 'Anniversaires', 'Campings', 'Baptêmes & EVJF/EVG', 'Événementiel'],
  faq: [
    { q: 'Les photos s\'affichent-elles vraiment en direct ?', a: "Oui, dès qu'un invité envoie une photo, elle apparaît dans le diaporama projeté sur écran géant." },
    { q: 'Puis-je modérer les photos avant affichage ?', a: "Oui, la modération vous permet de valider les contenus avant qu'ils n'apparaissent à l'écran." },
    { q: 'Peut-on récupérer toutes les photos après l\'événement ?', a: "Oui, l'ensemble des photos est rassemblé dans un album partagé, téléchargeable en ZIP." },
    { q: 'Les invités doivent-ils créer un compte ?', a: "Non : ils scannent le QR code et envoient leurs photos directement, sans compte ni application." },
  ],
  related: [
    { label: 'Diaporama live mariage', href: '/diaporama-live-mariage' },
    { label: 'Borne photo', href: '/borne-photo' },
    { label: 'Impression photo sur place', href: '/impression-photo-evenement' },
    { label: 'Animation mariage', href: '/animation-mariage-interactive' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Partage Photo en Direct AnimaJet',
  description: 'Mur photo interactif : les invités envoient leurs photos depuis leur téléphone, affichées en direct sur écran géant, avec album partagé téléchargeable.',
  url: URL,
  serviceType: 'Animation partage photo',
  faq: content.faq,
})

export default function PartagePhotoPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
