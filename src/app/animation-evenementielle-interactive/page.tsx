import { Metadata } from 'next'
import SEOLandingPage from '@/components/marketing/SEOLandingPage'

export const metadata: Metadata = {
  title: 'Animation Événementielle Interactive | Photos & Jeux en Direct',
  description: 'Solution d\'animation événementielle interactive : photos en direct sur écran géant, 7 jeux interactifs, QR codes personnalisés. Idéal pour tous types d\'événements. Essai gratuit 24h.',
  keywords: [
    'animation événementielle',
    'animation interactive',
    'animation soirée',
    'photo booth événement',
    'jeux interactifs événement',
    'diaporama en direct',
    'animation QR code',
    'écran géant événement',
  ],
  alternates: {
    canonical: 'https://animajet.fr/animation-evenementielle-interactive',
  },
  openGraph: {
    title: 'Animation Événementielle Interactive | AnimaJet',
    description: 'Photos en direct, 7 jeux interactifs, QR codes personnalisés. La solution complète pour animer tous vos événements.',
    url: 'https://animajet.fr/animation-evenementielle-interactive',
    type: 'website',
    locale: 'fr_FR',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Animation Événementielle Interactive AnimaJet',
  description: 'Solution d\'animation événementielle interactive avec photos en direct, jeux interactifs et QR codes personnalisés.',
  provider: {
    '@type': 'Organization',
    name: 'AnimaJet',
    url: 'https://animajet.fr',
  },
  areaServed: 'France',
  serviceType: 'Animation événementielle',
  offers: {
    '@type': 'Offer',
    price: '29.90',
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
  },
}

export default function AnimationEvenementielle() {
  return (
    <SEOLandingPage
      headline="Professionnalisez"
      highlightedText="vos animations événementielles"
      subtitle="Photos en direct, jeux interactifs, QR codes personnalisés. L'outil qui booste vos prestations."
      targets={[
        'DJ & Animateurs',
        'Agences événementielles',
        'Organisateurs de festivals',
        'Prestataires techniques',
        'Loueurs de matériel',
      ]}
      jsonLd={jsonLd}
    />
  )
}
