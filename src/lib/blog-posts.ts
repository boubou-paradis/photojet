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
    slug: '50-questions-quiz-mariage',
    title: '50 questions pour réussir un quiz de mariage',
    excerpt:
      "50 questions originales et bienveillantes, classées par thème (les mariés, la rencontre, l'enfance, les invités, la musique), pour composer un quiz de mariage inoubliable.",
    category: 'Mariage',
    date: '2026-07-01',
    readingTime: '9 min',
    image: '/images/games/quiz.png',
  },
  {
    slug: 'animation-entre-les-plats-mariage',
    title: 'Animation entre les plats de mariage : que faire sans lasser les invités ?',
    excerpt:
      "Des formats courts qui relancent l'énergie sans casser le service : minutage plat par plat, 6 idées express et les règles pour rester compatible avec le traiteur.",
    category: 'Mariage',
    date: '2026-07-01',
    readingTime: '8 min',
    image: '/photo-qr-partage.png',
  },
  {
    slug: 'soiree-quiz-bar',
    title: 'Soirée quiz dans un bar : le guide complet pour attirer du monde',
    excerpt:
      "Quel jour, quel format, quel déroulé pour remplir un soir creux et créer un rendez-vous hebdomadaire — sans matériel et sans comptage manuel des points.",
    category: 'Bar & restaurant',
    date: '2026-07-01',
    readingTime: '9 min',
    image: '/images/games/quiz.png',
  },
  {
    slug: 'blind-test-bar',
    title: 'Blind test dans un bar : créer une soirée qui revient chaque semaine',
    excerpt:
      "Construire la playlist, dérouler les manches, gérer les scores automatiquement et transformer chaque téléphone en buzzer, sans valise de buzzers à louer.",
    category: 'Bar & restaurant',
    date: '2026-07-01',
    readingTime: '8 min',
    image: '/hero-animajet-1.jpg',
  },
  {
    slug: 'animation-camping-soiree',
    title: 'Animation camping en soirée : idées simples pour faire participer tout le monde',
    excerpt:
      "Animer un public de tous âges qui change chaque semaine, avec peu de matériel : 6 idées interactives jouables au téléphone, sur simple écran ou vidéoprojecteur.",
    category: 'Camping & vacances',
    date: '2026-07-01',
    readingTime: '8 min',
    image: '/photo-qr-partage.png',
  },
  {
    slug: 'animation-dj-option-premium',
    title: 'Comment un DJ peut valoriser sa prestation avec une animation interactive',
    excerpt:
      "Se différencier sans promettre de revenus : comment l'interactif (quiz, blind test, photos live) enrichit l'expérience client et se présente proprement dans une offre.",
    category: 'DJ & animateurs',
    date: '2026-07-01',
    readingTime: '8 min',
    image: '/hero-animajet-1.jpg',
  },
  {
    slug: 'organiser-blind-test-mariage',
    title: 'Comment organiser un blind test réussi à un mariage : le guide complet',
    excerpt:
      "Combien de titres, quels thèmes, comment gérer les scores et pourquoi le smartphone a remplacé les buzzers. Le guide d'un DJ animateur pour un blind test de mariage inoubliable.",
    category: 'Mariage',
    date: '2026-07-01',
    readingTime: '8 min',
    image: '/hero-animajet-1.jpg',
  },
  {
    slug: 'diaporama-live-mariage-guide',
    title: 'Diaporama live à un mariage : le guide pratique pour DJ et animateurs',
    excerpt:
      "Comment ça marche, quand le lancer dans la soirée, comment modérer les photos et récupérer la galerie. Le guide terrain du diaporama live de mariage, vu depuis la régie.",
    category: 'Mariage',
    date: '2026-07-01',
    readingTime: '7 min',
    image: '/photo-qr-partage.png',
  },
  {
    slug: 'animation-soiree-entreprise-idees',
    title: "10 idées d'animation pour une soirée d'entreprise mémorable",
    excerpt:
      "Blind test, quiz, photo live et jeux interactifs qui impliquent vraiment tous les collaborateurs, du stagiaire à la direction. 10 idées testées sur le terrain.",
    category: 'Entreprise',
    date: '2026-07-01',
    readingTime: '9 min',
    image: '/images/games/quiz.png',
  },
  {
    slug: 'animer-repas-mariage',
    title: 'Comment animer un repas de mariage sans casser le rythme du service',
    excerpt:
      "Les erreurs qui plombent la soirée, la durée idéale des animations et le minutage plat par plat. Du vrai retour terrain, vu depuis la régie.",
    category: 'Mariage',
    date: '2026-06-23',
    readingTime: '8 min',
    image: '/images/games/quiz.png',
  },
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
