const INFRASTRUCTURE_ERROR_PATTERNS: RegExp[] = [
  /free tier users do not have access/i,
  /free credits temporarily/i,
  /restrictedmodelserror/i,
  /no_providers_available/i,
  /vercel\.com/i,
  /\bai[- ]gateway\b/i,
  /purchase credits/i,
  /paid credits/i,
  /top-up/i,
  /bring your own key/i,
];

const TECHNICAL_ERROR_PATTERNS: RegExp[] = [
  /type validation failed/i,
  /ai_typevalidationerror/i,
  /unexpected token/i,
  /cannot read propert/i,
  /econnrefused/i,
  /socket hang up/i,
];

const DEFAULT_USER_MESSAGE =
  'Something went wrong while processing your message. Please try again.';

const INFRASTRUCTURE_USER_MESSAGE =
  'Our AI service is temporarily unavailable. Please try again in a moment.';

/**
 * Returns a safe, user-facing chat error message without provider or infrastructure details.
 *
 * @param raw - Raw error text from the AI SDK, gateway, or stream handler.
 * @returns Sanitized message suitable for UI display.
 */
export function sanitizeUserFacingStreamError(raw: string | undefined | null): string {
  if (!raw?.trim()) {
    return DEFAULT_USER_MESSAGE;
  }

  const message = raw.trim();

  if (INFRASTRUCTURE_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return INFRASTRUCTURE_USER_MESSAGE;
  }

  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return DEFAULT_USER_MESSAGE;
  }

  if (/https?:\/\//i.test(message)) {
    return DEFAULT_USER_MESSAGE;
  }

  if (message.length > 280) {
    return DEFAULT_USER_MESSAGE;
  }

  return message;
}

/**
 * Whether the raw error should be hidden from secondary UI (cause blocks, toasts).
 *
 * @param raw - Raw error text before sanitization.
 * @returns True when the raw message must not be shown to end users.
 */
export function shouldHideRawStreamErrorDetails(raw: string | undefined | null): boolean {
  if (!raw?.trim()) {
    return false;
  }

  const message = raw.trim();
  return (
    sanitizeUserFacingStreamError(message) !== message ||
    INFRASTRUCTURE_ERROR_PATTERNS.some((pattern) => pattern.test(message)) ||
    TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message)) ||
    /https?:\/\//i.test(message)
  );
}
