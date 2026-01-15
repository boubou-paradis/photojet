import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion | AnimaJet',
  description: 'Connectez-vous à votre espace AnimaJet pour gérer vos animations interactives et accéder au dashboard.',
  alternates: {
    canonical: 'https://animajet.fr/login',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
