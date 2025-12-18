import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'MYLO <support@never-economy-again.com>'; // TODO: Update domain after deployment

/**
 * Resend email status response type
 */
export interface ResendEmailStatus {
  id: string;
  to: string[];
  from: string;
  created_at: string;
  last_event: 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked' | null;
}

/**
 * Get email delivery status from Resend
 * @param emailId - Resend email ID
 * @returns Email status or null if not found
 */
export async function getEmailStatus(emailId: string): Promise<ResendEmailStatus | null> {
  try {
    const response = await resend.emails.get(emailId);
    
    if (response.error) {
      console.error('❌ Resend get email error:', response.error);
      return null;
    }
    
    return response.data as ResendEmailStatus;
  } catch (error) {
    console.error('❌ Failed to get email status:', error);
    return null;
  }
}

/**
 * Send welcome email with login credentials to new users
 * @param email - User's email address
 * @param password - Generated temporary password
 * @param firstName - Optional first name for personalization
 */
export async function sendWelcomeEmail(email: string, password: string, firstName?: string) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: '🎉 Willkommen bei MYLO - Deine Zugangsdaten',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                border-radius: 10px 10px 0 0;
                text-align: center;
              }
              .content {
                background: #f9fafb;
                padding: 30px;
                border-radius: 0 0 10px 10px;
              }
              .credentials {
                background: white;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #667eea;
              }
              .button {
                display: inline-block;
                background: #667eea;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
              }
              code {
                background: #e5e7eb;
                padding: 4px 8px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Willkommen bei MYLO!</h1>
              </div>
              <div class="content">
                <p>Hallo ${firstName || 'MYLO-Nutzer'},</p>
                
                <p>
                  vielen Dank für deinen Kauf! Dein MYLO Travel-Concierge ist jetzt bereit.
                </p>

                <div class="credentials">
                  <h3>Deine Zugangsdaten:</h3>
                  <p><strong>E-Mail:</strong><br/><code>${email}</code></p>
                  <p><strong>Passwort:</strong><br/><code>${password}</code></p>
                </div>

                <p>
                  <strong>⚠️ Wichtig:</strong> Bitte ändere dein Passwort nach dem ersten Login in den Einstellungen.
                </p>

                <center>
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in" class="button">
                    Jetzt anmelden
                  </a>
                </center>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

                <p style="font-size: 12px; color: #6b7280;">
                  Falls du Probleme beim Login hast, antworte einfach auf diese E-Mail.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    console.log('✅ Welcome email sent to:', email);
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    throw error;
  }
}

/**
 * Send password reset email
 * @param email - User's email address
 * @param url - Password reset URL with token
 */
export async function sendPasswordResetEmail(email: string, url: string) {
  console.log('📧 Preparing password reset email for:', email);
  console.log('🔑 Resend API Key present:', !!process.env.RESEND_API_KEY);
  console.log('🔗 Reset URL:', url);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Passwort zurücksetzen - MYLO',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .button {
                display: inline-block;
                background: #667eea;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Passwort zurücksetzen</h2>
              <p>Du hast einen Passwort-Reset angefordert.</p>
              <p>Klicke auf den Button, um ein neues Passwort zu setzen:</p>
              
              <center>
                <a href="${url}" class="button">Passwort zurücksetzen</a>
              </center>

              <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
                Falls du diese E-Mail nicht angefordert hast, ignoriere sie einfach.
                <br/>
                Der Link ist 1 Stunde gültig.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    console.log('✅ Password reset email sent successfully');
    console.log('📧 Resend response:', JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('❌ Failed to send password reset email');
    console.error('📧 Target email:', email);
    console.error('🔗 Reset URL:', url);
    console.error('💥 Error details:', error);

    // IMPORTANT: Re-throw error so Better-Auth knows it failed!
    throw error;
  }
}

/**
 * Send admin alert for failed payment
 * Notifies support@never-economy-again.com when a subscription payment fails
 * 
 * @param customerEmail - Customer's email address
 * @param customerName - Customer's name
 * @param orderId - ThriveCart order ID
 * @param failedAt - Timestamp of the failed payment
 */
export async function sendFailedPaymentAdminAlert(
  customerEmail: string,
  customerName: string,
  orderId: string,
  failedAt: Date
) {
  const ADMIN_EMAIL = 'support@never-economy-again.com';

  console.log('📧 Sending failed payment alert to admin for:', customerEmail);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: '⚠️ Fehlgeschlagene Zahlung - MYLO',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .alert-header {
                background: #dc2626;
                color: white;
                padding: 20px;
                border-radius: 10px 10px 0 0;
                text-align: center;
              }
              .content {
                background: #fef2f2;
                padding: 30px;
                border-radius: 0 0 10px 10px;
                border: 1px solid #fecaca;
                border-top: none;
              }
              .info-box {
                background: white;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #dc2626;
              }
              .info-row {
                margin: 10px 0;
              }
              .label {
                font-weight: bold;
                color: #6b7280;
                font-size: 12px;
                text-transform: uppercase;
              }
              .value {
                font-size: 16px;
                color: #111827;
              }
              .status-badge {
                display: inline-block;
                background: #fef3c7;
                color: #92400e;
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="alert-header">
                <h1>⚠️ Fehlgeschlagene Zahlung</h1>
              </div>
              <div class="content">
                <p>Eine wiederkehrende Zahlung ist fehlgeschlagen. Der Kunde wurde automatisch gesperrt.</p>
                
                <div class="info-box">
                  <div class="info-row">
                    <div class="label">Kunde</div>
                    <div class="value">${customerName || 'Unbekannt'}</div>
                  </div>
                  <div class="info-row">
                    <div class="label">E-Mail</div>
                    <div class="value">${customerEmail}</div>
                  </div>
                  <div class="info-row">
                    <div class="label">Order ID</div>
                    <div class="value">${orderId || 'Nicht verfügbar'}</div>
                  </div>
                  <div class="info-row">
                    <div class="label">Zeitpunkt</div>
                    <div class="value">${failedAt.toLocaleString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })} Uhr</div>
                  </div>
                  <div class="info-row">
                    <div class="label">Status</div>
                    <div class="value"><span class="status-badge">GESPERRT</span></div>
                  </div>
                </div>

                <p style="font-size: 14px; color: #6b7280;">
                  Der Kunde kann sich nicht mehr einloggen, bis eine erfolgreiche Zahlung eingeht.
                  Bei erfolgreicher Nachzahlung wird der Account automatisch reaktiviert.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log('✅ Admin alert sent successfully');
    return result;
  } catch (error) {
    console.error('❌ Failed to send admin alert:', error);
    // Don't throw - admin alert failure shouldn't block the main flow
    return null;
  }
}
