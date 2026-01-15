import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de Confidentialité | AnimaJet',
  description: 'Politique de confidentialité et protection des données personnelles - AnimaJet, conforme RGPD.',
  alternates: {
    canonical: 'https://animajet.fr/confidentialite',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function ConfidentialiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
