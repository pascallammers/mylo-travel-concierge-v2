import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { getActiveDeals, getDealDigestRecipients } from '@/lib/db/deal-queries';
import {
  createDealPreferenceSnapshot,
  hasActiveDealPreferences,
  selectTopPersonalizedDeals,
} from '@/lib/deals';
import { sendDealDigestEmail } from '@/lib/email';

/**
 * Send personalized deal digests to users with saved alert preferences.
 *
 * @param request - Cron request carrying the shared bearer secret.
 * @returns Summary of sent and skipped digests.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${serverEnv.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const frequencies: Array<'daily' | 'weekly'> = ['daily'];

  if (now.getUTCDay() === 1) {
    frequencies.push('weekly');
  }

  const deals = await getActiveDeals({
    minScore: 60,
    limit: 200,
  });

  let sent = 0;
  let skipped = 0;
  const details: Array<{ userId: string; frequency: 'daily' | 'weekly'; status: 'sent' | 'skipped'; reason?: string }> = [];

  for (const frequency of frequencies) {
    const recipients = await getDealDigestRecipients(frequency);

    for (const recipient of recipients) {
      const preferences = createDealPreferenceSnapshot(recipient.preferences);

      if (!hasActiveDealPreferences(preferences)) {
        skipped += 1;
        details.push({
          userId: recipient.userId,
          frequency,
          status: 'skipped',
          reason: 'no_active_preferences',
        });
        continue;
      }

      const personalizedDeals = selectTopPersonalizedDeals(deals, preferences, 3);

      if (personalizedDeals.length === 0) {
        skipped += 1;
        details.push({
          userId: recipient.userId,
          frequency,
          status: 'skipped',
          reason: 'no_matching_deals',
        });
        continue;
      }

      await sendDealDigestEmail(
        recipient.email,
        recipient.name,
        personalizedDeals.map(({ deal, personalization }) => ({
          origin: deal.origin,
          destination: deal.destination,
          destinationName: deal.destinationName,
          price: deal.price,
          currency: deal.currency,
          dealScore: deal.dealScore,
          personalizedScore: personalization.score,
          personalizationReasons: personalization.reasons,
        })),
        frequency,
      );

      sent += 1;
      details.push({
        userId: recipient.userId,
        frequency,
        status: 'sent',
      });
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    frequencies,
    details,
  });
}

export const maxDuration = 300;
