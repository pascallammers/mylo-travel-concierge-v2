/** E-mail addresses allowed to access Flight Deals during the private rollout. */
const FLIGHT_DEALS_AUTHORIZED_EMAILS = [
  'pascal.lammers@stay-digital.de',
  'tayler.schweigert@lovelifepassport.com',
] as const;

/**
 * Check whether an email is allowed to access Flight Deals.
 *
 * @param email - User email address to check.
 * @returns True when the email is part of the private rollout allowlist.
 */
export function isFlightDealsAuthorizedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return FLIGHT_DEALS_AUTHORIZED_EMAILS.includes(
    email.toLowerCase().trim() as (typeof FLIGHT_DEALS_AUTHORIZED_EMAILS)[number],
  );
}
