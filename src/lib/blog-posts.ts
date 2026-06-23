// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Registre central des articles de blog (source de vérité unique).
// Consommé par : src/app/blog/page.tsx (index) + src/app/sitemap.ts.
// Pour ajouter un article : créer src/app/blog/<slug>/page.tsx PUIS l'ajouter ici.

export interface BlogPostMeta {
  /** slug sans slash (= dossier dans src/app/blog) */
  slug: string
  /** titre affiché sur la carte de l'index */
  title: string
  /** accroche courte (carte index + meta) */
  excerpt: string
  /** catégorie éditoriale */
  category: string
  /** date de publication ISO (YYYY-MM-DD) */
  date: string
  /** durée de lecture (libellé) */
  readingTime: string
  /** image de couverture (chemin public) */
  image: string
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: 'idees-animation-mariage',
    title: "Idées d'animation pour mariage : 25 jeux pour faire participer vos invités",
    excerpt:
      "Du vin d'honneur à la piste de danse : des idées d'animation classées par moment, plus le format interactif qui fait vraiment participer toute la salle.",
    category: 'Mariage',
    date: '2026-06-23',
    readingTime: '9 min',
    image: '/photo-qr-partage.png',
  },
]

/** Article par slug (ou undefined). */
export function getBlogPost(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug)
}
