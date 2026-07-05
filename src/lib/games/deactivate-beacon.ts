// © 2025 AnimaJet
// Envoi fiable de la désactivation d'un jeu quand l'admin quitte la page.
// navigator.sendBeacon survit au déchargement de l'onglet (beforeunload),
// contrairement à un fetch/supabase classique qui est souvent tué en vol.
export type DeactivatableGame = 'mystery' | 'lineup' | 'wheel'

export function sendDeactivateBeacon(sessionId: string, game: DeactivatableGame): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false
  }
  const payload = new Blob(
    [JSON.stringify({ sessionId, game })],
    { type: 'application/json' }
  )
  return navigator.sendBeacon('/api/games/deactivate', payload)
}
