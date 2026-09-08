import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderFailoverAlertHtml } from './failover-email';

describe('renderFailoverAlertHtml', () => {
  it('renders failover details and escapes provider names', () => {
    const html = renderFailoverAlertHtml({
      failoverRate: 0.125,
      totalRequests: 8,
      recoveryCount: 2,
      recoveryRate: 0.25,
      providerBreakdown: {
        xai: 2,
        'anthropic <beta>': 6,
      },
      attemptDepthHistogram: {
        3: 1,
        1: 7,
      },
      periodStart: '2026-09-08T10:00:00.000Z',
      periodEnd: '2026-09-08T11:00:00.000Z',
      threshold: 0.05,
    });

    assert.match(
      html,
      /In der letzten Stunde gingen 12,5 % von 8 Anfragen in den Failover \(Schwelle 5,0 %\)\./,
    );
    assert.match(html, /Recovery: 2 \(25,0 %\)/);
    assert.match(html, /Endgültiger Provider/);
    assert.match(html, /anthropic &lt;beta&gt;/);
    assert.doesNotMatch(html, /anthropic <beta>/);
    assert.ok(html.indexOf('anthropic &lt;beta&gt;') < html.indexOf('xai'));
    assert.match(html, /Versuchstiefe/);
    assert.ok(html.indexOf('>1<') < html.indexOf('>3<'));
  });
});
