import { Metadata } from 'next'
import AnimationDetailPage, { buildSoftwareAppJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/diaporama-live-mariage'

export const metadata: Metadata = {
  title: 'Diaporama Live Mariage : les photos des invités',
  description: 'Vos invités envoient leurs photos par QR code, elles s\'affichent en direct sur grand écran pendant le mariage. Sans appli. Essai gratuit 24h.',
  keywords: ['diaporama live mariage', 'diaporama mariage en direct', 'photo invités grand écran mariage', 'partage photo mariage QR code', 'mur de photos mariage', 'projection photo mariage temps réel', 'slideshow mariage interactif'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Diaporama Live Mariage sur Écran Géant | AnimaJet',
    description: 'Les photos de vos invités s\'affichent en direct sur grand écran pendant tout le mariage, du vin d\'honneur à la soirée.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'DIAPORAMA LIVE MARIAGE',
  title: 'Les photos de vos invités en direct,',
  highlight: 'sur grand écran le jour J',
  intro: "Le jour de votre mariage, chaque invité devient photographe. Ils scannent un QR code, envoient leurs plus beaux clichés, et tout s'affiche en direct sur grand écran — du vin d'honneur jusqu'au bout de la nuit. Un diaporama live qui capture des instants que même votre photographe ne verra pas.",
  image: '/photo-qr-partage.png',
  what: [
    "Le diaporama live de mariage transforme votre écran ou votre vidéoprojecteur en album vivant de la journée. Pendant le vin d'honneur, le dîner et la soirée dansante, vos invités prennent des photos avec leur propre téléphone et les envoient en quelques secondes après avoir scanné le QR code affiché sur les tables. Chaque cliché rejoint le grand écran sous les yeux de tous : les enfants qui courent, les fous rires à table, les larmes des parents, les pas de danse improvisés.",
    "C'est le complément idéal de votre photographe professionnel. Lui capture les moments posés et les instants clés ; le diaporama live, lui, récolte les centaines de points de vue spontanés que seuls vos invités peuvent saisir. À la place d'un livre d'or classique, vos proches laissent aussi des messages écrits qui défilent entre les photos, pour un mur de souvenirs qui se construit en temps réel.",
    "Vous — ou votre DJ — gardez le contrôle du début à la fin : durée d'affichage et transitions réglables, modération optionnelle pour valider chaque photo avant qu'elle n'apparaisse, QR code affiché en permanence pour les retardataires. Le diaporama reste fluide même avec des centaines de clichés et bascule en plein écran d'un clic, y compris sur Mac. Et à la fin de la fête, toutes les photos restent réunies dans un album téléchargeable : votre mariage vu par tous ceux qui l'ont vécu.",
  ],
  steps: [
    { title: 'Le QR code sur les tables', desc: 'Chaque invité scanne et participe, sans rien installer.' },
    { title: 'Les photos arrivent', desc: 'Du vin d\'honneur à la soirée, chaque cliché s\'affiche en quelques secondes.' },
    { title: 'Le grand écran s\'anime', desc: 'Photos et messages des invités défilent en grand format toute la soirée.' },
    { title: 'Vous gardez la main', desc: 'Modération, transitions, durée : tout se règle en direct.' },
  ],
  benefits: [
    { emoji: '💍', title: 'Vos invités, vos photographes', desc: 'Des centaines de points de vue spontanés que votre photographe ne verra pas.' },
    { emoji: '📺', title: 'Spectacle sur grand écran', desc: 'Les photos s\'affichent en direct : l\'écran devient le cœur de la soirée.' },
    { emoji: '💬', title: 'Messages des invités', desc: 'Les mots doux et félicitations défilent entre les photos, comme un livre d\'or vivant.' },
    { emoji: '🛡️', title: 'Modération optionnelle', desc: 'Validez chaque photo avant affichage, pour rester serein le jour J.' },
    { emoji: '📱', title: 'Sans application', desc: 'Un QR code suffit : des enfants aux grands-parents, tout le monde participe.' },
    { emoji: '📥', title: 'Album après le mariage', desc: 'Toutes les photos réunies et téléchargeables, votre mariage vu par tous.' },
  ],
  idealFor: ['Futurs mariés', 'DJ de mariage', 'Wedding planners', 'Témoins & organisateurs', 'Salles de réception', 'Domaines & châteaux'],
  faq: [
    { q: 'Comment mes invités envoient-ils leurs photos pendant le mariage ?', a: "Ils scannent le QR code affiché sur les tables ou sur l'écran, prennent ou choisissent une photo, et celle-ci s'affiche en direct sur le grand écran en quelques secondes. Aucune application à télécharger, aucun compte à créer." },
    { q: 'Le diaporama live remplace-t-il le photographe de mariage ?', a: "Non, il le complète. Votre photographe capture les moments clés et les photos posées ; le diaporama live récolte les centaines de clichés spontanés pris par vos invités, sous des angles que personne d'autre ne peut saisir." },
    { q: 'Puis-je modérer les photos avant qu\'elles s\'affichent sur l\'écran ?', a: "Oui. En activant la modération, chaque photo attend votre validation (ou celle de votre DJ) avant d'apparaître sur le grand écran, pour éviter toute mauvaise surprise le jour J." },
    { q: 'Que deviennent les photos après le mariage ?', a: "Elles sont toutes réunies dans un album téléchargeable, que vous pouvez conserver et partager avec vos invités après la fête — un souvenir collectif de votre mariage." },
    { q: 'Le diaporama fonctionne-t-il sur le vidéoprojecteur de la salle ?', a: "Parfaitement. Vous basculez en plein écran d'un clic, y compris sur Mac, pour un affichage optimal sur la TV, l'écran géant ou le vidéoprojecteur de votre salle de réception." },
  ],
  related: [
    { label: 'Diaporama live (tous événements)', href: '/diaporama-live-evenement' },
    { label: 'Animation de mariage', href: '/animation-mariage-interactive' },
    { label: 'Quiz de mariage', href: '/quiz-mariage' },
    { label: 'Blind test mariage', href: '/blind-test-mariage' },
    { label: 'Impression photo sur place', href: '/impression-photo-evenement' },
    { label: "25 idées d'animation pour mariage", href: '/blog/idees-animation-mariage' },
  ],
}

const jsonLd = buildSoftwareAppJsonLd({
  name: 'Diaporama live mariage AnimaJet',
  description: 'Diaporama live de mariage : les invités envoient leurs photos via QR code, elles s\'affichent en direct sur grand écran pendant toute la fête, avec modération et album final. Sans application.',
  url: URL,
  featureList: ['Photos des invités en direct sur grand écran', 'Envoi par QR code sans application', 'Messages des invités intercalés', 'Modération optionnelle', 'Plein écran TV / vidéoprojecteur', 'Album téléchargeable après le mariage'],
  faq: content.faq,
})

export default function DiaporamaLiveMariagePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
