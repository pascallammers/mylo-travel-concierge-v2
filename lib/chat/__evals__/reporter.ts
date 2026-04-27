import type { EvalFixture } from './fixtures/types';

export type EvalRunResult = {
  fixture: EvalFixture;
  actualTool: string | null;
  passed: boolean;
  durationMs: number;
  error?: string;
};

export function formatReport(results: EvalRunResult[], modelName: string): string {
  const lines: string[] = [];
  lines.push(`MYLO Routing Eval — model=${modelName}`);
  lines.push('');

  for (const r of results) {
    const mark = r.passed ? '✓' : '✗';
    const expected = r.fixture.expectedTool ?? 'null';
    const actual = r.actualTool ?? 'null';
    lines.push(
      `${mark} ${r.fixture.id.padEnd(36)} expected=${expected.padEnd(24)} actual=${actual}` +
        (r.passed ? '' : '          ← FAIL'),
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  const pct = total === 0 ? '0.0' : ((passed / total) * 100).toFixed(1);
  lines.push('');
  lines.push(`${passed}/${total} passed (${pct}%)  •  duration ${(totalMs / 1000).toFixed(1)}s`);

  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    lines.push('');
    lines.push('Failures:');
    for (const f of failures) {
      lines.push(`  ${f.fixture.id}`);
      lines.push(`    User: "${f.fixture.userQuery}"`);
      lines.push(`    Expected: ${f.fixture.expectedTool ?? 'null'}`);
      lines.push(`    Actual:   ${f.actualTool ?? 'null'}`);
      lines.push(`    Reason:   ${f.fixture.reason}`);
      if (f.error) lines.push(`    Error:    ${f.error}`);
    }
  }

  return lines.join('\n');
}
