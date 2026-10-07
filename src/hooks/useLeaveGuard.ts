// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Protection contre un rechargement (F5, souvent envoyé par les télécommandes
// de présentation) ou une fermeture d'onglet accidentels pendant une partie :
// le navigateur affiche sa boîte « Quitter / Recharger le site ? ».
//
// IMPORTANT : le nettoyage qui désactive le jeu doit être sur `pagehide`, pas
// sur `beforeunload` — sinon il part AVANT la boîte et « Annuler » laisserait
// le jeu désactivé. `pagehide` ne se déclenche que si la page part vraiment.

import { useEffect } from 'react'

export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // requis par les anciens Chrome / Edge
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])
}
