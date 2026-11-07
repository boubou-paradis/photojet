// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Consentement à la mesure publicitaire (Google Ads). Module pur + accès
// navigateur protégé : aucun traceur publicitaire n'est chargé tant que
// `ads === true` n'a pas été choisi explicitement par le visiteur.
//
// Le choix (acceptation OU refus) est conservé 6 mois, puis redemandé
// (recommandation CNIL). Le stockage du choix lui-même est strictement
// nécessaire et ne requiert pas de consentement.

export const CONSENT_STORAGE_KEY = 'aj_consent'
export const CONSENT_VERSION = 1
/** Durée de validité d'un choix : 6 mois (≈ 182 jours). */
export const CONSENT_MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000
/** Événement émis sur `window` quand le choix change. */
export const CONSENT_CHANGE_EVENT = 'aj:consent-change'
/** Événement émis sur `window` pour rouvrir le bandeau (« Gérer les cookies »). */
export const CONSENT_OPEN_EVENT = 'aj:consent-open'

export interface ConsentChoice {
  v: number
  /** Mesure publicitaire Google Ads acceptée. */
  ads: boolean
  /** Date du choix (ISO). */
  at: string
}

/** Lit un choix sérialisé ; renvoie null si absent, illisible, d'une autre version ou expiré. */
export function parseConsent(raw: string | null | undefined, now: Date = new Date()): ConsentChoice | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const { v, ads, at } = data as Record<string, unknown>
  if (v !== CONSENT_VERSION || typeof ads !== 'boolean' || typeof at !== 'string') return null
  const time = Date.parse(at)
  if (Number.isNaN(time)) return null
  const age = now.getTime() - time
  if (age < 0 || age > CONSENT_MAX_AGE_MS) return null
  return { v, ads, at }
}

export function makeConsent(ads: boolean, now: Date = new Date()): ConsentChoice {
  return { v: CONSENT_VERSION, ads, at: now.toISOString() }
}

// ---------- Accès navigateur (toujours protégé : stockage parfois bloqué) ----------

export function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))
  } catch {
    return null
  }
}

export function hasAdsConsent(): boolean {
  return readConsent()?.ads === true
}

export function saveConsent(ads: boolean): ConsentChoice {
  const choice = makeConsent(ads)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choice))
    } catch {
      // Stockage indisponible (navigation privée stricte) : le choix vaut pour la page en cours.
    }
    if (!ads) clearAdCookies()
    window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_CHANGE_EVENT, { detail: choice }))
  }
  return choice
}

export function openConsentManager(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))
}

/** Cookies déposés par la balise Google Ads (liaison de conversion). */
export const AD_COOKIE_PREFIXES = ['_gcl_']

/** Noms des cookies publicitaires présents dans une chaîne `document.cookie`. */
export function adCookieNames(cookieString: string): string[] {
  return cookieString
    .split(';')
    .map((c) => c.split('=')[0]?.trim())
    .filter((name): name is string => !!name && AD_COOKIE_PREFIXES.some((p) => name.startsWith(p)))
}

/** Supprime les cookies publicitaires (retrait du consentement). */
export function clearAdCookies(): void {
  if (typeof document === 'undefined') return
  const host = window.location.hostname
  // La balise pose ses cookies sur le domaine racine (ex. .animajet.fr) : on efface les deux variantes.
  const parts = host.split('.')
  const domains = ['', host]
  if (parts.length >= 2) domains.push('.' + parts.slice(-2).join('.'))
  for (const name of adCookieNames(document.cookie)) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`
    }
  }
}
