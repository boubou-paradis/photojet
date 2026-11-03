// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Sans dépendance Node : importé côté navigateur comme côté serveur.

export const WATERMARK_LAYER_PATH = '/watermark/calque-essai-leger.png'
export const SUBSCRIBE_HREF = '/#pricing'

export const TRIAL_DOWNLOAD_ERROR_CODE = 'trial_download_blocked'
export const TRIAL_DOWNLOAD_MESSAGE =
  'Le téléchargement des photos est réservé aux abonnés. Abonnez-vous pour récupérer votre album'
export const TRIAL_ADMIN_NOTICE =
  "Votre compte est en version d'essai : un filigrane s'affiche sur l'écran géant et les photos. Abonnez-vous pour le retirer"

export type WatermarkWidth = 800 | 1920

export function watermarkedPhotoUrl(photoId: string, largeur?: WatermarkWidth): string {
  return `/api/photos/${photoId}/filigrane${largeur ? `?w=${largeur}` : ''}`
}
