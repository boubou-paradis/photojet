import { Metadata } from 'next'

// Démo applicative (contenu client-side, sans valeur d'indexation) : noindex,
// mais follow pour laisser circuler le maillage si la page est liée.
export const metadata: Metadata = {
  title: 'Démo',
  robots: {
    index: false,
    follow: true,
  },
}

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
