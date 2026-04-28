import assert from 'node:assert';
import { describe, it } from 'node:test';
import NewPage from '../../app/[locale]/(chat)/new/page';

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

describe('NewPage', () => {
  it('redirects a bare new chat request to the empty chat screen', async () => {
    const digest = await getRedirectDigest({});

    assert.strictEqual(digest, 'NEXT_REDIRECT;replace;/de;307;');
  });

  it('preserves explicit prefill handoff data for deal cards', async () => {
    const digest = await getRedirectDigest({
      prefill: 'Ist FRA nach JFK ein guter Deal?',
    });

    assert.strictEqual(digest, 'NEXT_REDIRECT;replace;/de?query=Ist+FRA+nach+JFK+ein+guter+Deal%3F;307;');
  });
});
