// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Liste unique des jeux cités dans les textes et métadonnées des pages publiques.
// Ajouter un jeu ici met à jour le nombre et les noms partout où ils sont repris.
//
// RAPPEL — quand on ajoute un jeu, mettre aussi à jour À LA MAIN :
// - public/llms.txt (intro + une ligne vers la page du jeu)
// - les CGV : src/app/cgv/page.tsx (article 2 + date « Dernière mise à jour »)
// - les mentions légales : src/app/mentions-legales/page.tsx
// Ces fichiers restent manuels volontairement (fichier statique / documents contractuels).

export const GAMES = [
  { name: 'Quiz', href: '/quiz-interactif' },
  { name: 'Roue de la Destinée', href: '/roue-de-la-destinee' },
  { name: 'Photo Mystère', href: '/photo-mystere' },
  { name: 'Le Bon Ordre', href: '/le-bon-ordre' },
  { name: 'Matching', href: '/jeu-points-communs' },
  { name: 'AnimaBuzz', href: '/jeu-buzzer' },
  { name: 'AnimaVote', href: '/jeu-vote' },
] as const

export const GAMES_COUNT = GAMES.length

const NOMBRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze']
/** Le nombre en lettres (« sept »), pour les phrases */
export const GAMES_COUNT_WORDS = NOMBRES[GAMES_COUNT] ?? String(GAMES_COUNT)

const names: string[] = GAMES.map((g) => g.name)
/** « Quiz, Roue de la Destinée, Photo Mystère, Le Bon Ordre, Matching, AnimaBuzz, AnimaVote » */
export const GAME_NAMES = names.join(', ')
/** « Quiz, Roue de la Destinée, …, AnimaBuzz et AnimaVote » */
export const GAME_NAMES_AND = `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
