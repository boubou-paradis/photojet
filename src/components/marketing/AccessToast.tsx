// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Îlot client isolé pour le toast de redirection (?access=expired|weekend_blocked).
 *
 * IMPORTANT SEO : useSearchParams() provoque un bailout vers le rendu client de
 * toute la page jusqu'à la <Suspense> la plus proche. En isolant cet appel ici
 * (et en l'enveloppant dans <Suspense> côté page), le reste de la page d'accueil
 * est de nouveau rendu côté serveur (H1, contenu, liens internes, JSON-LD).
 * Ne pas réintroduire useSearchParams ailleurs dans page.tsx.
 */
export default function AccessToast() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const access = searchParams.get('access')
    if (access === 'expired') {
      toast.error('Votre essai gratuit a expiré. Abonnez-vous pour continuer !')
    } else if (access === 'weekend_blocked') {
      toast.error("L'essai gratuit est bloqué le week-end. Revenez lundi après 12h ou activez un Pass Événement.")
    }
  }, [searchParams])

  return null
}
