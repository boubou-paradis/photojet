// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Médias « le jeu en vrai » affichés sur la page de chaque animation
// (section sous le hero de src/components/marketing/AnimationDetailPage.tsx).
//
// - `captures` : vraies captures d'écran (public/images/captures/), prises sur des sessions de test,
//   QR codes et codes de session floutés.
// - `video` : identifiant du tuto sur la chaîne YouTube AnimaJet (youtube.com/watch?v=<id>),
//   lu en youtube-nocookie (déjà autorisé par la CSP, frame-src).

export type GameCapture = { src: string; legende: string }
export type GameMedia = { captures?: GameCapture[]; video?: string }

const cap = (fichier: string, legende: string): GameCapture => ({ src: `/images/captures/${fichier}.webp`, legende })

export const GAME_MEDIA: Record<string, GameMedia> = {
  '/quiz-interactif': {
    video: '3BrNw0PtGG0',
    captures: [
      cap('quiz-ecran', "Sur l'écran géant : la question et la bonne réponse"),
      cap('quiz-telephone', 'Sur le téléphone des invités : on répond en un geste'),
    ],
  },
  '/roue-de-la-destinee': {
    video: 'ZU7AAwjiczM',
    captures: [cap('roue-ecran', "La roue sur l'écran géant"), cap('roue-resultat', 'Le résultat révélé à toute la salle')],
  },
  '/photo-mystere': {
    video: 'Gb_sUuqwido',
    captures: [cap('mystere-ecran', 'La photo se dévoile case par case'), cap('mystere-gagnant', "Le gagnant célébré sur l'écran géant")],
  },
  '/le-bon-ordre': {
    video: 'HrUM5KOsCRA',
    captures: [cap('ordre-ecran', "Le défi sur l'écran géant : chrono et points par équipe")],
  },
  '/jeu-points-communs': {
    video: 'faw02HI5RGE',
    captures: [
      cap('matching-ecran', 'Les réponses de la salle révélées en direct'),
      cap('matching-telephone', 'Sur le téléphone : chacun répond en secret'),
    ],
  },
  '/jeu-buzzer': {
    video: 't-BOfzbmPU8',
    captures: [
      cap('buzz-ecran', "Les buzzers ouverts sur l'écran géant"),
      cap('buzz-telephone', 'Le téléphone devient un buzzer'),
      cap('buzz-gagnant', 'Le plus rapide remporte la manche'),
    ],
  },
  '/jeu-vote': {
    video: 'fbUCCRtwNz0',
    captures: [cap('vote-telephone', 'Sur le téléphone : on choisit son favori'), cap('vote-podium', "Le podium révélé sur l'écran géant")],
  },
  '/partage-photo-evenement': {
    video: 'k5kJHYtyolQ',
    captures: [cap('photos-ecran', "Les photos des invités s'affichent en direct")],
  },
  '/borne-photo': { video: 'UYvv3wdb8o0' },
  '/diaporama-live-evenement': {
    video: 'k5kJHYtyolQ',
    captures: [cap('diaporama-ecran', "Le diaporama en direct sur l'écran géant")],
  },
}
