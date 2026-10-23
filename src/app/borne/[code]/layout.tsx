import type { Metadata, Viewport } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}): Promise<Metadata> {
  const { code } = await params
  return {
    title: 'AnimaJet Borne',
    description: 'Borne photo pour événements',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'AnimaJet Borne',
    },
    applicationName: 'AnimaJet Borne',
    // Manifeste propre à la borne (orientation libre), cf. ./manifest/route.ts
    manifest: `/borne/${encodeURIComponent(code)}/manifest`,
  }
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
