import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

/**
 * Vercel Cron invokes every path in vercel.json with GET. A route that only
 * exports POST answers 405 and silently never runs — this happened to
 * awardwallet-sync (MYLO-39) and to three more routes (MYLO-41).
 */
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const vercelConfig = JSON.parse(readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8')) as {
  crons: Array<{ path: string; schedule: string }>;
};

const GET_EXPORT = /export\s+(?:async\s+)?function\s+GET\b|export\s+const\s+GET\b|export\s*\{[^}]*\bGET\b/;

describe('vercel.json cron routes', () => {
  assert.ok(vercelConfig.crons.length > 0, 'vercel.json declares at least one cron');

  for (const cron of vercelConfig.crons) {
    it(`${cron.path} exports a GET handler for Vercel Cron`, () => {
      const routeFile = path.join(repoRoot, 'app', cron.path, 'route.ts');
      assert.ok(existsSync(routeFile), `route file missing: ${routeFile}`);

      const source = readFileSync(routeFile, 'utf8');
      assert.match(source, GET_EXPORT, `${cron.path} must export GET — Vercel Cron calls GET, not POST`);
    });
  }
});
