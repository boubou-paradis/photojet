// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Chrono calé sur l'heure du serveur : l'horloge d'un téléphone ou du PC de
// l'écran géant peut être décalée de plusieurs secondes.

/**
 * Décalage (ms) à ajouter à Date.now() pour obtenir l'heure du serveur.
 * Estimé au milieu de l'aller-retour de la requête.
 */
export function clockOffset(serverNowIso: string, requestStartedAt: number, responseReceivedAt: number): number {
  const server = Date.parse(serverNowIso)
  if (!Number.isFinite(server)) return 0
  return server - (requestStartedAt + responseReceivedAt) / 2
}

/** Secondes restantes avant `deadline` (arrondi au-dessus, jamais négatif). `null` = pas de chrono. */
export function secondsLeft(deadline: string | null | undefined, offsetMs: number, now: number = Date.now()): number | null {
  if (!deadline) return null
  const end = Date.parse(deadline)
  if (!Number.isFinite(end)) return null
  return Math.max(0, Math.ceil((end - (now + offsetMs)) / 1000))
}
