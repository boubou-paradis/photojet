// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Subscription } from '@/types/database'
import crypto from 'crypto'

// ============================================
// Types pour le système d'essai Magic Link
// ============================================

export interface TrialToken {
  id: string
  email: string
  token: string
  created_at: string
  used_at: string | null
  expires_at: string
  ip_address: string | null
  user_agent: string | null
}

export type TrialAccessStatus =
  | 'valid'
  | 'weekend_blocked'
  | 'expired'
  | 'not_found'
  | 'already_used_different_session'

export interface TrialAccessResult {
  canAccess: boolean
  status: TrialAccessStatus
  message: string
  token?: TrialToken
  timeRemaining?: number
}

// ============================================
// Fonctions utilitaires
// ============================================

/**
 * Vérifie si on est actuellement le week-end (vendredi, samedi, dimanche)
 * Le blocage s'applique du vendredi 00:00 au dimanche 23:59
 */
export function isWeekend(): boolean {
  const day = new Date().getDay()
  // 0 = Dimanche, 5 = Vendredi, 6 = Samedi
  return day === 0 || day === 5 || day === 6
}

/**
 * Génère un token unique et sécurisé
 */
export function generateTrialToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Calcule la date d'expiration (24h après création)
 */
export function calculateExpirationDate(): Date {
  const expires = new Date()
  expires.setHours(expires.getHours() + 24)
  return expires
}

/**
 * Vérifie si un token est expiré
 */
export function isTokenExpired(expiresAt: string): boolean {
  return new Date() > new Date(expiresAt)
}

/**
 * Calcule le temps restant en millisecondes
 */
export function getTimeRemaining(expiresAt: string): number {
  const remaining = new Date(expiresAt).getTime() - new Date().getTime()
  return Math.max(0, remaining)
}

/**
 * Formate le temps restant en texte lisible
 */
