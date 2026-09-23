import assert from 'node:assert/strict';
import { it } from 'node:test';
import { formatGracefulFlightError } from './tool-error-response';

for (const locale of ['de', 'en'] as const) {
  it(`suggests retrying later and comparing cash fares for a daily limit (${locale})`, () => {
    const output = formatGracefulFlightError({ type: 'rate_limited', message: 'Daily quota reached', locale });
    assert.match(output, locale === 'de' ? /Später erneut suchen/ : /Search again later/);
    assert.match(
      output,
      locale === 'de' ? /Barpreise über die Links unten vergleichen/ : /Compare cash fares using the links below/,
    );
    assert.doesNotMatch(output, /Minuten|minutes|gleichzeitig|concurrent/);
  });
}
