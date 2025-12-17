import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
export const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://animajet.fr'
const FROM_EMAIL = 'AnimaJet <noreply@animajet.fr>'

export async function sendWelcomeEmail(params: {
  to: string
  password: string
  sessionCode: string
}) {
  if (!resend) {
    return { success: false, error: 'Resend not configured' }
  }

  const { to, password, sessionCode } = params

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Bienvenue sur AnimaJet ! Vos identifiants de connexion',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur AnimaJet</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1A1A1E; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1A1A1E; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td align="center" style="padding: 40px 40px 30px 40px; background: linear-gradient(180deg, #1A1A1E 0%, #242428 100%); border-radius: 20px 20px 0 0;">
              <img src="https://animajet.fr/images/animajet_logo_principal.png" alt="AnimaJet" width="220" style="display: block; max-width: 220px; height: auto; border: 0;" />
              <h1 style="margin: 25px 0 0 0; color: #D4AF37; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">
                Bienvenue sur AnimaJet !
              </h1>
              <p style="margin: 10px 0 0 0; color: #B0B0B5; font-size: 16px; line-height: 1.5;">
                Votre compte est pret. Lancez votre premier evenement !
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #242428; padding: 40px;">
              <p style="margin: 0 0 30px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
                Bonjour et merci pour votre confiance !<br><br>
                Voici vos identifiants de connexion pour acceder a votre espace AnimaJet :
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1A1A1E; border: 2px solid #D4AF37; border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="padding: 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                      <tr>
                        <td width="40" valign="top" style="padding-top: 2px;">
                          <span style="font-size: 20px;">&#128231;</span>
                        </td>
                        <td>
                          <p style="margin: 0 0 4px 0; color: #6B6B70; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">Votre email</p>
                          <p style="margin: 0; color: #ffffff; font-size: 17px; font-weight: bold;">${to}</p>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                      <tr>
                        <td style="border-bottom: 1px solid #3A3A3F;"></td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                      <tr>
                        <td width="40" valign="top" style="padding-top: 2px;">
                          <span style="font-size: 20px;">&#128272;</span>
                        </td>
                        <td>
                          <p style="margin: 0 0 4px 0; color: #6B6B70; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">Mot de passe</p>
                          <p style="margin: 0; color: #D4AF37; font-size: 18px; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 1px;">${password}</p>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                      <tr>
                        <td style="border-bottom: 1px solid #3A3A3F;"></td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="40" valign="top" style="padding-top: 2px;">
                          <span style="font-size: 20px;">&#127919;</span>
                        </td>
                        <td>
                          <p style="margin: 0 0 4px 0; color: #6B6B70; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">Code de votre session</p>
                          <p style="margin: 0; color: #D4AF37; font-size: 32px; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 4px;">${sessionCode}</p>
                          <p style="margin: 8px 0 0 0; color: #6B6B70; font-size: 13px;">Partagez ce code avec vos invites !</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 35px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 50%, #D4AF37 100%); border-radius: 12px;">
                          <a href="https://animajet.fr/login" target="_blank" style="display: inline-block; padding: 18px 50px; color: #1A1A1E; font-size: 16px; font-weight: bold; text-decoration: none; letter-spacing: 0.5px;">
                            Acceder a mon dashboard
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 0 0; color: #6B6B70; font-size: 14px; text-align: center; line-height: 1.6;">
                Conservez cet email precieusement.<br>
                Vous pourrez modifier votre mot de passe dans les parametres.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1A1A1E; padding: 30px 40px; border-radius: 0 0 20px 20px; border-top: 1px solid #3A3A3F;">
              <p style="margin: 0 0 15px 0; color: #B0B0B5; font-size: 14px; text-align: center;">
                Des questions ? Contactez-nous a <a href="mailto:support@animajet.fr" style="color: #D4AF37; text-decoration: none;">support@animajet.fr</a>
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
                <tr>
                  <td style="border-bottom: 1px solid #3A3A3F;"></td>
                </tr>
              </table>
              <p style="margin: 0; color: #6B6B70; font-size: 12px; text-align: center;">
                &copy; 2025 AnimaJet - Tous droits reserves<br>
                <span style="color: #4A4A4F;">L'animation de vos evenements, simplifiee.</span>
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

    return { success: true, data: result }
  } catch (error: unknown) {
    console.error('[Email] Error:', error instanceof Error ? error.message : error)
    return { success: false, error }
  }
}

export async function sendExpiringEmail(params: {
  to: string
  daysLeft: number
}) {
  if (!resend) {
    return { success: false, error: 'Resend not configured' }
  }

  const { to, daysLeft } = params

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Votre abonnement AnimaJet expire dans ${daysLeft} jours`,
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
                Votre abonnement AnimaJet expire dans <strong style="color: #E53935;">${daysLeft} jours</strong>.
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

    return { success: true, data: result }
  } catch (error: unknown) {
    console.error('[Email] Error:', error instanceof Error ? error.message : error)
    return { success: false, error }
  }
}

export async function sendExpiredEmail(params: { to: string }) {
  if (!resend) {
    return { success: false, error: 'Resend not configured' }
  }

  const { to } = params

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Votre abonnement AnimaJet a expire',
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
                Votre abonnement AnimaJet a expire. Vos sessions et photos ont ete desactivees.
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

    return { success: true, data: result }
  } catch (error: unknown) {
    console.error('[Email] Error:', error instanceof Error ? error.message : error)
    return { success: false, error }
  }
}
