// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Mémorise la session sélectionnée sur le tableau de bord (navigateur uniquement),
// pour que le menu du haut (AnimaBooth, Paramètres) ouvre la même session et que
// le tableau de bord la reprenne au retour. Ce n'est qu'une préférence : un id
// inconnu ou appartenant à un autre compte est ignoré par pickSession().

const CLE = 'animajet:session-selectionnee'
export const SESSION_SELECTIONNEE_EVENT = 'animajet:session-selectionnee'

export function getRememberedSessionId(): string | null {
  try {
    return window.localStorage.getItem(CLE)
  } catch {
    return null
  }
}

export function rememberSessionId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(CLE, id)
    else window.localStorage.removeItem(CLE)
  } catch {
    // stockage indisponible (navigation privée…) : on garde le comportement par défaut
  }
  try {
    window.dispatchEvent(new CustomEvent(SESSION_SELECTIONNEE_EVENT, { detail: id }))
  } catch {
    // ignoré
  }
}
