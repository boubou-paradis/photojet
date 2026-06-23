import { MetadataRoute } from 'next'
import { SEO_PAGES } from '@/lib/seo-pages'
import { BLOG_POSTS } from '@/lib/blog-posts'

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

  // Blog : index + articles (source de vérité : src/lib/blog-posts.ts)
  const blogPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/blog`, lastModified, changeFrequency: 'weekly', priority: 0.6 },
    ...BLOG_POSTS.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]

  // Pages statiques principales (hors cluster SEO)
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/cgv`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/confidentialite`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/mentions-legales`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]

  return [...staticPages, ...seoPages, ...blogPages]
}
