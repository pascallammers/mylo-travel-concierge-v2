import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { exportsGetHandler } from './vercel-cron-routes';

/**
 * Vercel Cron invokes every path in vercel.json with GET. A route that only
 * exports POST answers 405 and silently never runs. This happened to
 * awardwallet-sync (MYLO-39) and to three more routes (MYLO-41).
 */
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const vercelConfig = JSON.parse(readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8')) as {
  crons: Array<{ path: string; schedule: string }>;
};

describe('exportsGetHandler', () => {
  it('accepts function, const and re-exported GET handlers', () => {
    assert.equal(exportsGetHandler('export async function GET(req: Request) { return POST(req); }'), true);
    assert.equal(exportsGetHandler('export const GET = handler;'), true);
    assert.equal(exportsGetHandler('export { POST as GET };'), true);
  });

  it('rejects GET that only appears in comments, strings or as an alias source', () => {
    assert.equal(exportsGetHandler('// export async function GET\nexport async function POST() {}'), false);
    assert.equal(exportsGetHandler('const doc = "export function GET";\nexport async function POST() {}'), false);
    assert.equal(exportsGetHandler('export { GET as POST };'), false);
    assert.equal(exportsGetHandler('function GET() {}\nexport async function POST() {}'), false);
  });
});

describe('vercel.json cron routes', () => {
  assert.ok(vercelConfig.crons.length > 0, 'vercel.json declares at least one cron');

  for (const cron of vercelConfig.crons) {
    it(`${cron.path} exports a GET handler for Vercel Cron`, () => {
      const routeFile = path.join(repoRoot, 'app', cron.path, 'route.ts');
      assert.ok(existsSync(routeFile), `route file missing: ${routeFile}`);

      assert.ok(
        exportsGetHandler(readFileSync(routeFile, 'utf8')),
        `${cron.path} must export GET. Vercel Cron calls GET, not POST`,
      );
    });
  }
});
