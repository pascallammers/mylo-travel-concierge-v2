import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { EvalFixture } from './fixtures/types';
import { formatReport, type EvalRunResult } from './reporter';

const fx = (id: string, expectedTool: string | null): EvalFixture => ({
  id,
  source: 'edge',
  description: id,
  userQuery: 'q',
  expectedTool,
  reason: 'r',
});

describe('formatReport', () => {
  it('marks all-pass with a checkmark and summary', () => {
    const results: EvalRunResult[] = [
      { fixture: fx('a', 'search_flights'), actualTool: 'search_flights', passed: true, durationMs: 100 },
      { fixture: fx('b', null), actualTool: null, passed: true, durationMs: 200 },
    ];
    const out = formatReport(results, 'grok-4-1-fast-non-reasoning');
    assert.match(out, /2\/2 passed/);
    assert.match(out, /✓ a/);
    assert.match(out, /✓ b/);
    assert.doesNotMatch(out, /Failures:/);
  });

  it('lists failures with user query and reason', () => {
    const results: EvalRunResult[] = [
      {
        fixture: { ...fx('c', 'search_flights'), userQuery: 'Flüge nach Tokyo', reason: 'must route' },
        actualTool: 'web_search',
        passed: false,
        durationMs: 100,
      },
    ];
    const out = formatReport(results, 'grok-4-1-fast-non-reasoning');
    assert.match(out, /0\/1 passed/);
    assert.match(out, /✗ c/);
    assert.match(out, /Failures:/);
    assert.match(out, /Flüge nach Tokyo/);
    assert.match(out, /must route/);
  });

  it('includes the model name in the header', () => {
    const out = formatReport([], 'grok-4.20-0309-non-reasoning');
    assert.match(out, /grok-4\.20-0309-non-reasoning/);
  });

  it('renders error-string when an error was caught', () => {
    const results: EvalRunResult[] = [
      {
        fixture: fx('d', 'search_flights'),
        actualTool: null,
        passed: false,
        durationMs: 0,
        error: 'eval call timeout',
      },
    ];
    const out = formatReport(results, 'm');
    assert.match(out, /eval call timeout/);
  });
});
