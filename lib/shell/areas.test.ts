import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_AREA_SLUG, SHELL_AREAS, findActiveArea } from './areas';

describe('shell area registry', () => {
  it('keeps unique slugs in rail order', () => {
    const slugs = SHELL_AREAS.map((area) => area.slug);

    assert.equal(new Set(slugs).size, slugs.length);
    assert.deepEqual(slugs, ['flights', 'deals', 'hotels', 'alerts', 'cards', 'chat']);
  });

  it('uses a live, registered flights area as the default', () => {
    assert.equal(DEFAULT_AREA_SLUG, 'flights');
    assert.equal(SHELL_AREAS.find((area) => area.slug === DEFAULT_AREA_SLUG)?.state, 'live');
  });

  it('marks both preview areas for locks and gives alerts its quota counter', () => {
    const previews = SHELL_AREAS.filter((area) => area.state === 'preview');

    assert.deepEqual(previews.map((area) => area.slug), ['alerts', 'cards']);
    assert.equal(previews.find((area) => area.slug === 'alerts')?.counter, '0/5');
    assert.equal(previews.find((area) => area.slug === 'cards')?.counter, undefined);
  });

  it('keeps only chat below the divider', () => {
    assert.deepEqual(
      SHELL_AREAS.filter((area) => area.group === 'assistant').map((area) => area.slug),
      ['chat'],
    );
    assert.ok(SHELL_AREAS.filter((area) => area.slug !== 'chat').every((area) => area.group === 'categories'));
  });

  it('opens hotels as a new chat without activating the hotels area', () => {
    const hotels = SHELL_AREAS.find((area) => area.slug === 'hotels');

    assert.equal(hotels?.href, '/chat/new');
    assert.equal(hotels?.state, 'beta');
    assert.deepEqual(hotels?.activePrefixes, []);
    assert.equal(findActiveArea('/new')?.slug, 'chat');
  });
});

describe('findActiveArea', () => {
  const cases = [
    ['/deals', 'deals'],
    ['/deals/x', 'deals'],
    ['/deals/', 'deals'],
    ['/dealsx', null],
    ['/search/abc', 'chat'],
    ['/search', 'chat'],
    ['/searching', null],
    ['/', 'chat'],
    ['/chat', 'chat'],
    ['/chat/new', 'chat'],
    ['/chat/abc', 'chat'],
    ['/new', 'chat'],
    ['/new/abc', 'chat'],
    ['/newspaper', null],
    ['/flights', 'flights'],
    ['/flights/abc', 'flights'],
    ['/flightsx', null],
    ['/alerts', 'alerts'],
    ['/cards', 'cards'],
    ['/hotels', null],
    ['/unknown', null],
  ] as const;

  for (const [pathname, slug] of cases) {
    it(`matches ${pathname} to ${slug ?? 'no area'}`, () => {
      assert.equal(findActiveArea(pathname)?.slug ?? null, slug);
    });
  }
});
