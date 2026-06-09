// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Registre central des pages SEO (source de vérité unique).
// Consommé par : sitemap.ts (génération auto) + la page hub /fonctionnalites.
// Pour ajouter une page SEO : créer src/app/<slug>/page.tsx PUIS l'ajouter ici.

export type SeoCategory = 'pilier' | 'animation' | 'feature' | 'cible' | 'evenement' | 'hub'

export interface SeoPage {
  /** slug sans slash initial (= dossier dans src/app) */
  slug: string
  /** libellé court pour le maillage / la page hub */
  label: string
  /** description courte pour la page hub */
  blurb: string
  /** catégorie (sert au regroupement dans le hub) */
  category: SeoCategory
  /** priorité sitemap (0–1) */
  priority: number
}

export const SEO_PAGES: SeoPage[] = [
  // — Hub & pilier —
  { slug: 'fonctionnalites', label: 'Toutes les fonctionnalités', blurb: 'Le panorama complet des animations et fonctions AnimaJet.', category: 'hub', priority: 0.7 },
  { slug: 'animations-interactives-evenementielles', label: 'Animations interactives', blurb: 'La page pilier qui relie toutes les animations événementielles.', category: 'pilier', priority: 0.9 },

  // — Animations (jeux) —
  { slug: 'quiz-interactif', label: 'Quiz interactif', blurb: 'Quiz et blind test musical sur écran géant, réponses au téléphone.', category: 'animation', priority: 0.8 },
  { slug: 'roue-de-la-destinee', label: 'Roue de la Destinée', blurb: 'La roue de la fortune qui désigne le sort de vos invités.', category: 'animation', priority: 0.8 },
  { slug: 'photo-mystere', label: 'Photo Mystère', blurb: 'Une photo se dévoile case par case, à qui devinera le premier.', category: 'animation', priority: 0.8 },
  { slug: 'le-bon-ordre', label: 'Le Bon Ordre', blurb: 'Le jeu de classement qui oppose deux équipes en direct.', category: 'animation', priority: 0.8 },
  { slug: 'partage-photo-evenement', label: 'Partage photo en direct', blurb: 'Les invités envoient leurs photos, elles s’affichent en direct.', category: 'animation', priority: 0.8 },
  { slug: 'borne-photo', label: 'Borne photo', blurb: 'Une borne photo virtuelle, sans matériel à louer.', category: 'animation', priority: 0.8 },

  // — Fonctionnalités (features) —
  { slug: 'impression-photo-evenement', label: 'Impression photo sur place', blurb: 'Vos invités impriment leurs souvenirs pendant l’événement.', category: 'feature', priority: 0.8 },
  { slug: 'diaporama-live-evenement', label: 'Diaporama live', blurb: 'Le diaporama géant qui anime l’écran toute la soirée.', category: 'feature', priority: 0.8 },

  // — Cibles métier —
  { slug: 'animation-dj-interactive', label: 'Pour les DJ', blurb: 'La boîte à outils interactive des DJ et animateurs.', category: 'cible', priority: 0.9 },
  { slug: 'logiciel-dj-mariage', label: 'Logiciel DJ mariage', blurb: 'Le logiciel d’animation pensé pour les DJ de mariage.', category: 'cible', priority: 0.8 },
  { slug: 'logiciel-animateur-evenement', label: 'Logiciel animateur', blurb: 'L’outil tout-en-un des animateurs d’événements.', category: 'cible', priority: 0.8 },
  { slug: 'animation-bar-restaurant-interactive', label: 'Bars & restaurants', blurb: 'Des animations qui remplissent vos soirées à thème.', category: 'cible', priority: 0.9 },
  { slug: 'animation-camping-interactive', label: 'Campings & vacances', blurb: 'Animez les soirées de vos vacanciers sans matériel.', category: 'cible', priority: 0.9 },
  { slug: 'animation-entreprise-interactive', label: 'Soirées d’entreprise', blurb: 'Team building et soirées de CE qui fédèrent.', category: 'cible', priority: 0.9 },
  { slug: 'animation-evenementielle-interactive', label: 'Agences événementielles', blurb: 'La plateforme des pros de l’événementiel.', category: 'cible', priority: 0.9 },

  // — Types d’événement —
  { slug: 'animation-mariage-interactive', label: 'Mariage', blurb: 'Faites participer tous vos invités le jour J.', category: 'evenement', priority: 0.9 },
  { slug: 'animation-anniversaire', label: 'Anniversaire', blurb: 'Une animation mémorable pour souffler les bougies.', category: 'evenement', priority: 0.8 },
  { slug: 'animation-soiree-privee', label: 'Soirée privée', blurb: 'Transformez votre soirée entre amis en moment fort.', category: 'evenement', priority: 0.8 },
  { slug: 'animation-centre-vacances', label: 'Centres de vacances', blurb: 'Des veillées interactives pour colos et clubs.', category: 'evenement', priority: 0.8 },
]

/** Pages SEO d’une catégorie donnée (utilisé par le hub). */
export function seoPagesByCategory(category: SeoCategory): SeoPage[] {
  return SEO_PAGES.filter((p) => p.category === category)
}
