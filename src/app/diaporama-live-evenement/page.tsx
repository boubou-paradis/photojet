import { Metadata } from 'next'
import AnimationDetailPage, { buildSoftwareAppJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/diaporama-live-evenement'

export const metadata: Metadata = {
  title: 'Diaporama Live Événement sur Écran Géant | Photos en Direct',
  description: 'Affichez les photos et messages de vos invités en direct sur écran géant. Diaporama live temps réel via QR code, sans application. Essai gratuit 24h.',
  keywords: ['diaporama live', 'diaporama événement', 'photos écran géant', 'diaporama mariage direct', 'mur de photos live', 'diaporama soirée temps réel'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Diaporama Live sur Écran Géant | AnimaJet',
    description: 'Les photos de vos invités s\'affichent en direct sur grand écran, toute la soirée.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'DIAPORAMA LIVE',
  title: 'Le diaporama live qui',
  highlight: 'anime tout l\'écran',
  intro: "Transformez votre écran ou vidéoprojecteur en cœur battant de la soirée. Les photos et messages de vos invités s'affichent en direct, en quelques secondes, et défilent en grand format devant toute la salle.",
  image: '/photo-qr-partage.png',
  what: [
    "Le diaporama live d'AnimaJet projette en temps réel les photos envoyées par vos invités. Chacun scanne un QR code, prend ou choisit une photo, et celle-ci rejoint le diaporama géant sous les yeux de tous. L'effet est immédiat : la salle regarde l'écran, rit, et continue d'alimenter le flux.",
    "Vous pilotez l'expérience de bout en bout : transitions et durée d'affichage réglables, messages des invités intercalés entre les photos, affiches promotionnelles en rotation, et un QR code affiché en permanence pour inviter les retardataires à participer. La modération optionnelle vous laisse valider chaque contenu avant qu'il n'apparaisse.",
    "Pensé pour le grand écran, le diaporama reste fluide même avec des centaines de photos, et bascule en plein écran d'un clic — y compris sur Mac. À la fin de la soirée, toutes les photos restent accessibles dans un album téléchargeable.",
  ],
  steps: [
    { title: 'Affichez le QR code', desc: 'Sur l\'écran, sur les tables : les invités scannent et participent.' },
    { title: 'Les photos arrivent', desc: 'Chaque envoi rejoint le diaporama en quelques secondes.' },
    { title: 'Le diaporama tourne', desc: 'Photos, messages et affiches défilent en grand format.' },
    { title: 'Vous gardez la main', desc: 'Transitions, durée, modération : tout se règle en direct.' },
  ],
  benefits: [
    { emoji: '📺', title: 'Spectacle sur grand écran', desc: 'Les photos s\'affichent en direct, l\'écran devient le centre de la fête.' },
    { emoji: '⚡', title: 'Temps réel', desc: 'Une photo envoyée apparaît à l\'écran en quelques secondes.' },
    { emoji: '💬', title: 'Messages intercalés', desc: 'Les mots doux et félicitations des invités défilent entre les photos.' },
    { emoji: '🛡️', title: 'Modération optionnelle', desc: 'Validez chaque contenu avant affichage, en un coup d\'œil.' },
    { emoji: '🖥️', title: 'Plein écran, même sur Mac', desc: 'Basculez en plein écran d\'un clic sur votre TV ou vidéoprojecteur.' },
    { emoji: '📥', title: 'Album à la fin', desc: 'Toutes les photos restent téléchargeables après l\'événement.' },
  ],
  idealFor: ['DJ & animateurs', 'Mariages', 'Soirées d\'entreprise', 'Bars & restaurants', 'Anniversaires', 'Campings'],
  faq: [
    { q: 'Comment les photos arrivent-elles sur le diaporama ?', a: "Les invités scannent un QR code, prennent ou choisissent une photo, et celle-ci s'affiche en direct sur l'écran en quelques secondes. Aucune application n'est nécessaire." },
    { q: 'Puis-je modérer les photos avant qu\'elles s\'affichent ?', a: "Oui. En activant la modération, chaque photo ou message attend votre validation avant d'apparaître sur le grand écran." },
    { q: 'Le diaporama fonctionne-t-il en plein écran sur un vidéoprojecteur ?', a: "Parfaitement. Vous basculez en plein écran d'un clic, y compris sur Mac, pour un affichage optimal sur TV ou vidéoprojecteur." },
    { q: 'Que deviennent les photos après la soirée ?', a: "Elles restent disponibles dans un album téléchargeable, que vous pouvez partager avec vos invités après l'événement." },
  ],
  related: [
    { label: 'Partage photo en direct', href: '/partage-photo-evenement' },
    { label: 'Impression photo sur place', href: '/impression-photo-evenement' },
    { label: 'Borne photo', href: '/borne-photo' },
    { label: 'Toutes les fonctionnalités', href: '/fonctionnalites' },
  ],
}

const jsonLd = buildSoftwareAppJsonLd({
  name: 'Diaporama live événement AnimaJet',
  description: 'Diaporama live qui affiche en temps réel les photos et messages des invités sur écran géant, via QR code et sans application.',
  url: URL,
  featureList: ['Photos en direct sur écran géant', 'Messages des invités intercalés', 'Transitions et durée réglables', 'Modération optionnelle', 'Plein écran TV / vidéoprojecteur'],
  faq: content.faq,
})

export default function DiaporamaLiveEvenementPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
