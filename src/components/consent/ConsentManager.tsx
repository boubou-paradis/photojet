// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

// Bandeau de consentement à la mesure publicitaire — VITRINE UNIQUEMENT.
// Monté dans SiteFooter (accueil, pages SEO, blog, 404), jamais dans le SaaS.
//  - Affiché seulement si la mesure Google Ads est configurée (sinon : rien).
//  - « Refuser » et « Accepter » ont exactement le même poids visuel.
//  - Fermer sans choisir = aucun traceur (le bandeau reviendra à la visite suivante).
//  - Rouvrable à tout moment via « Gérer les cookies » (pied de page, page Confidentialité).

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_OPEN_EVENT,
  hasAdsConsent,
  readConsent,
  saveConsent,
} from '@/lib/consent/consent'
import { isTrackedPath, isTrackingConfigured, loadGoogleTag, revokeGoogleTag, trackIntent } from '@/lib/tracking/google-ads'
import { classifyIntentClick } from '@/lib/tracking/intent'

export default function ConsentManager() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<boolean | null>(null)

  const active = isTrackingConfigured() && isTrackedPath(pathname)

  useEffect(() => {
    if (!active) return
    // localStorage n'existe que côté navigateur : lecture différée après le premier rendu
    // (le bandeau n'entre pas en concurrence avec l'affichage initial de la page).
    const t = window.setTimeout(() => {
      const choice = readConsent()
      setCurrent(choice ? choice.ads : null)
      if (!choice) setOpen(true)
      else if (choice.ads) loadGoogleTag()
    }, 0)
    return () => window.clearTimeout(t)
  }, [active, pathname])

  // Clics commerciaux (événements d'INTENTION). Écoute passive au niveau du document :
  // aucun bouton ni lien n'est modifié, aucun clic n'est bloqué ou retardé.
  useEffect(() => {
    if (!active) return
    const onClick = (e: MouseEvent) => {
      if (!hasAdsConsent()) return
      const target = e.target instanceof Element ? e.target.closest('a, button') : null
      if (!target) return
      const kind = classifyIntentClick({
        tag: target.tagName,
        href: target.getAttribute('href'),
        text: target.textContent,
        inPricing: !!target.closest('#pricing'),
      })
      if (kind) trackIntent(kind)
    }
    document.addEventListener('click', onClick, { capture: true, passive: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [active])

  useEffect(() => {
    if (!active) return
    const onOpen = () => {
      setCurrent(readConsent()?.ads ?? null)
      setOpen(true)
    }
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen)
  }, [active])

  const choose = useCallback((ads: boolean) => {
    saveConsent(ads)
    setCurrent(ads)
    setOpen(false)
    if (ads) loadGoogleTag()
    else revokeGoogleTag()
  }, [])

  // Synchronise plusieurs onglets / composants.
  useEffect(() => {
    const onChange = (e: Event) => setCurrent((e as CustomEvent<{ ads: boolean }>).detail?.ads ?? null)
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange)
  }, [])

  if (!open || !isTrackingConfigured() || typeof document === 'undefined') return null

  // Portail vers <body> : le pied de page (backdrop-blur) casserait le position: fixed.
  return createPortal(
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="aj-consent-title"
      aria-describedby="aj-consent-desc"
      className="fixed inset-x-0 bottom-0 z-[1000] p-3 sm:p-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#D4AF37]/30 bg-[#0D0D0F]/95 backdrop-blur-md shadow-2xl p-4 sm:p-5 text-sm text-gray-300">
        <p id="aj-consent-title" className="font-semibold text-white mb-1">
          Mesure de nos publicités
        </p>
        <p id="aj-consent-desc" className="leading-relaxed">
          Avec votre accord, nous utilisons un cookie Google Ads pour savoir si nos annonces
          aboutissent à un essai ou à un abonnement. Aucune publicité personnalisée, aucun ciblage.
          Refuser n&apos;a aucune conséquence sur le site. Vous pouvez changer d&apos;avis à tout moment
          via « Gérer les cookies » en bas de page.{' '}
          <Link href="/confidentialite#cookies" className="text-[#D4AF37] underline underline-offset-2">
            En savoir plus
          </Link>
        </p>
        {current !== null && (
          <p className="mt-2 text-xs text-gray-400">
            Choix actuel : {current ? 'mesure acceptée' : 'mesure refusée'}.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => choose(false)}
            className="h-11 rounded-xl border border-white/25 bg-white/5 font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => choose(true)}
            className="h-11 rounded-xl border border-white/25 bg-white/5 font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
