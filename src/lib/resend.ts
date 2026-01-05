// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
export const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://animajet.fr'
const FROM_EMAIL = 'AnimaJet <noreply@animajet.fr>'

export async function sendWelcomeEmail(params: {
  to: string
  password: string
  sessionCode: string
  invoice?: {
    pdfBuffer: Uint8Array
    invoiceNumber: string
  }
}) {
  if (!resend) {
    return { success: false, error: 'Resend not configured' }
  }

  const { to, password, sessionCode, invoice } = params

  // Prepare attachments
  const attachments = invoice ? [
    {
      filename: `Facture_${invoice.invoiceNumber}.pdf`,
      content: Buffer.from(invoice.pdfBuffer).toString('base64'),
    }
  ] : undefined

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Bienvenue sur AnimaJet ! Vos identifiants de connexion',
      attachments,
      html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Bienvenue sur AnimaJet</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0D0D0F; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <!-- Wrapper Table -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0D0D0F;">
    <tr>
      <td align="center" style="padding: 40px 20px;">

        <!-- Main Container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">

          <!-- Golden Glow Effect Top -->
          <tr>
            <td align="center" style="padding-bottom: 2px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="3" style="background: linear-gradient(90deg, transparent 0%, #D4AF37 20%, #F4D03F 50%, #D4AF37 80%, transparent 100%); border-radius: 20px 20px 0 0;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Header with Logo -->
          <tr>
            <td align="center" style="background: linear-gradient(180deg, #1A1A1E 0%, #242428 100%); padding: 50px 40px 40px 40px; border-radius: 20px 20px 0 0;">
              <!-- Logo Container with Glow -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 15px; background: radial-gradient(circle at center, rgba(212, 175, 55, 0.15) 0%, transparent 70%); border-radius: 50%;">
                    <img src="https://animajet.fr/images/animajet_logo_principal.png" alt="AnimaJet" width="180" height="180" style="display: block; width: 180px; height: 180px; border: 0; border-radius: 20px;" />
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <h1 style="margin: 30px 0 0 0; color: #D4AF37; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; text-shadow: 0 0 30px rgba(212, 175, 55, 0.3);">
                Bienvenue sur AnimaJet !
              </h1>
              <p style="margin: 12px 0 0 0; color: #9A9AA0; font-size: 16px; line-height: 1.5; font-weight: 400;">
                Votre compte est pret. Lancez votre premier evenement !
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background-color: #1A1A1E; padding: 45px 40px;">
              <p style="margin: 0 0 35px 0; color: #E5E5E7; font-size: 16px; line-height: 1.7;">
                Bonjour et merci pour votre confiance !<br><br>
                Voici vos identifiants de connexion pour acceder a votre espace AnimaJet :
              </p>

              <!-- Credentials Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(145deg, #242428 0%, #1E1E22 100%); border: 2px solid #D4AF37; border-radius: 16px; overflow: hidden; box-shadow: 0 0 40px rgba(212, 175, 55, 0.1);">
                <tr>
                  <td style="padding: 35px;">

                    <!-- Email Row -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                      <tr>
                        <td width="50" valign="top">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width: 42px; height: 42px; background: linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.05) 100%); border-radius: 10px; text-align: center; vertical-align: middle;">
                                <span style="font-size: 20px; line-height: 42px;">&#9993;</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="padding-left: 15px;">
                          <p style="margin: 0 0 6px 0; color: #6B6B70; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Votre email</p>
                          <p style="margin: 0; color: #FFFFFF; font-size: 16px; font-weight: 600;">${to}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Separator -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                      <tr>
                        <td style="border-bottom: 1px solid rgba(212, 175, 55, 0.2);"></td>
                      </tr>
                    </table>

                    <!-- Password Row -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                      <tr>
                        <td width="50" valign="top">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width: 42px; height: 42px; background: linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.05) 100%); border-radius: 10px; text-align: center; vertical-align: middle;">
                                <span style="font-size: 20px; line-height: 42px;">&#128274;</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="padding-left: 15px;">
                          <p style="margin: 0 0 6px 0; color: #6B6B70; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Mot de passe</p>
                          <p style="margin: 0; color: #D4AF37; font-size: 20px; font-weight: 700; font-family: 'Courier New', Courier, monospace; letter-spacing: 2px;">${password}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Separator -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                      <tr>
                        <td style="border-bottom: 1px solid rgba(212, 175, 55, 0.2);"></td>
                      </tr>
                    </table>

                    <!-- Session Code Row -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50" valign="top">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width: 42px; height: 42px; background: linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.05) 100%); border-radius: 10px; text-align: center; vertical-align: middle;">
                                <span style="font-size: 20px; line-height: 42px;">&#127919;</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="padding-left: 15px;">
                          <p style="margin: 0 0 6px 0; color: #6B6B70; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Code de votre session</p>
                          <p style="margin: 0; color: #D4AF37; font-size: 36px; font-weight: 800; font-family: 'Courier New', Courier, monospace; letter-spacing: 6px; text-shadow: 0 0 20px rgba(212, 175, 55, 0.3);">${sessionCode}</p>
                          <p style="margin: 10px 0 0 0; color: #6B6B70; font-size: 13px;">Partagez ce code avec vos invites !</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 40px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 50%, #D4AF37 100%); border-radius: 14px; box-shadow: 0 4px 20px rgba(212, 175, 55, 0.4);">
                          <a href="https://animajet.fr/login" target="_blank" style="display: inline-block; padding: 20px 55px; color: #1A1A1E; font-size: 16px; font-weight: 700; text-decoration: none; letter-spacing: 0.5px;">
                            Acceder a mon dashboard
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Invoice Notice -->
              ${invoice ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 35px; background: linear-gradient(145deg, #242428 0%, #1E1E22 100%); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 12px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #D4AF37; font-size: 14px; font-weight: 600;">
                      &#128196; Votre facture est jointe a cet email
                    </p>
                    <p style="margin: 8px 0 0 0; color: #9A9AA0; font-size: 13px;">
                      Facture N° ${invoice.invoiceNumber}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Info Text -->
              <p style="margin: 35px 0 0 0; color: #6B6B70; font-size: 14px; text-align: center; line-height: 1.7;">
                Conservez cet email precieusement.<br>
                Vous pourrez modifier votre mot de passe dans les parametres.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0D0D0F; padding: 35px 40px; border-radius: 0 0 20px 20px; border-top: 1px solid #2A2A2E;">

              <!-- Support Link -->
              <p style="margin: 0 0 20px 0; color: #9A9AA0; font-size: 14px; text-align: center;">
                Des questions ? <a href="mailto:animajet3@gmail.com" style="color: #D4AF37; text-decoration: none; font-weight: 600;">animajet3@gmail.com</a>
              </p>

              <!-- Separator -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
                <tr>
                  <td style="border-bottom: 1px solid #2A2A2E;"></td>
                </tr>
              </table>

              <!-- Copyright -->
              <p style="margin: 0; color: #4A4A4F; font-size: 12px; text-align: center; line-height: 1.8;">
                &copy; 2025 AnimaJet - Tous droits reserves<br>
                <span style="color: #6B6B70;">Cree par <strong style="color: #D4AF37;">MG Events Animation</strong></span>
              </p>

            </td>
          </tr>

          <!-- Golden Glow Effect Bottom -->
          <tr>
            <td align="center" style="padding-top: 2px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="3" style="background: linear-gradient(90deg, transparent 0%, #D4AF37 20%, #F4D03F 50%, #D4AF37 80%, transparent 100%); border-radius: 0 0 20px 20px;"></td>
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
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Abonnement bientot expire</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0D0D0F; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0D0D0F;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">

          <!-- Warning Glow -->
          <tr>
            <td height="3" style="background: linear-gradient(90deg, transparent 0%, #E53935 20%, #FF5722 50%, #E53935 80%, transparent 100%); border-radius: 20px 20px 0 0;"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="background: linear-gradient(180deg, #1A1A1E 0%, #242428 100%); padding: 40px; border-radius: 20px 20px 0 0;">
              <img src="https://animajet.fr/images/animajet_logo_principal.png" alt="AnimaJet" width="120" height="120" style="display: block; width: 120px; height: 120px; border: 0; border-radius: 15px;" />
              <h1 style="margin: 25px 0 0 0; color: #E53935; font-size: 26px; font-weight: 700;">
                Votre abonnement expire bientot
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="background-color: #1A1A1E; padding: 40px;">
              <p style="margin: 0 0 25px; color: #E5E5E7; font-size: 16px; line-height: 1.7;">
                Votre abonnement AnimaJet expire dans <strong style="color: #E53935; font-size: 20px;">${daysLeft} jours</strong>.
              </p>
              <p style="margin: 0 0 35px; color: #9A9AA0; font-size: 15px; line-height: 1.7;">
                Si vous ne renouvelez pas, vos photos et sessions seront desactivees apres l'expiration.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/admin/settings" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #1A1A1E; text-decoration: none; padding: 18px 45px; border-radius: 12px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 20px rgba(212, 175, 55, 0.4);">
                      Renouveler mon abonnement
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0D0D0F; padding: 30px 40px; border-radius: 0 0 20px 20px; border-top: 1px solid #2A2A2E;">
              <p style="margin: 0; color: #4A4A4F; font-size: 12px; text-align: center; line-height: 1.8;">
                &copy; 2025 AnimaJet - Tous droits reserves<br>
                <span style="color: #6B6B70;">Cree par <strong style="color: #D4AF37;">MG Events Animation</strong></span>
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
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Abonnement expire</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0D0D0F; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0D0D0F;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">

          <!-- Red Warning -->
          <tr>
            <td height="3" style="background: linear-gradient(90deg, transparent 0%, #E53935 30%, #E53935 70%, transparent 100%); border-radius: 20px 20px 0 0;"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="background: linear-gradient(180deg, #1A1A1E 0%, #242428 100%); padding: 40px; border-radius: 20px 20px 0 0;">
              <img src="https://animajet.fr/images/animajet_logo_principal.png" alt="AnimaJet" width="100" height="100" style="display: block; width: 100px; height: 100px; border: 0; border-radius: 15px; opacity: 0.7;" />
              <h1 style="margin: 25px 0 0 0; color: #E53935; font-size: 26px; font-weight: 700;">
                Abonnement expire
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="background-color: #1A1A1E; padding: 40px;">
              <p style="margin: 0 0 20px; color: #E5E5E7; font-size: 16px; line-height: 1.7;">
                Votre abonnement AnimaJet a expire. Vos sessions et photos ont ete desactivees.
              </p>
              <p style="margin: 0 0 35px; color: #9A9AA0; font-size: 15px; line-height: 1.7;">
                Reabonnez-vous pour retrouver l'acces a vos donnees et continuer a animer vos evenements.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #1A1A1E; text-decoration: none; padding: 18px 45px; border-radius: 12px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 20px rgba(212, 175, 55, 0.4);">
                      Se reabonner maintenant
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0D0D0F; padding: 30px 40px; border-radius: 0 0 20px 20px; border-top: 1px solid #2A2A2E;">
              <p style="margin: 0; color: #4A4A4F; font-size: 12px; text-align: center; line-height: 1.8;">
                &copy; 2025 AnimaJet - Tous droits reserves<br>
                <span style="color: #6B6B70;">Cree par <strong style="color: #D4AF37;">MG Events Animation</strong></span>
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
