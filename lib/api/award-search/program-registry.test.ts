/**
 * Unit tests for the seats.aero program-name registry.
 *
 * Maps the mileage-program SLUG (from trip.Source) to a customer-facing
 * display name. Slugs are the real seats.aero Source values, harvested live
 * from /partnerapi/search across diverse long-haul routes (aeroplan, united,
 * lufthansa, flyingblue, ...). Unknown slugs degrade to a Title-Cased label
 * plus a console warning rather than leaking a raw slug or inventing a brand.
 */

import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import { getProgramDisplayName, KNOWN_PROGRAM_SLUGS, resolveProgramSlugs } from './program-registry';

describe('getProgramDisplayName', () => {
  it('maps the three MUC->MIA regression programs to brand names', () => {
    assert.strictEqual(getProgramDisplayName('aeroplan', 'de'), 'Air Canada Aeroplan');
    assert.strictEqual(getProgramDisplayName('lufthansa', 'de'), 'Lufthansa Miles & More');
    assert.strictEqual(getProgramDisplayName('united', 'de'), 'United MileagePlus');
  });

  it('serves both locales for the same slug', () => {
    assert.strictEqual(getProgramDisplayName('flyingblue', 'en'), 'Flying Blue (Air France/KLM)');
  });

  it('covers at least 25 known seats.aero source slugs', () => {
    assert.ok(
      KNOWN_PROGRAM_SLUGS.length >= 25,
      `expected >=25 mapped programs, got ${KNOWN_PROGRAM_SLUGS.length}`,
    );
    // Every advertised slug must actually resolve (guards typos in the table).
    for (const slug of KNOWN_PROGRAM_SLUGS) {
      assert.ok(getProgramDisplayName(slug, 'de'), `slug ${slug} must resolve in de`);
      assert.ok(getProgramDisplayName(slug, 'en'), `slug ${slug} must resolve in en`);
    }
  });

  it('returns an empty label for a missing slug without throwing', () => {
    assert.doesNotThrow(() => getProgramDisplayName('', 'de'));
    assert.strictEqual(getProgramDisplayName('', 'de'), '');
    assert.strictEqual(getProgramDisplayName(undefined as unknown as string, 'de'), '');
  });

  it('Title-Cases an unknown slug and warns instead of leaking the raw slug', () => {
    const warn = mock.method(console, 'warn', () => {});
    try {
      assert.strictEqual(getProgramDisplayName('madeupprogram', 'de'), 'Madeupprogram');
      assert.strictEqual(warn.mock.callCount(), 1, 'unknown slug must emit one warning');
    } finally {
      warn.mock.restore();
    }
  });
});

describe('resolveProgramSlugs', () => {
  it('resolves an exact slug regardless of case', () => {
    const { matched, unmatched } = resolveProgramSlugs(['Aeroplan']);
    assert.deepStrictEqual(matched, ['aeroplan']);
    assert.deepStrictEqual(unmatched, []);
  });

  it('resolves the seats.aero source slug from a brand display name', () => {
    // The model may hand back the customer-facing name it just saw in the table.
    const { matched } = resolveProgramSlugs(['Lufthansa Miles & More']);
    assert.deepStrictEqual(matched, ['lufthansa']);
  });

  it('resolves a well-known brand keyword the user is likely to type', () => {
    // "such nur bei Aeroplan" / "nur mit Miles & More" — a bare brand word.
    assert.deepStrictEqual(resolveProgramSlugs(['aeroplan']).matched, ['aeroplan']);
    assert.deepStrictEqual(resolveProgramSlugs(['KrisFlyer']).matched, ['singapore']);
    assert.deepStrictEqual(resolveProgramSlugs(['use United rewards']).matched, ['united']);
  });

  it('does not resolve a slug that only occurs inside an unrelated word', () => {
    assert.deepStrictEqual(resolveProgramSlugs(['disunited rewards']), {
      matched: [],
      unmatched: ['disunited rewards'],
    });
  });

  it('does not resolve a short fragment that only appears inside a program token', () => {
    assert.deepStrictEqual(resolveProgramSlugs(['lan']), {
      matched: [],
      unmatched: ['lan'],
    });
  });

  it('reports inputs it cannot map instead of silently dropping them', () => {
    const { matched, unmatched } = resolveProgramSlugs(['aeroplan', 'Nonexistent Program']);
    assert.deepStrictEqual(matched, ['aeroplan']);
    assert.deepStrictEqual(unmatched, ['Nonexistent Program']);
  });

  it('deduplicates when two inputs resolve to the same program', () => {
    const { matched } = resolveProgramSlugs(['aeroplan', 'Air Canada Aeroplan']);
    assert.deepStrictEqual(matched, ['aeroplan']);
  });

  it('returns empty arrays for empty or blank input', () => {
    assert.deepStrictEqual(resolveProgramSlugs([]), { matched: [], unmatched: [] });
    assert.deepStrictEqual(resolveProgramSlugs(['  ']), { matched: [], unmatched: [] });
  });
});
