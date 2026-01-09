import { Metadata } from 'next'
import SEOLandingPage from '@/components/marketing/SEOLandingPage'

export const metadata: Metadata = {
  title: 'Animation Entreprise Interactive | Team Building & Événements Corporate',
  description: 'Animation entreprise interactive : séminaires, team building, soirées corporate. Photos en direct, quiz personnalisés, jeux d\'équipe. Renforcez la cohésion. Essai gratuit 24h.',
  keywords: [
    'animation entreprise',
    'animation team building',
    'animation séminaire',
    'animation corporate',
    'jeux entreprise',
    'soirée entreprise',
    'animation CE',
    'événement corporate',
  ],
  alternates: {
    canonical: 'https://animajet.fr/animation-entreprise-interactive',
  },
  openGraph: {
    title: 'Animation Entreprise Interactive | AnimaJet',
    description: 'Team building, séminaires, soirées corporate. Renforcez la cohésion avec des animations interactives.',
    url: 'https://animajet.fr/animation-entreprise-interactive',
    type: 'website',
    locale: 'fr_FR',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Animation Entreprise Interactive AnimaJet',
  description: 'Solution d\'animation pour entreprises : team building, séminaires et événements corporate avec jeux interactifs et photos en direct.',
  provider: {
    '@type': 'Organization',
    name: 'AnimaJet',
    url: 'https://animajet.fr',
  },
  areaServed: 'France',
  serviceType: 'Animation entreprise',
  offers: {
    '@type': 'Offer',
    price: '29.90',
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
  },
}

export default function AnimationEntreprise() {
  return (
    <SEOLandingPage
      headline="Dynamisez vos événements"
      highlightedText="d'entreprise"
      subtitle="Team building, séminaires, soirées corporate. Renforcez la cohésion avec des quiz personnalisés et des jeux d'équipe."
      targets={[
        'Séminaires',
        'Team building',
        'Soirées corporate',
        'Lancements produit',
        'Événements CE',
      ]}
      jsonLd={jsonLd}
    />
  )
}
