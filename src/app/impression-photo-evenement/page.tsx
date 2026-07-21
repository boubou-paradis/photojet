import { Metadata } from 'next'
import AnimationDetailPage, { buildSoftwareAppJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/impression-photo-evenement'

export const metadata: Metadata = {
  title: 'Impression Photo Événement sur Place | Borne Photo Sans Matériel',
  description: 'Imprimez les photos de vos invités en direct pendant l\'événement. Impression photo sur place depuis le téléphone, sans borne à louer. Essai gratuit 24h.',
  keywords: ['impression photo événement', 'impression photo sur place', 'borne photo impression', 'imprimer photo mariage', 'impression photo soirée', 'photo souvenir événement'],
  alternates: { canonical: URL },
  openGraph: {
    images: [{ url: '/images/animajet_logo_principal.png', width: 1200, height: 630, alt: 'AnimaJet - Animation interactive pour événements' }],
    title: 'Impression Photo Événement sur Place | AnimaJet',
    description: 'Vos invités impriment leurs photos pendant la soirée, directement depuis leur téléphone.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'IMPRESSION PHOTO',
  title: 'L\'impression photo sur place',
  highlight: 'qui marque les esprits',
  intro: "Offrez à vos invités un souvenir tangible : leurs photos imprimées pendant l'événement, en quelques secondes. Pas de borne encombrante à louer, pas de technicien — tout part du téléphone de l'invité et de votre imprimante.",
  image: '/images/borne-photo.png',
  what: [
    "L'impression photo événement d'AnimaJet permet à chacun de vos invités de repartir avec un tirage de ses meilleurs moments. L'invité prend ou choisit sa photo depuis son téléphone, la valide, et la demande d'impression arrive directement sur votre tableau de bord.",
    "Vous gardez le contrôle total : mode manuel pour valider chaque tirage avant qu'il ne sorte, ou mode automatique pour une impression immédiate quand le rythme s'accélère. Une limite d'impressions configurable évite les débordements, et un compteur suit en direct le nombre de photos déjà tirées.",
    "L'option impression payante affiche un prix indicatif à l'invité avant le tirage — le règlement se fait sur place, en toute simplicité, sans paiement en ligne. Idéal pour les bars, restaurants et prestataires qui souhaitent monétiser le service tout en gardant une expérience fluide.",
  ],
  steps: [
    { title: 'L\'invité choisit sa photo', desc: 'Selfie ou photo de la galerie, depuis son propre téléphone.' },
    { title: 'La demande arrive chez vous', desc: 'Elle s\'affiche sur votre tableau de bord en temps réel.' },
    { title: 'Vous validez (ou pas)', desc: 'Mode manuel pour contrôler, ou automatique pour aller vite.' },
    { title: 'La photo s\'imprime', desc: 'Le souvenir sort sur votre imprimante, prêt à être offert.' },
  ],
  benefits: [
    { emoji: '🖨️', title: 'Sans borne à louer', desc: 'Votre imprimante suffit : zéro matériel coûteux à transporter.' },
    { emoji: '✅', title: 'Validation à la demande', desc: 'Vous approuvez chaque tirage en mode manuel, ou laissez filer en auto.' },
    { emoji: '💶', title: 'Impression payante en option', desc: 'Affichez un prix indicatif, encaissez sur place, sans Stripe ni paiement en ligne.' },
    { emoji: '🔢', title: 'Limite & compteur', desc: 'Plafonnez le nombre de tirages et suivez le compteur en direct.' },
    { emoji: '📱', title: 'Tout depuis le téléphone', desc: 'Aucune application : l\'invité reste dans son navigateur.' },
    { emoji: '🎁', title: 'Un souvenir tangible', desc: 'Vos invités repartent avec une photo en main, pas juste un fichier.' },
  ],
  idealFor: ['DJ & animateurs', 'Mariages', 'Bars & restaurants', 'Soirées d\'entreprise', 'Anniversaires', 'Campings'],
  faq: [
    { q: 'Faut-il une borne photo spéciale pour imprimer ?', a: "Non. AnimaJet utilise votre propre imprimante : la demande d'impression arrive sur votre tableau de bord et vous l'envoyez à l'imprimante connectée. Aucune borne à louer." },
    { q: 'Comment fonctionne l\'impression payante ?', a: "Vous activez l'option et saisissez un prix. Avant d'imprimer, l'invité voit une fenêtre indiquant le prix de l'impression. Le paiement se fait physiquement avec vous : il n'y a aucun paiement en ligne." },
    { q: 'Puis-je limiter le nombre d\'impressions ?', a: "Oui, vous définissez une limite (50, 100, 150 ou illimité) et un compteur suit en direct le nombre de tirages déjà effectués." },
    { q: 'L\'invité doit-il installer une application ?', a: "Non. Il scanne un QR code, choisit sa photo et demande l'impression directement depuis son navigateur." },
  ],
  related: [
    { label: 'Borne photo', href: '/borne-photo' },
    { label: 'Partage photo en direct', href: '/partage-photo-evenement' },
    { label: 'Diaporama live', href: '/diaporama-live-evenement' },
    { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  ],
}

const jsonLd = buildSoftwareAppJsonLd({
  name: 'Impression photo événement AnimaJet',
  description: 'Solution d\'impression photo sur place pour événements : les invités impriment leurs photos depuis leur téléphone, sans borne à louer.',
  url: URL,
  featureList: ['Impression depuis le téléphone', 'Mode manuel ou automatique', 'Impression payante (paiement sur place)', 'Limite et compteur d\'impressions', 'Sans borne ni application'],
  faq: content.faq,
})

export default function ImpressionPhotoEvenementPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
