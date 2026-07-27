import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
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
