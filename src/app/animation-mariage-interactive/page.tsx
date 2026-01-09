import { Metadata } from 'next'
import SEOLandingPage from '@/components/marketing/SEOLandingPage'

export const metadata: Metadata = {
  title: 'Animation Mariage Interactive | Photo Booth & Jeux pour Mariage',
  description: 'Animation mariage interactive : photos des invités en direct sur écran géant, quiz musical, jeux interactifs. Vos invités participent, votre soirée décolle. Essai gratuit 24h.',
  keywords: [
    'animation mariage',
    'photo booth mariage',
    'animation soirée mariage',
    'jeux mariage',
    'diaporama mariage',
    'borne photo mariage',
    'quiz musical mariage',
    'animation invités mariage',
  ],
  alternates: {
    canonical: 'https://animajet.fr/animation-mariage-interactive',
  },
  openGraph: {
    title: 'Animation Mariage Interactive | AnimaJet',
    description: 'Photos en direct, quiz musical, jeux interactifs. L\'animation parfaite pour votre mariage.',
    url: 'https://animajet.fr/animation-mariage-interactive',
    type: 'website',
    locale: 'fr_FR',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Animation Mariage Interactive AnimaJet',
  description: 'Solution d\'animation mariage avec photos en direct, quiz musical et jeux interactifs pour faire participer tous vos invités.',
  provider: {
    '@type': 'Organization',
    name: 'AnimaJet',
    url: 'https://animajet.fr',
  },
  areaServed: 'France',
  serviceType: 'Animation mariage',
  offers: {
    '@type': 'Offer',
    price: '29.90',
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
  },
}

export default function AnimationMariage() {
  return (
    <SEOLandingPage
      headline="Votre mariage mérite"
      highlightedText="une animation inoubliable"
      subtitle="Photos des invités en direct sur écran géant, quiz musical, jeux interactifs. Vos invités participent, votre soirée décolle."
      targets={[
        'Mariages',
        'Fiançailles',
        'Anniversaires de mariage',
        'PACS',
        'Renouvellement de vœux',
      ]}
      jsonLd={jsonLd}
    />
  )
}
