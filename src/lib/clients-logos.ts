// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Logos des abonnés affichés dans le bandeau « Ils nous font déjà confiance »
// de la page d'accueil (src/components/marketing/TrustedByMarquee.tsx).
//
// - Les fichiers vont dans public/clients/ (PNG ou WebP recadré, 400 px de large max).
// - `lien` est facultatif (site ou page Facebook) : ouvert dans un nouvel onglet, en nofollow.
// - `fond` (pastille) :
//     'clair'  (par défaut) : pastille ivoire, le blanc du fichier s'y fond → logos sur fond blanc ou transparent foncés
//     'sombre' : pastille nuit, le noir du fichier s'y fond → logos sur fond noir, ou logos blancs
//     'plein'  : l'image remplit toute la pastille → bannières avec photo ou fond coloré
// - Tant qu'il y a moins de CLIENTS_LOGOS_MIN logos, le bandeau ne s'affiche pas.

export type ClientLogo = {
  nom: string
  fichier: string
  lien?: string
  fond?: 'clair' | 'sombre' | 'plein'
}

export const CLIENTS_LOGOS_MIN = 6

export const CLIENTS_LOGOS: ClientLogo[] = [
  { nom: 'DJ Max Animation', fichier: 'dj-max-animation.webp', fond: 'sombre' },
  { nom: 'West Coast Sonorisation', fichier: 'west-coast-sonorisation.webp' },
  { nom: 'FK Animation', fichier: 'fk-animation.webp', fond: 'sombre' },
  { nom: 'Sono Dance Concept', fichier: 'sono-dance-concept.webp' },
  { nom: 'Aura Event', fichier: 'aura-event.webp', fond: 'sombre' },
  { nom: "Event's Animation by Arnaud.B", fichier: 'events-animation-arnaudb.webp', fond: 'plein' },
  { nom: 'Jam Pub', fichier: 'jam-pub.webp', fond: 'sombre' },
  { nom: 'Rab Hits', fichier: 'rab-hits.webp' },
  { nom: 'Club Pacha', fichier: 'club-pacha.webp', fond: 'sombre' },
  { nom: 'DJ Sawat', fichier: 'dj-sawat.webp', fond: 'sombre' },
  { nom: "MG Event's Animation", fichier: 'mg-events-animation.webp' },
  { nom: 'Lenge', fichier: 'lenge.webp' },
]
