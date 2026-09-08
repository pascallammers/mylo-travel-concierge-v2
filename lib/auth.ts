import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import {
  user,
  session,
  verification,
  account,
  chat,
  message,
  extremeSearchUsage,
  messageUsage,
  subscription,
  payment,
  customInstructions,
  stream,
} from '@/lib/db/schema';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db';
import { config } from 'dotenv';
import { serverEnv } from '@/env/server';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { buildResetPasswordUrl, resolveBaseUrl } from './password-reset';
import { checkUserAccess, type AccessCheckResult } from './access-control';

config({
  path: '.env.local',
});

type AuthLocale = 'de' | 'en';

const accessDeniedMessages: Record<string, Record<AuthLocale, string>> = {
  inactive_user: {
    de: 'Dein Account ist deaktiviert. Bitte kontaktiere den Support.',
    en: 'Your account is deactivated. Please contact support.',
  },
  expired_subscription: {
    de: 'Dein Abo ist abgelaufen. Bitte verlängere dein Abo, um MYLO weiter zu nutzen.',
    en: 'Your subscription has expired. Please renew your subscription to continue using MYLO.',
  },
  no_subscription: {
    de: 'Dein Abo ist nicht aktiv. Bitte kontaktiere den Support.',
    en: 'Your subscription is not active. Please contact support.',
  },
  default: {
    de: 'Der Login ist für diesen Account derzeit nicht möglich. Bitte kontaktiere den Support.',
    en: 'Login is currently not possible for this account. Please contact support.',
  },
};

/**
 * Detects locale from the request referer URL path (e.g. /en/sign-in or /de/sign-in).
 * Falls back to 'en' when no locale prefix is found.
 */
function detectLocaleFromReferer(referer: string | null | undefined): AuthLocale {
  if (!referer) return 'en';
  try {
    const url = new URL(referer);
    const match = url.pathname.match(/^\/(de|en)\b/);
    return (match?.[1] as AuthLocale) ?? 'en';
  } catch {
    return 'en';
  }
}

/**
 * Creates a localized login denial message from an access check result.
 * @param accessResult - Result returned by the access-control service.
 * @param locale - Language for the error message.
 * @returns Human-friendly error shown on the sign-in form.
 */
function getAccessDeniedMessage(accessResult: AccessCheckResult, locale: AuthLocale = 'en'): string {
  const key = accessResult.reason ?? 'default';
  return accessDeniedMessages[key]?.[locale] ?? accessDeniedMessages.default[locale];
}

export const auth = betterAuth({
  rateLimit: {
    max: 50,
    window: 60,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      verification,
      account,
      chat,
      message,
      extremeSearchUsage,
      messageUsage,
      subscription,
      payment,
      customInstructions,
      stream,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // No signup = no verification needed
    password: {
      // Support bcrypt hashes for users created via webhook
      hash: async (password: string) => bcrypt.hash(password, 10),
      verify: async ({ hash, password }: { hash: string; password: string }) => bcrypt.compare(password, hash),
    },
    sendResetPassword: async ({ user, url, token }: { user: any; url: string; token: string }) => {
      console.log('🔔 Better-Auth: sendResetPassword callback triggered');
      console.log('👤 User:', user.email);
      console.log('🔗 Reset URL:', url);
      console.log('🎫 Token:', token);

      try {
        const baseUrl = resolveBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
        const resetUrl = buildResetPasswordUrl({
          baseUrl,
          token,
          email: user.email,
        });
        console.log('🔗 Normalized reset URL:', resetUrl);

        // Persist token so our custom confirmation endpoint can always validate it
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await db.insert(verification).values({
          id: crypto.randomUUID(),
          identifier: user.email,
          value: token,
          expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log('💾 Stored reset token for verification');

        // Import email service dynamically to avoid circular dependencies
        const { sendPasswordResetEmail } = await import('./email');
        await sendPasswordResetEmail(user.email, resetUrl);
        console.log('✅ Better-Auth: Password reset email sent successfully');
      } catch (error) {
        console.error('❌ Better-Auth: Failed to send password reset email:', error);
        // Important: Re-throw error so Better-Auth knows it failed
        throw error;
      }
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!ctx.path.startsWith('/sign-in')) {
        return;
      }

      if (!ctx.body || typeof ctx.body !== 'object') {
        return;
      }

      const emailValue = 'email' in ctx.body ? ctx.body.email : undefined;
      if (typeof emailValue !== 'string') {
        return;
      }

      const normalizedEmail = emailValue.toLowerCase().trim();
      if (!normalizedEmail) {
        return;
      }

      const matchedUser = await db.query.user.findFirst({
        where: eq(user.email, normalizedEmail),
        columns: { id: true },
      });

      if (!matchedUser) {
        return;
      }

      const accessResult = await checkUserAccess(matchedUser.id);
      if (accessResult.hasAccess) {
        return;
      }

      const referer = ctx.headers?.get?.('referer') ?? null;
      const locale = detectLocaleFromReferer(referer);

      throw new APIError('FORBIDDEN', {
        message: getAccessDeniedMessage(accessResult, locale),
      });
    }),
  },
  pluginRoutes: {
    autoNamespace: true,
  },
  plugins: [
    nextCookies(),
  ],
  trustedOrigins: [
    'http://localhost:3000',
    'https://mylo-travel-concierge-v2.vercel.app',
    'https://mylo-travel-concierge-v2-*.vercel.app', // Preview deployments
  ],
});
