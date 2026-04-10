import { redirect } from 'next/navigation';
import { buildNewChatRedirectUrl } from '@/lib/chat/new-chat-handoff';
import { buildProactiveDealPrompt } from '@/lib/chat/proactive-deal-prompt';
import { getUser } from '@/lib/auth-utils';
import { getActiveDeals, getUserDealPreferences } from '@/lib/db/deal-queries';
import {
  buildDealsPageData,
  createDealPreferenceSnapshot,
  hasActiveDealPreferences,
} from '@/lib/deals';

interface NewPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewPage({ params, searchParams }: NewPageProps) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  const normalizedSearchParams = Object.fromEntries(
    Object.entries(rawSearchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const hasExplicitQuery = Boolean(
    normalizedSearchParams.query?.trim() ||
    normalizedSearchParams.q?.trim() ||
    normalizedSearchParams.prefill?.trim() ||
    (normalizedSearchParams.origin?.trim() && normalizedSearchParams.destination?.trim()),
  );

  if (!hasExplicitQuery) {
    const user = await getUser();

    if (user) {
      const preferences = createDealPreferenceSnapshot(await getUserDealPreferences(user.id));

      if (hasActiveDealPreferences(preferences)) {
        const deals = await getActiveDeals({
          minScore: 60,
          limit: 120,
        });
        const model = await buildDealsPageData(
          deals,
          { bucket: 'all', sort: 'score' },
          new Date(),
          preferences,
        );

        if (model.hasPersonalization && model.featuredDeal) {
          normalizedSearchParams.query = buildProactiveDealPrompt(model.featuredDeal, locale);
        }
      }
    }
  }

  redirect(buildNewChatRedirectUrl(locale, normalizedSearchParams));
}
