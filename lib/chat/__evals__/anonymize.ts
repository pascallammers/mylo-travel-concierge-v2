// lib/chat/__evals__/anonymize.ts
//
// Anonymization helpers used by extract-real-chats.ts to scrub PII before
// committing real Neon chats as eval fixtures.
//
// Known limits (NOT caught — manual review by Pascal still required):
// - IBAN / credit card formatted with spaces (4-digit chunks)
// - Loyalty IDs that mix letters and digits (e.g. "EK123456")
// - National passport numbers (German: 9 alphanumeric chars)
// - Cities, country names, dates (intentionally preserved — that's routing context)

const EMAIL_RE = /[\p{L}0-9._%+-]+@[\p{L}0-9.-]+\.[\p{L}]{2,}/giu;
const PHONE_INTL_RE = /\+\d{1,3}[ -]?\d{2,4}[ -]?\d{3,4}[ -]?\d{3,4}/g;
const PHONE_NATIONAL_RE = /\b0\d{2,4}[ /-]?\d{5,9}\b/g;
const LONG_DIGIT_RE = /\b\d{8,}\b/g;

export function anonymizeUserQuery(
  input: string,
  opts: { userName?: string } = {},
): string {
  let out = input;
  out = out.replace(EMAIL_RE, 'user@example.com');
  out = out.replace(PHONE_INTL_RE, '+49 xxx xxx xxxx');
  out = out.replace(PHONE_NATIONAL_RE, '0xxx xxxxxxx');
  out = out.replace(LONG_DIGIT_RE, 'XXXXXXXX');
  if (opts.userName) {
    const escaped = opts.userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Word-boundary + case-insensitive: avoids 'Tim' corrupting 'Timbuktu',
    // matches 'pascal' even if user typed it lowercase.
    out = out.replace(new RegExp('\\b' + escaped + '\\b', 'giu'), '[Name]');
  }
  return out;
}

export function scanForPii(text: string): string[] {
  const issues: string[] = [];
  if (EMAIL_RE.test(text)) issues.push('email-pattern');
  if (PHONE_INTL_RE.test(text) || PHONE_NATIONAL_RE.test(text)) issues.push('phone-pattern');
  if (LONG_DIGIT_RE.test(text)) issues.push('long-digit-run');
  // Reset regex lastIndex (global flag) so consecutive calls don't lie
  EMAIL_RE.lastIndex = 0;
  PHONE_INTL_RE.lastIndex = 0;
  PHONE_NATIONAL_RE.lastIndex = 0;
  LONG_DIGIT_RE.lastIndex = 0;
  return issues;
}
