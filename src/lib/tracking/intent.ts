// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Reconnaissance des clics commerciaux de la VITRINE (module pur, testé).
// Ce sont des événements d'INTENTION : un clic n'est ni un essai activé,
// ni un paiement. Aucun composant n'est modifié : on lit seulement le lien
// ou le bouton cliqué (href, texte, section #pricing de l'accueil).

export type IntentKind =
  | 'intent_trial_click'
  | 'intent_subscribe_monthly_click'
  | 'intent_subscribe_annual_click'
  | 'intent_event_pass_click'
  | 'intent_whatsapp_click'

export interface ClickedElementInfo {
  /** 'a' ou 'button' (élément cliquable le plus proche). */
  tag: string
  /** Valeur brute de l'attribut href (getAttribute), pas l'URL résolue. */
  href?: string | null
  text?: string | null
  /** Vrai si l'élément est dans la section tarifs (#pricing) de l'accueil. */
  inPricing?: boolean
}

function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

/** Montant affiché sur un bouton « Payer 29,90€ » → 29.9 ; null sinon. */
export function payButtonAmount(text: string | null | undefined): number | null {
  const m = /^Payer\s+(\d+(?:[.,]\d{1,2})?)\s*€$/.exec(normalizeText(text))
  return m ? Number(m[1].replace(',', '.')) : null
}

export function classifyIntentClick(el: ClickedElementInfo): IntentKind | null {
  const tag = el.tag.toLowerCase()
  const href = el.href ?? ''

  if (tag === 'a') {
    if (/^https:\/\/(chat\.whatsapp\.com|wa\.me|api\.whatsapp\.com)\//.test(href)) return 'intent_whatsapp_click'
    // Liens vers le formulaire d'essai : « /#essai », « #essai » ou URL absolue du site.
    if (/^(https:\/\/(www\.)?animajet\.fr)?\/?#essai$/.test(href)) return 'intent_trial_click'
    return null
  }

  if (tag === 'button' && el.inPricing) {
    const amount = payButtonAmount(el.text)
    if (amount === 29.9) return 'intent_subscribe_monthly_click'
    if (amount === 299) return 'intent_subscribe_annual_click'
    if (amount === 14.9) return 'intent_event_pass_click'
  }
  return null
}
