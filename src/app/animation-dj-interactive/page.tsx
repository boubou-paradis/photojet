import { Metadata } from 'next'
import SEOLandingPage from '@/components/marketing/SEOLandingPage'

export const metadata: Metadata = {
  title: 'Animation DJ Interactive | Outils pour DJ & Animateurs',
  description: 'Outils d\'animation pour DJ et animateurs : photos en direct, quiz interactifs, roue de la fortune. Professionnalisez vos prestations. Essai gratuit 24h.',
  keywords: [
    'animation DJ',
    'outils DJ',
    'logiciel animation',
    'quiz musical',
    'animation animateur',
    'borne photo DJ',
    'diaporama DJ',
  ],
  alternates: {
    canonical: 'https://animajet.fr/animation-dj-interactive',
  },
  openGraph: {
    title: 'Animation DJ Interactive | AnimaJet',
    description: 'Photos en direct, quiz interactifs. L\'outil indispensable pour DJ et animateurs professionnels.',
    url: 'https://animajet.fr/animation-dj-interactive',
    type: 'website',
    locale: 'fr_FR',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AnimaJet pour DJ',
  applicationCategory: 'BusinessApplication',
  description: 'Plateforme d\'animation interactive pour DJ et animateurs professionnels : photos en direct, quiz et jeux interactifs.',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '29.90',
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
  },
  featureList: [
    'Photos en direct sur écran',
    'Quiz personnalisables',
    'Roue de la fortune',
    'QR codes personnalisés',
    'Personnalisation logo',
  ],
}

export default function AnimationDJ() {
  return (
    <SEOLandingPage
      headline="L'outil indispensable"
      highlightedText="des DJ & animateurs"
      subtitle="Photos en direct, quiz interactifs, roue de la fortune. Professionnalisez vos prestations."
      targets={[
        'DJ professionnels',
        'Animateurs',
        'MC / Maîtres de cérémonie',
        'Organisateurs d\'événements',
        'Agences événementielles',
      ]}
      jsonLd={jsonLd}
    />
  )
}
