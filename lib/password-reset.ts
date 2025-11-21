/**
 * Normalize base URLs and build password reset links.
 */

export interface ResetPasswordUrlParams {
  baseUrl: string;
  token: string;
  email?: string;
}

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Normalize a base URL by adding protocol (if missing) and trimming trailing slashes.
 * @param rawBaseUrl - Base URL from env/config (may include trailing slashes or lack protocol)
 * @returns Normalized absolute base URL (e.g. https://example.com)
 */
export function normalizeBaseUrl(rawBaseUrl?: string): string {
  const candidate = (rawBaseUrl || DEFAULT_BASE_URL).trim();
  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate.replace(/^\/*/, '')}`;
  return withProtocol.replace(/\/+$/, '');
}

/**
 * Build a reset-password confirmation URL with token (and optional email) as query params.
 * @param params.baseUrl - Application base URL
 * @param params.token - Password reset token stored in verification table
 * @param params.email - Optional email for convenience
 * @returns Absolute URL pointing to /reset-password/confirm
 */
export function buildResetPasswordUrl({ baseUrl, token, email }: ResetPasswordUrlParams): string {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const url = new URL(`${normalizedBase}/reset-password/confirm`);
  url.searchParams.set('token', token);

  if (email) {
    url.searchParams.set('email', email);
  }

  return url.toString();
}

/**
 * Resolve the application base URL using provided value or defaults.
 * @param rawBaseUrl - Optional base URL string
 * @returns Normalized base URL
 */
export function resolveBaseUrl(rawBaseUrl?: string): string {
  return normalizeBaseUrl(rawBaseUrl || DEFAULT_BASE_URL);
}
