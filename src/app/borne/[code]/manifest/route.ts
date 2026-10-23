// Manifeste dédié à la borne photo : orientation libre (vertical ET horizontal).
// Le manifeste global (public/manifest.json) reste en "portrait" pour le reste du site.
// start_url pointe sur la borne elle-même, pour que l'appli installée rouvre la bonne borne.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  if (!/^[A-Za-z0-9_-]{1,100}$/.test(code)) {
    return new Response('Not found', { status: 404 })
  }

  const manifest = {
    id: `/borne/${code}`,
    name: 'AnimaJet Borne',
    short_name: 'AnimaJet Borne',
    description: 'Borne photo pour événements',
    start_url: `/borne/${code}`,
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#1A1A1E',
    theme_color: '#D4AF37',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    lang: 'fr-FR',
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
