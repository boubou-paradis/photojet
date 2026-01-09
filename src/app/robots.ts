import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/live/',
          '/invite/',
          '/borne/',
          '/host/',
          '/play/',
          '/join/',
          '/album/',
          '/trial/',
        ],
      },
    ],
    sitemap: 'https://animajet.fr/sitemap.xml',
  }
}
