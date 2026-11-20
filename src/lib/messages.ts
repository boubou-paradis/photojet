// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Messages des invités : retours à la ligne autorisés, avec garde-fous.
// - 6 lignes au plus (les lignes en trop rejoignent la 6e, rien n'est perdu) ;
// - plusieurs lignes vides d'affilée → une seule ;
// - pas de ligne vide au début ni à la fin.
// Appliqué à la saisie (/invite) ET à l'affichage (/live, tableau de bord) :
// un message écrit directement en base est remis en forme lui aussi.
// Toujours du texte simple : jamais de HTML interprété.

export const MESSAGE_MAX_LENGTH = 280
export const MESSAGE_MAX_LINES = 6

function capLines(text: string): string {
  const lines = text.split('\n')
  if (lines.length <= MESSAGE_MAX_LINES) return text
  const head = lines.slice(0, MESSAGE_MAX_LINES - 1)
  const rest = lines.slice(MESSAGE_MAX_LINES - 1).map((l) => l.trim()).filter(Boolean).join(' ')
  return [...head, rest].join('\n')
}

/**
 * Pendant la frappe : mêmes règles, sauf que la fin du texte est laissée telle
 * quelle (un retour à la ligne qu'on vient de taper ne doit pas disparaître).
 */
export function shapeMessageInput(raw: string): string {
  let t = raw.replace(/\r\n?/g, '\n')
  t = t.replace(/\n(?:[ \t]*\n){2,}/g, '\n\n') // lignes vides d'affilée → une seule
  t = t.replace(/^(?:[ \t]*\n)+/, '') // pas de ligne vide au début
  // Au-delà de la 6e ligne, un retour à la ligne devient une espace, gardée en
  // fin de texte (sinon le mot tapé ensuite se collerait au précédent).
  const lines = t.split('\n')
  if (lines.length > MESSAGE_MAX_LINES) {
    const head = lines.slice(0, MESSAGE_MAX_LINES - 1)
    const rest = lines.slice(MESSAGE_MAX_LINES - 1).join(' ').replace(/[ \t]{2,}/g, ' ')
    t = [...head, rest].join('\n')
  }
  return t.slice(0, MESSAGE_MAX_LENGTH)
}

/** Message prêt à enregistrer ou à afficher. */
export function cleanMessage(raw: string | null | undefined): string {
  let t = (raw ?? '').replace(/\r\n?/g, '\n')
  t = t.split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n')
  t = t.replace(/\n{3,}/g, '\n\n')
  t = t.replace(/^\s+|\s+$/g, '')
  return capLines(t)
}
