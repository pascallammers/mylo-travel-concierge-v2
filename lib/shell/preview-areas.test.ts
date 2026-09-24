import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SHELL_AREAS } from './areas';
import { PREVIEW_AREA_SLUGS, parsePreviewAreaSlug, toAreaInterestCounts } from './preview-areas';

test('preview slugs exactly match the shell registry', () => {
  assert.deepEqual(PREVIEW_AREA_SLUGS, SHELL_AREAS.filter((area) => area.state === 'preview').map((area) => area.slug));
});

test('the parser accepts every preview area', () => {
  for (const slug of PREVIEW_AREA_SLUGS) assert.equal(parsePreviewAreaSlug(slug), slug);
});

test('the parser rejects unknown strings and non-string input', () => {
  for (const value of ['hotels', '../x', '', 'ALERTS', ' cards ', null, undefined, 1, true, {}, ['alerts']]) {
    assert.equal(parsePreviewAreaSlug(value), null);
  }
});

test('counts include zero for every area when no interest is registered', () => {
  assert.deepEqual(toAreaInterestCounts([]), { alerts: 0, cards: 0 });
});

test('counts preserve existing counts and fill missing areas', () => {
  assert.deepEqual(toAreaInterestCounts([{ areaSlug: 'alerts', count: 3 }]), { alerts: 3, cards: 0 });
  assert.deepEqual(toAreaInterestCounts([{ areaSlug: 'cards', count: 2 }]), { alerts: 0, cards: 2 });
  assert.deepEqual(toAreaInterestCounts([
    { areaSlug: 'cards', count: 2 }, { areaSlug: 'alerts', count: 3 },
  ]), { alerts: 3, cards: 2 });
});
