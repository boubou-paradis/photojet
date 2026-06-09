import { Metadata } from 'next'
import SEOLandingPage from '@/components/marketing/SEOLandingPage'

export const metadata: Metadata = {
  title: 'Animation Camping Interactive | Soirées & Jeux pour Vacanciers',
  description: 'Animez vos soirées camping : quiz, roue de la destinée, photo mystère et partage photo en direct sur écran géant. Vos vacanciers participent depuis leur téléphone, sans application. Essai gratuit 24h.',
  keywords: [
    'animation camping',
    'animation camping interactive',
    'soirée camping',
    'animation vacanciers',
    'jeux camping',
    'quiz camping',
    'animation club enfants camping',
    'soirée animation camping',
    'écran géant camping',
  ],
  alternates: {
    canonical: 'https://animajet.fr/animation-camping-interactive',
  },
  openGraph: {
    title: 'Animation Camping Interactive | AnimaJet',
    description: 'Quiz, jeux interactifs et partage photo en direct. Faites participer tous vos vacanciers depuis leur téléphone.',
    url: 'https://animajet.fr/animation-camping-interactive',
    type: 'website',
    locale: 'fr_FR',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Animation Camping Interactive AnimaJet',
  description: 'Solution d\'animation pour campings : quiz, jeux interactifs et partage photo en direct pour faire participer tous les vacanciers.',
  provider: {
    '@type': 'Organization',
    name: 'AnimaJet',
    url: 'https://animajet.fr',
  },
  areaServed: 'France',
  serviceType: 'Animation camping',
  offers: {
    '@type': 'Offer',
    price: '29.90',
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
  },
}

export default function AnimationCamping() {
  return (
    <SEOLandingPage
      headline="Des soirées camping"
      highlightedText="dont tout le monde se souvient"
      subtitle="Quiz, jeux interactifs et partage photo en direct sur écran géant. Faites participer familles et vacanciers, sans application à installer."
      targets={[
        'Campings & villages vacances',
        'Animateurs camping',
        'Clubs vacances',
        'Mobil-homes & résidences',
        'Bases de loisirs',
      ]}
      jsonLd={jsonLd}
    />
  )
}
