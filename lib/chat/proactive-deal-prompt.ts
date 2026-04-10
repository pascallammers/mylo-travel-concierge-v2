import type { PresentedDeal } from '@/lib/deals';

/**
 * Build a proactive chat starter from a personalized deal recommendation.
 *
 * @param deal - Top recommended deal for the current user.
 * @param locale - Locale used for number/date formatting.
 * @returns A concise chat starter that references the personalized deal.
 */
export function buildProactiveDealPrompt(
  deal: PresentedDeal,
  locale: string,
): string {
  const travelMonth = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(deal.departureDate));
  const priceLabel =
    deal.currency === 'PTS'
      ? `${Math.round(deal.price).toLocaleString(locale)} Punkte`
      : `${Math.round(deal.price).toLocaleString(locale)} ${deal.currency}`;
  const destinationName = deal.destinationName || deal.destination;
  const personalizationHint =
    deal.personalizationReasons.length > 0
      ? ` Das passt gut, weil ${deal.personalizationReasons[0].charAt(0).toLowerCase()}${deal.personalizationReasons[0].slice(1)}.`
      : '';

  return `Uebrigens: ${destinationName} ab ${deal.origin} ist gerade bei ${priceLabel} im ${travelMonth}.${personalizationHint} Ist das ein guter Deal fuer mich und welche Reiseoptionen wuerdest du empfehlen?`;
}