export function formatTimeRemaining(expiresAt: string): string {
  const remaining = getTimeRemaining(expiresAt)
  if (remaining <= 0) return 'Expiré'

  const hours = Math.floor(remaining / (1000 * 60 * 60))
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}min`
  }
  return `${minutes}min`
}

/**
 * Vérifie l'accès pour un token d'essai
 */
export function checkTrialAccess(token: TrialToken | null): TrialAccessResult {
  // Token non trouvé
  if (!token) {
    return {
      canAccess: false,
      status: 'not_found',
      message: 'Token invalide ou non trouvé'
    }
  }

  // Token expiré
  if (isTokenExpired(token.expires_at)) {
    return {
      canAccess: false,
      status: 'expired',
      message: 'Votre essai gratuit de 24h a expiré. Abonnez-vous pour continuer !',
      token,
      timeRemaining: 0
    }
  }

  // C'est le week-end
  if (isWeekend()) {
    return {
      canAccess: false,
      status: 'weekend_blocked',
      message: "L'essai gratuit n'est pas disponible le week-end. Abonnez-vous pour animer vos événements !",
      token,
      timeRemaining: getTimeRemaining(token.expires_at)
    }
  }

  // Accès valide
  return {
    canAccess: true,
    status: 'valid',
    message: `Essai gratuit - ${formatTimeRemaining(token.expires_at)} restant`,
    token,
    timeRemaining: getTimeRemaining(token.expires_at)
  }
}

// ============================================
// Logique d'accès combinée (abonnés + essai)
// ============================================

export type AccessStatus =
  | 'active_subscription'
  | 'valid_trial'
  | 'weekend_blocked'
  | 'trial_expired'
  | 'no_access'

export interface AccessCheckResult {
  canAccess: boolean
  status: AccessStatus
  message: string
  trialTimeRemaining?: number
  isTrialUser?: boolean
}

/**
 * Vérifie si l'utilisateur peut accéder à l'application
 * Combine la vérification d'abonnement et d'essai
 */
export function checkAccess(
  subscription: Subscription | null,
  userRole?: string,
  trialToken?: TrialToken | null
): AccessCheckResult {
  // Les owners ont toujours accès
  if (userRole === 'owner') {
    return {
      canAccess: true,
      status: 'active_subscription',
      message: 'Accès illimité (propriétaire)',
      isTrialUser: false
    }
  }

  // Abonnement actif = accès total
  if (subscription?.status === 'active') {
    return {
      canAccess: true,
      status: 'active_subscription',
      message: 'Abonnement actif',
      isTrialUser: false
    }
  }

  // Vérifier l'essai via token
  if (trialToken) {
    const trialResult = checkTrialAccess(trialToken)

    if (trialResult.status === 'valid') {
      return {
        canAccess: true,
        status: 'valid_trial',
        message: trialResult.message,
        trialTimeRemaining: trialResult.timeRemaining,
        isTrialUser: true
      }
    }

    if (trialResult.status === 'weekend_blocked') {
      return {
        canAccess: false,
        status: 'weekend_blocked',
        message: trialResult.message,
        trialTimeRemaining: trialResult.timeRemaining,
        isTrialUser: true
      }
    }

    if (trialResult.status === 'expired') {
      return {
        canAccess: false,
        status: 'trial_expired',
        message: trialResult.message,
        isTrialUser: true
      }
    }
  }

  // Pas d'abonnement ni d'essai valide
  return {
    canAccess: false,
    status: 'no_access',
    message: 'Demandez votre essai gratuit ou abonnez-vous pour accéder à AnimaJet'
  }
}

// ============================================
// Email template
// ============================================

export function getTrialEmailTemplate(token: string, appUrl: string): { subject: string; html: string } {
  const verifyUrl = `${appUrl}/api/trial/verify?token=${token}`

  const subject = "🎁 Votre accès AnimaJet 24h est prêt !"

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre accès AnimaJet</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0D0D0F; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0D0D0F; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1A1A1E 0%, #242428 100%); border-radius: 16px; border: 1px solid rgba(212, 175, 55, 0.3); overflow: hidden;">

          <!-- Header gold line -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, transparent, #D4AF37, transparent);"></td>
          </tr>

          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px;">
              <img src="${appUrl}/logo.png" alt="AnimaJet" width="180" style="display: block;">
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding: 0 40px 20px;">
              <h1 style="margin: 0; font-size: 28px; color: #ffffff; font-weight: bold;">
                Votre essai gratuit est activé !
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td align="center" style="padding: 0 40px 30px;">
              <p style="margin: 0; font-size: 16px; color: #B0B0B5; line-height: 1.6;">
                Bonjour !<br><br>
                Vous avez demandé un accès gratuit à AnimaJet pour découvrir toutes nos fonctionnalités.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 40px 30px;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" bgcolor="#D4AF37" style="background-color: #D4AF37; border-radius: 12px; mso-padding-alt: 20px 50px;">
                    <a href="${verifyUrl}" target="_blank" style="display: inline-block; padding: 20px 50px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 18px; font-weight: bold; color: #1A1A0F; text-decoration: none; border-radius: 12px; border: 2px solid #B8962E;">
                      🚀 ACCÉDER À ANIMAJET
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Info box -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 12px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 14px; color: #D4AF37; font-weight: bold;">
                      ⏰ Ce lien est valide 24h
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #B0B0B5;">
                      L'essai gratuit est disponible du lundi au jeudi uniquement.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Subscription CTA -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #2E2E33; border-radius: 12px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 14px; color: #ffffff; font-weight: bold;">
                      Pour utiliser AnimaJet le week-end sur vos événements :
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #B0B0B5;">
                      Abonnement <strong style="color: #D4AF37;">29,90€/mois</strong> sans engagement
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px 40px 40px; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0; font-size: 12px; color: #6B6B70;">
                À très vite !<br>
                L'équipe AnimaJet
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  return { subject, html }
}
