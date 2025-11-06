import { createAuthClient } from 'better-auth/react';
import { dodopaymentsClient } from '@dodopayments/better-auth';
import { polarClient } from '@polar-sh/better-auth';

/**
 * Get the base URL for the auth client
 * - In browser: uses window.location.origin (supports Vercel preview deployments)
 * - In SSR/build: uses NEXT_PUBLIC_APP_URL or localhost fallback
 */
function getAuthBaseURL(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export const betterauthClient = createAuthClient({
  baseURL: getAuthBaseURL(),
  plugins: [dodopaymentsClient()],
});

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
  plugins: [polarClient()],
});

export const { signIn, signOut, useSession, forgetPassword, changePassword } = authClient;
