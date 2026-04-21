import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'MYLO <support@never-economy-again.com>'; // TODO: Update domain after deployment

export type EmailLocale = 'de' | 'en';

const emailTranslations = {
  welcome: {
    de: {
      subject: '🎉 Willkommen bei MYLO - Deine Zugangsdaten',
      heading: '🎉 Willkommen bei MYLO!',
      greeting: (name: string) => `Hallo ${name},`,
      defaultUser: 'MYLO-Nutzer',
      intro: 'vielen Dank für deinen Kauf! Dein MYLO Travel-Concierge ist jetzt bereit.',
      credentialsHeading: 'Deine Zugangsdaten:',
      emailLabel: 'E-Mail:',
      passwordLabel: 'Passwort:',
      warning: '⚠️ Wichtig: Bitte ändere dein Passwort nach dem ersten Login in den Einstellungen.',
      loginButton: 'Jetzt anmelden',
      footer: 'Falls du Probleme beim Login hast, antworte einfach auf diese E-Mail.',
    },
    en: {
      subject: '🎉 Welcome to MYLO - Your Login Credentials',
      heading: '🎉 Welcome to MYLO!',
      greeting: (name: string) => `Hi ${name},`,
      defaultUser: 'MYLO User',
      intro: 'Thank you for your purchase! Your MYLO Travel Concierge is ready.',
      credentialsHeading: 'Your login credentials:',
      emailLabel: 'Email:',
      passwordLabel: 'Password:',
      warning: '⚠️ Important: Please change your password after your first login in the settings.',
      loginButton: 'Sign in now',
      footer: 'If you have any issues logging in, simply reply to this email.',
    },
  },
  resetPassword: {
    de: {
      subject: 'Passwort zurücksetzen - MYLO',
      heading: 'Passwort zurücksetzen',
      intro: 'Du hast einen Passwort-Reset angefordert.',
      instruction: 'Klicke auf den Button, um ein neues Passwort zu setzen:',
      button: 'Passwort zurücksetzen',
      footer: 'Falls du diese E-Mail nicht angefordert hast, ignoriere sie einfach.',
      expiry: 'Der Link ist 1 Stunde gültig.',
    },
    en: {
      subject: 'Reset Password - MYLO',
      heading: 'Reset Password',
      intro: 'You requested a password reset.',
      instruction: 'Click the button below to set a new password:',
      button: 'Reset Password',
      footer: 'If you did not request this email, you can safely ignore it.',
      expiry: 'The link is valid for 1 hour.',
    },
  },
} as const;

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
 * @param locale - Language for the email content (default: 'en')
 */
export async function sendWelcomeEmail(
  email: string,
  password: string,
  firstName?: string,
  locale: EmailLocale = 'en',
) {
  const t = emailTranslations.welcome[locale];
  const APP_URL = process.env.NODE_ENV === 'production' 
    ? 'https://chat.never-economy-again.com' 
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://chat.never-economy-again.com');
  
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: t.subject,
      html: `
        <!DOCTYPE html>
        <html lang="${locale}">
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
                <h1>${t.heading}</h1>
              </div>
              <div class="content">
                <p>${t.greeting(firstName || t.defaultUser)}</p>
                
                <p>${t.intro}</p>

                <div class="credentials">
                  <h3>${t.credentialsHeading}</h3>
                  <p><strong>${t.emailLabel}</strong><br/><code>${email}</code></p>
                  <p><strong>${t.passwordLabel}</strong><br/><code>${password}</code></p>
                </div>

                <p><strong>${t.warning}</strong></p>

                <center>
                  <a href="${APP_URL}/sign-in" class="button">
                    ${t.loginButton}
                  </a>
                </center>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

                <p style="font-size: 12px; color: #6b7280;">
                  ${t.footer}
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
 * @param locale - Language for the email content (default: 'en')
 */
export async function sendPasswordResetEmail(
  email: string,
  url: string,
  locale: EmailLocale = 'en',
) {
  const t = emailTranslations.resetPassword[locale];
  console.log('📧 Preparing password reset email for:', email);
  console.log('🔑 Resend API Key present:', !!process.env.RESEND_API_KEY);
  console.log('🔗 Reset URL:', url);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: t.subject,
      html: `
        <!DOCTYPE html>
        <html lang="${locale}">
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
              <h2>${t.heading}</h2>
              <p>${t.intro}</p>
              <p>${t.instruction}</p>
              
              <center>
                <a href="${url}" class="button">${t.button}</a>
              </center>

              <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
                ${t.footer}
                <br/>
                ${t.expiry}
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

export interface DealDigestEmailDeal {
  origin: string;
  destination: string;
  destinationName: string | null;
  price: number;
  currency: string;
  dealScore: number;
  personalizedScore: number;
  personalizationReasons: string[];
}

/**
 * Send a personalized deal digest email.
 *
 * @param email - Recipient email address.
 * @param name - Recipient name for the greeting.
 * @param deals - Personalized deal shortlist.
 * @param frequency - Digest cadence shown in the subject line.
 * @returns Resend API response.
 */
export async function sendDealDigestEmail(
  email: string,
  name: string,
  deals: DealDigestEmailDeal[],
  frequency: 'daily' | 'weekly',
) {
  const appUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://chat.never-economy-again.com'
      : process.env.NEXT_PUBLIC_APP_URL || 'https://chat.never-economy-again.com';
  const subject =
    frequency === 'daily'
      ? 'MYLO Flight Deals: Deine taeglichen Empfehlungen'
      : 'MYLO Flight Deals: Deine Wochenhighlights';
  const dealsMarkup = deals
    .map((deal) => {
      const priceLabel =
        deal.currency === 'PTS'
          ? `${Math.round(deal.price).toLocaleString('de-DE')} Punkte`
          : `${Math.round(deal.price).toLocaleString('de-DE')} ${deal.currency}`;

      return `
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;">
          <div style="font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.04em;">
            ${deal.personalizedScore}% Match
          </div>
          <h3 style="margin:8px 0 6px;font-size:18px;color:#111827;">
            ${deal.origin} → ${deal.destinationName || deal.destination}
          </h3>
          <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">${priceLabel}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">AI Deal Score: ${deal.dealScore}%</p>
          <p style="margin:0;font-size:14px;color:#4b5563;">${deal.personalizationReasons.join(' · ')}</p>
        </div>
      `;
    })
    .join('');

  return resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject,
    html: `
      <!DOCTYPE html>
      <html lang="de">
        <body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
          <div style="max-width:640px;margin:0 auto;padding:24px;">
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:white;padding:28px;border-radius:20px 20px 0 0;">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">MYLO Flight Deals</div>
              <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">Hallo ${name || 'MYLO-Nutzer'}, hier sind deine besten Deals.</h1>
            </div>
            <div style="background:white;padding:24px;border-radius:0 0 20px 20px;border:1px solid #e5e7eb;border-top:none;">
              <p style="margin-top:0;font-size:15px;color:#4b5563;">
                Wir haben deine gespeicherten Praeferenzen genommen und die spannendsten aktuellen Flight Deals fuer dich herausgesucht.
              </p>
              ${dealsMarkup}
              <div style="margin-top:24px;">
                <a href="${appUrl}/deals" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;">
                  Deals in MYLO oeffnen
                </a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}
