import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set - emails will not be sent')
}

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://photojet.app'
const FROM_EMAIL = 'PhotoJet <noreply@photojet.app>'

// Welcome email after subscription
export async function sendWelcomeEmail(params: {
  to: string
  password: string
  sessionCode: string
}) {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping welcome email')
    return
  }

  const { to, password, sessionCode } = params

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Bienvenue sur PhotoJet !',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur PhotoJet</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1A1A1E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1A1A1E; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #242428; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: #1A1A1E; font-size: 32px; font-weight: bold;">PhotoJet</h1>
              <p style="margin: 10px 0 0; color: #1A1A1E; font-size: 16px; opacity: 0.8;">Votre compte est actif !</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px;">Bienvenue !</h2>
              <p style="margin: 0 0 30px; color: #B0B0B5; font-size: 16px; line-height: 1.6;">
                Merci pour votre abonnement PhotoJet. Voici vos informations de connexion :
              </p>

              <!-- Credentials Box -->
              <table width="100%" style="background-color: #1A1A1E; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 8px; color: #6B6B70; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Email</p>
                    <p style="margin: 0 0 20px; color: #ffffff; font-size: 18px; font-weight: bold;">${to}</p>

                    <p style="margin: 0 0 8px; color: #6B6B70; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Mot de passe</p>
                    <p style="margin: 0 0 20px; color: #D4AF37; font-size: 18px; font-weight: bold; font-family: monospace;">${password}</p>

                    <p style="margin: 0 0 8px; color: #6B6B70; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Code de votre session</p>
                    <p style="margin: 0; color: #D4AF37; font-size: 24px; font-weight: bold; font-family: monospace;">${sessionCode}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/admin/dashboard" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #1A1A1E; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: bold;">
                      Acceder au dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; color: #6B6B70; font-size: 14px; text-align: center;">
                Vous pouvez modifier votre mot de passe et le code de session dans les parametres.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #1A1A1E; text-align: center; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0; color: #6B6B70; font-size: 12px;">
                PhotoJet - La solution photo pour vos evenements
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    })
    console.log('[Email] Welcome email sent to', to)
  } catch (error) {
    console.error('[Email] Error sending welcome email:', error)
  }
}

// Subscription expiring soon email
export async function sendExpiringEmail(params: {
  to: string
  daysLeft: number
}) {
  if (!resend) return

  const { to, daysLeft } = params

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Votre abonnement PhotoJet expire dans ${daysLeft} jours`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; background-color: #1A1A1E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1A1A1E; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #242428; border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #E53935 0%, #FF5722 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Votre abonnement expire bientot</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #B0B0B5; font-size: 16px; line-height: 1.6;">
                Votre abonnement PhotoJet expire dans <strong style="color: #E53935;">${daysLeft} jours</strong>.
              </p>
              <p style="margin: 0 0 30px; color: #B0B0B5; font-size: 16px; line-height: 1.6;">
                Si vous ne renouvelez pas, vos photos et sessions seront supprimees apres l'expiration.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/admin/settings" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #1A1A1E; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: bold;">
                      Renouveler mon abonnement
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    })
    console.log('[Email] Expiring email sent to', to)
  } catch (error) {
    console.error('[Email] Error sending expiring email:', error)
  }
}

// Subscription canceled/expired email
export async function sendExpiredEmail(params: { to: string }) {
  if (!resend) return

  const { to } = params

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Votre abonnement PhotoJet a expire',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; background-color: #1A1A1E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1A1A1E; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #242428; border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="background-color: #E53935; padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Abonnement expire</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #B0B0B5; font-size: 16px; line-height: 1.6;">
                Votre abonnement PhotoJet a expire. Vos sessions et photos ont ete desactivees.
              </p>
              <p style="margin: 0 0 30px; color: #B0B0B5; font-size: 16px; line-height: 1.6;">
                Reabonnez-vous pour retrouver l'acces a vos donnees.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #1A1A1E; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: bold;">
                      Se reabonner
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    })
    console.log('[Email] Expired email sent to', to)
  } catch (error) {
    console.error('[Email] Error sending expired email:', error)
  }
}
