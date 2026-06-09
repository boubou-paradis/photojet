import { MetadataRoute } from 'next'
import { SEO_PAGES } from '@/lib/seo-pages'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://animajet.fr'
  const lastModified = new Date()

  // Pages SEO (source de vérité unique : src/lib/seo-pages.ts)
  const seoPages = SEO_PAGES.map((page) => ({
    url: `${baseUrl}/${page.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: page.priority,
  }))

  // Pages statiques principales (hors cluster SEO)
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/login`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/cgv`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/confidentialite`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/mentions-legales`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]

  return [...staticPages, ...seoPages]
}
