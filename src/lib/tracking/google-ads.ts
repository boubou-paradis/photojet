// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Balise Google Ads (gtag.js) de la VITRINE, chargée UNIQUEMENT après consentement.
// Sans NEXT_PUBLIC_GOOGLE_ADS_ID valide : rien n'est chargé, aucun bandeau n'apparaît.
//
// Mode de consentement Google v2 : tout est refusé par défaut, puis seuls
// ad_storage et ad_user_data passent à « granted » après acceptation.
// ad_personalization reste refusé : pas de remarketing ni de ciblage.
//
// Seuls des événements d'INTENTION sont envoyés (clics commerciaux), jamais
// des essais ou paiements confirmés.

import { hasAdsConsent } from '@/lib/consent/consent'
import type { IntentKind } from '@/lib/tracking/intent'

// Références littérales obligatoires : Next.js n'injecte que process.env.NEXT_PUBLIC_X écrit en toutes lettres.
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? ''
const LABELS: Record<IntentKind, string> = {
  intent_trial_click: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_INTENT_TRIAL ?? '',
  intent_subscribe_monthly_click: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_INTENT_MONTHLY ?? '',
  intent_subscribe_annual_click: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_INTENT_ANNUAL ?? '',
  intent_event_pass_click: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_INTENT_PASS ?? '',
  intent_whatsapp_click: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_INTENT_WHATSAPP ?? '',
}

const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js'

/** Sécurité supplémentaire : jamais de bandeau ni de balise sur ces chemins (SaaS). */
const EXCLUDED_PREFIXES = [
  '/admin', '/live', '/play', '/join', '/borne', '/invite', '/buzzer', '/vote', '/matching',
  '/album', '/host', '/demo', '/gestion-8k7m2x', '/login', '/trial', '/subscription', '/api',
]

export function isGoogleAdsIdValid(id: string): boolean {
  return /^AW-\d{6,15}$/.test(id)
}

export function isTrackingConfigured(): boolean {
  return isGoogleAdsIdValid(GOOGLE_ADS_ID)
}

export function isTrackedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return !EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

type Gtag = (...args: unknown[]) => void
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
    __ajGoogleTagLoaded?: boolean
  }
}

/** Charge la balise si (et seulement si) la mesure est configurée et acceptée. Idempotent. */
export function loadGoogleTag(): boolean {
  if (typeof window === 'undefined' || !isTrackingConfigured() || !hasAdsConsent()) return false
  if (!isTrackedPath(window.location.pathname)) return false
  if (window.__ajGoogleTagLoaded) {
    // Balise déjà chargée (ex. refus puis nouvel accord) : on rétablit l'accord.
    window.gtag?.('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted' })
    return true
  }
  window.__ajGoogleTagLoaded = true

  window.dataLayer = window.dataLayer || []
  // gtag.js exige l'objet `arguments`, pas un tableau.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  })
  window.gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted' })
  window.gtag('js', new Date())
  window.gtag('config', GOOGLE_ADS_ID, { allow_ad_personalization_signals: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `${GTAG_SRC}?id=${encodeURIComponent(GOOGLE_ADS_ID)}`
  document.head.appendChild(script)
  return true
}

/** Retrait du consentement : la balise déjà chargée cesse de déposer/lire ses cookies. */
export function revokeGoogleTag(): void {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
}

/**
 * Envoie un événement d'intention à Google Ads (action de conversion SECONDAIRE).
 * Sans consentement, sans configuration ou sans libellé : ne fait rien.
 */
export function trackIntent(kind: IntentKind): boolean {
  if (typeof window === 'undefined') return false
  const label = LABELS[kind]
  if (!label || !isTrackingConfigured() || !hasAdsConsent() || !isTrackedPath(window.location.pathname)) return false
  // Balise normalement déjà chargée par le bandeau ; sinon on la charge (sans renvoyer l'accord à chaque clic).
  if (!window.__ajGoogleTagLoaded && !loadGoogleTag()) return false
  if (!window.gtag) return false
  // transport_type beacon : l'envoi survit à la navigation déclenchée par le clic.
  window.gtag('event', 'conversion', { send_to: `${GOOGLE_ADS_ID}/${label}`, transport_type: 'beacon' })
  return true
}
