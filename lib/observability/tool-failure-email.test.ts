import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderToolFailureAlertHtml } from './tool-failure-email';

describe('renderToolFailureAlertHtml', () => {
  it('renders alert details, all tools, and escapes provider text', () => {
    const html = renderToolFailureAlertHtml({
      periodStart: '2026-09-06T07:00:00.000Z',
      periodEnd: '2026-09-07T07:00:00.000Z',
      tools: [
        {
          toolName: 'Kiwi <MCP>',
          calls: 3,
          failed: 3,
          failureRate: 1,
          topErrors: [{ error: 'timeout <upstream>', count: 2 }],
        },
        {
          toolName: 'Trivago',
          calls: 4,
          failed: 1,
          failureRate: 0.25,
          topErrors: [{ error: 'internal', count: 1 }],
        },
      ],
      alerting: [
        {
          toolName: 'Kiwi <MCP>',
          calls: 3,
          failed: 3,
          failureRate: 1,
          topErrors: [{ error: 'timeout <upstream>', count: 2 }],
        },
      ],
    });

    assert.match(html, /Werkzeug-Ausfall/);
    assert.match(html, /3\/3/);
    assert.match(html, /timeout &lt;upstream&gt; \(2×\)/);
    assert.match(html, /Trivago/);
    assert.match(html, /25 %/);
    assert.doesNotMatch(html, /Kiwi <MCP>/);
  });
});
