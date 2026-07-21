import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/animation-photo-mariage'

export const metadata: Metadata = {
  title: 'Animation Photo Mariage | Borne Photo, Partage Live & Impression',
  description: 'Animation photo complète pour votre mariage : borne photo, partage des photos des invités en direct via QR code et impression sur place. Sans appli. Essai gratuit 24h.',
  keywords: ['animation photo mariage', 'borne photo mariage', 'partage photo mariage', 'impression photo mariage', 'galerie photo mariage collaborative', 'photobooth mariage', 'photo invités mariage écran géant'],
  alternates: { canonical: URL },
  openGraph: {
    images: [{ url: '/images/animajet_logo_principal.png', width: 1200, height: 630, alt: 'AnimaJet - Animation interactive pour événements' }],
    title: 'Animation Photo Mariage : Borne, Partage Live & Impression | AnimaJet',
    description: 'Borne photo, partage live des photos des invités et impression sur place, réunis dans une seule plateforme pour votre mariage.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'ANIMATION PHOTO MARIAGE',
  title: 'Borne photo, partage live et impression,',
  highlight: 'toute la photo de votre mariage',
  intro: "Réunissez toute l'animation photo de votre mariage dans une seule plateforme : une borne photo pour les poses fun, le partage en direct des clichés pris par vos invités sur grand écran, et l'impression sur place des souvenirs. Tout par QR code, sans application, et une galerie complète à récupérer après la fête.",
  image: '/photo-qr-partage.png',
  what: [
    "L'animation photo est le fil rouge d'un mariage réussi : elle occupe le vin d'honneur, anime le repas et laisse des souvenirs concrets. AnimaJet rassemble trois modules photo en une seule solution. La borne photo transforme un coin de la salle en studio : vos invités posent, prennent leurs clichés et les retrouvent instantanément. Pas de matériel lourd à louer, pas de technicien à prévoir.",
    "Le partage en direct fait vivre l'écran géant toute la soirée : chaque invité scanne le QR code, envoie ses photos et les voit s'afficher en temps réel devant toute la salle. C'est le complément idéal de votre photographe — des centaines de points de vue spontanés que lui seul ne pourrait pas capter. Le DJ (ou vous) peut modérer chaque photo avant affichage, pour rester serein le jour J.",
    "L'impression sur place clôt la boucle : d'un geste depuis leur téléphone, vos invités impriment le souvenir qu'ils emportent chez eux. Et à la fin du mariage, absolument toutes les photos — borne, partage, impressions — sont réunies dans une galerie collaborative téléchargeable. Un seul QR code, aucune application, et votre mariage raconté par tous ceux qui l'ont vécu.",
  ],
  steps: [
    { title: 'Un QR code, trois usages', desc: 'Borne photo, partage live et impression, tout depuis le même code.' },
    { title: 'Les invités participent', desc: 'Ils posent, envoient et impriment leurs photos en quelques secondes.' },
    { title: 'L\'écran s\'anime', desc: 'Les clichés s\'affichent en direct, le DJ modère si besoin.' },
    { title: 'La galerie reste', desc: 'Toutes les photos réunies et téléchargeables après le mariage.' },
  ],
  benefits: [
    { emoji: '📸', title: 'Borne photo sans matériel', desc: 'Un studio virtuel pour les poses fun, sans location ni technicien.' },
    { emoji: '📺', title: 'Partage live sur grand écran', desc: 'Les photos des invités s\'affichent en temps réel devant toute la salle.' },
    { emoji: '🖨️', title: 'Impression sur place', desc: 'Vos invités impriment leur souvenir d\'un geste depuis leur téléphone.' },
    { emoji: '💍', title: 'Complète votre photographe', desc: 'Des centaines de points de vue spontanés que lui seul ne verra pas.' },
    { emoji: '🛡️', title: 'Modération par le DJ', desc: 'Validez chaque photo avant qu\'elle n\'apparaisse sur l\'écran.' },
    { emoji: '📥', title: 'Galerie collaborative', desc: 'Borne, partage et impressions réunis, téléchargeables après la fête.' },
  ],
  idealFor: ['Futurs mariés', 'DJ de mariage', 'Wedding planners', 'Photographes', 'Salles de réception', 'Domaines & châteaux'],
  faq: [
    { q: 'Quels modules photo sont inclus pour un mariage ?', a: "Trois modules réunis dans une seule plateforme : la borne photo (studio virtuel pour les poses), le partage en direct des photos des invités sur grand écran, et l'impression sur place. Tout passe par un même QR code, sans application." },
    { q: 'La borne photo nécessite-t-elle du matériel à louer ?', a: "Non. La borne photo AnimaJet est virtuelle : vos invités posent et prennent leurs clichés depuis leur propre téléphone, sans borne physique à louer ni technicien à prévoir." },
    { q: 'Le DJ peut-il modérer les photos avant l\'affichage ?', a: "Oui. En activant la modération, chaque photo attend la validation du DJ ou des mariés avant d'apparaître sur le grand écran, pour éviter toute mauvaise surprise." },
    { q: 'Comment récupère-t-on toutes les photos après le mariage ?', a: "Toutes les photos — borne, partage en direct et impressions — sont rassemblées dans une galerie collaborative téléchargeable, que vous conservez et partagez avec vos invités après l'événement." },
  ],
  related: [
    { label: 'Borne photo', href: '/borne-photo' },
    { label: 'Partage photo en direct', href: '/partage-photo-evenement' },
    { label: 'Impression photo sur place', href: '/impression-photo-evenement' },
    { label: 'Diaporama live mariage', href: '/diaporama-live-mariage' },
    { label: 'Animation de mariage', href: '/animation-mariage-interactive' },
    { label: "25 idées d'animation pour mariage", href: '/blog/idees-animation-mariage' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Animation Photo Mariage AnimaJet',
  description: 'Animation photo de mariage tout-en-un : borne photo virtuelle, partage des photos des invités en direct sur grand écran et impression sur place, avec galerie collaborative. Sans application.',
  url: URL,
  serviceType: 'Animation photo de mariage',
  faq: content.faq,
})

export default function AnimationPhotoMariagePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
