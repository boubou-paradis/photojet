import { Metadata } from 'next'

// Espace d'administration : ne doit jamais apparaître dans les moteurs de recherche.
// Volontairement absent de robots.txt (un Disallow révélerait l'URL) : le noindex suffit.
export const metadata: Metadata = {
  title: 'Gestion',
  robots: {
    index: false,
    follow: false,
  },
}

export default function GestionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
