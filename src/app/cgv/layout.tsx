import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente | AnimaJet',
  description: 'Conditions générales de vente du service AnimaJet - Plateforme d\'animation interactive pour événements.',
  alternates: {
    canonical: 'https://animajet.fr/cgv',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function CGVLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
