import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  FlexibleDateResults,
  formatFlexibleCalendarDate,
  isFlexibleAwardFlight,
} from '@/components/message-parts/flexible-date-results';

describe('flexible-date result rendering helpers', () => {
  it('keeps ISO calendar dates stable west of UTC', () => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      assert.strictEqual(
        formatFlexibleCalendarDate('2026-08-15', 'en'),
        '8/15/2026',
      );
    } finally {
      if (previousTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimeZone;
      }
    }
  });

  it('recognizes persisted string prices without a source as awards', () => {
    assert.strictEqual(
      isFlexibleAwardFlight({
        price: '45,000 Miles',
        searchedDate: '2026-08-15',
        dateOffset: 0,
        dateLabel: 'Original date',
      }),
      true,
    );
  });
});


describe('visible award fallback notice', () => {
  it('renders the tiering notice in the status paragraph users see', () => {
    const notice = 'Mit Meilen gibt es keine Direktflüge. Optionen mit 1 Zwischenstopp.';
    const rendered = FlexibleDateResults({ data: { dateRange: { start: '2026-11-12', end: '2026-11-18' }, awardNotice: notice } });
    const children = rendered.props.children as Array<{ props?: { role?: string; children?: unknown } } | null>;
    assert.ok(children.some((child) => child?.props?.role === 'status' && child.props.children === notice));
  });
});
