import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'AnimaJet Borne',
  description: 'Borne photo pour événements',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AnimaJet Borne',
  },
  applicationName: 'AnimaJet Borne',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function BorneLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
