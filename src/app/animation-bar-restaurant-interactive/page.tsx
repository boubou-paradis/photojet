import { Metadata } from 'next'
import SEOLandingPage from '@/components/marketing/SEOLandingPage'

export const metadata: Metadata = {
  title: 'Animation Bar & Restaurant | Blind Test, Quiz & Soirées Interactives',
  description: 'Remplissez votre bar ou restaurant en semaine : soirées quiz, jeux interactifs et partage photo en direct sur écran géant. Vos clients jouent depuis leur téléphone, sans application. Essai gratuit 24h.',
  keywords: [
    'animation bar',
    'animation restaurant',
    'animation bar restaurant',
    'soirée quiz bar',
    'blind test bar',
    'quiz restaurant',
    'fidélisation clientèle bar',
    'soirée à thème bar',
    'animation pub brasserie',
  ],
  alternates: {
    canonical: 'https://animajet.fr/animation-bar-restaurant-interactive',
  },
  openGraph: {
    title: 'Animation Bar & Restaurant Interactive | AnimaJet',
    description: 'Soirées quiz et jeux interactifs pour remplir votre établissement et fidéliser vos clients.',
    url: 'https://animajet.fr/animation-bar-restaurant-interactive',
    type: 'website',
    locale: 'fr_FR',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Animation Bar & Restaurant Interactive AnimaJet',
  description: 'Solution d\'animation pour bars et restaurants : soirées quiz, jeux interactifs et partage photo en direct pour faire participer tous les clients.',
  provider: {
    '@type': 'Organization',
    name: 'AnimaJet',
    url: 'https://animajet.fr',
  },
  areaServed: 'France',
  serviceType: 'Animation bar et restaurant',
  offers: {
    '@type': 'Offer',
    price: '29.90',
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
  },
}

export default function AnimationBarRestaurant() {
  return (
    <SEOLandingPage
      headline="Remplissez votre salle"
      highlightedText="avec des soirées interactives"
      subtitle="Soirées quiz, jeux et partage photo en direct sur écran géant. Vos clients jouent depuis leur téléphone, restent plus longtemps et reviennent."
      targets={[
        'Bars & pubs',
        'Restaurants',
        'Brasseries',
        'Clubs & discothèques',
        'Cafés-concerts',
      ]}
      jsonLd={jsonLd}
    />
  )
}
