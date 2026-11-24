// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo — machine du grand écran : 3D (par défaut, si l'ordinateur suit) ou 2D.
// Préférence enregistrée sur CE PC (régie et /live ouverts dans le même navigateur :
// le changement s'applique tout de suite à l'écran). Sur un autre ordinateur :
// /live/<code>?machine=2d. Rien n'est envoyé au serveur.

export type MachinePref = 'auto' | '2d'

const KEY = 'animajet.bingo.machine'
const EVENT = 'animajet:bingo-machine'

export function readMachinePref(): MachinePref {
  try {
    if (typeof window === 'undefined') return 'auto'
    if (new URLSearchParams(window.location.search).get('machine') === '2d') return '2d'
    return window.localStorage.getItem(KEY) === '2d' ? '2d' : 'auto'
  } catch {
    return 'auto'
  }
}

export function writeMachinePref(p: MachinePref) {
  try {
    if (p === '2d') window.localStorage.setItem(KEY, '2d')
    else window.localStorage.removeItem(KEY)
  } catch {
    /* stockage bloqué : la préférence ne vaut que pour cette page */
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Abonnement : même onglet (événement maison) et autres onglets (storage). */
export function subscribeMachinePref(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) cb() }
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}
