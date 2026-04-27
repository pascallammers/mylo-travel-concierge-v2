const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+\d{1,3}[ -]?\d{2,4}[ -]?\d{3,4}[ -]?\d{3,4}/g;
const LONG_DIGIT_RE = /\b\d{8,}\b/g;

export function anonymizeUserQuery(
  input: string,
  opts: { userName?: string } = {},
): string {
  let out = input;
  out = out.replace(EMAIL_RE, 'user@example.com');
  out = out.replace(PHONE_RE, '+49 xxx xxx xxxx');
  out = out.replace(LONG_DIGIT_RE, 'XXXXXXXX');
  if (opts.userName) {
    const escaped = opts.userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), '[Name]');
  }
  return out;
}

export function scanForPii(text: string): string[] {
  const issues: string[] = [];
  if (EMAIL_RE.test(text)) issues.push('email-pattern');
  if (PHONE_RE.test(text)) issues.push('phone-pattern');
  if (LONG_DIGIT_RE.test(text)) issues.push('long-digit-run');
  // Reset regex lastIndex (global flag) so consecutive calls don't lie
  EMAIL_RE.lastIndex = 0;
  PHONE_RE.lastIndex = 0;
  LONG_DIGIT_RE.lastIndex = 0;
  return issues;
}
