import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

// Regression: Ein eingeloggter, Deal-berechtigter User mit aktiven Präferenzen
// klickt "Neuer Chat" (bare /new). Bis 2026-07 injizierte die Seite hier
// serverseitig einen Deal-Prompt, der jeden neuen Chat mit einer automatischen
// Suche kaperte. Ein bare /new muss IMMER auf dem leeren Chat landen.
// Braucht --experimental-test-module-mocks (im test-Script gesetzt).

mock.module('@/lib/auth-utils', {
  namedExports: {
    getUser: async () => ({ id: 'user-1', email: 'pascal.lammers@stay-digital.de' }),
  },
});
mock.module('@/lib/db/deal-queries', {
  namedExports: {
    getUserDealPreferences: async () => ({ homeAirports: ['DUS'], regions: ['europe'] }),
    getActiveDeals: async () => [{ id: 'deal-1' }],
  },
});
mock.module('@/lib/deals', {
  namedExports: {
    createDealPreferenceSnapshot: (p: unknown) => p,
    hasActiveDealPreferences: () => true,
    buildDealsPageData: async () => ({
      hasPersonalization: true,
      featuredDeal: {
        origin: 'DUS',
        destination: 'FAO',
        destinationName: 'Faro',
        price: 129,
        currency: 'EUR',
        departureDate: '2026-09-10',
        personalizationReasons: ['du oft ab Düsseldorf fliegst'],
      },
    }),
  },
});
mock.module('@/lib/deals/flight-deals-access', {
  namedExports: {
    isFlightDealsAuthorizedEmail: () => true,
  },
});

const { default: NewPage } = await import('../../app/[locale]/(chat)/new/page');

async function getRedirectDigest(searchParams: Record<string, string | string[] | undefined>): Promise<string> {
  try {
    await NewPage({
      params: Promise.resolve({ locale: 'de' }),
      searchParams: Promise.resolve(searchParams),
    });
  } catch (error) {
    if (error instanceof Error && 'digest' in error && typeof error.digest === 'string') {
      return error.digest;
    }
    throw error;
  }
  throw new Error('Expected NewPage to redirect');
}

describe('NewPage – deal-berechtigter User mit aktiven Präferenzen', () => {
  it('bare "Neuer Chat" bleibt leer – keine auto-injizierte Deal-Suche', async () => {
    const digest = await getRedirectDigest({});
    assert.strictEqual(digest, 'NEXT_REDIRECT;replace;/de;307;');
  });
});
