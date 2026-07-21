import { Metadata } from 'next'

// Pages de confirmation d'abonnement : aucune valeur SEO, ne doivent pas être indexées.
export const metadata: Metadata = {
  title: 'Abonnement',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SubscriptionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
