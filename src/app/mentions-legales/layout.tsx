import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mentions Légales | AnimaJet',
  description: 'Mentions légales du site AnimaJet - MG Events Animation, éditeur de la plateforme d\'animation interactive.',
  alternates: {
    canonical: 'https://animajet.fr/mentions-legales',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function MentionsLegalesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
