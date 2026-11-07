// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

// « Gérer les cookies » : rouvre le bandeau pour modifier ou retirer son choix.
// N'apparaît que si la mesure publicitaire est configurée ET qu'on est sur la vitrine
// (jamais sur une route du SaaS, même sur une page 404 sous /join, /borne…).

import { usePathname } from 'next/navigation'
import { openConsentManager } from '@/lib/consent/consent'
import { isTrackedPath, isTrackingConfigured } from '@/lib/tracking/google-ads'

export default function ManageConsentButton({ className }: { className?: string }) {
  const pathname = usePathname()
  if (!isTrackingConfigured() || !isTrackedPath(pathname)) return null
  return (
    <button type="button" onClick={openConsentManager} className={className}>
      Gérer les cookies
    </button>
  )
}
