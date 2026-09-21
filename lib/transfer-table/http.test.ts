import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleTransferAdminGet, handleTransferAdminPost, handleTransferCron, type AdminDependencies } from './http';
import { TransferConflictError } from './apply';

const id = '00000000-0000-4000-8000-000000000001';
const request = (body: unknown) =>
  new Request('https://mylo.example/api/admin/transfer-table', { method: 'POST', body: JSON.stringify(body) });
function dependencies(): AdminDependencies {
  return {
    isAdmin: async () => true,
    getUserId: async () => 'authenticated-admin',
    loadDashboard: async () => ({ latest: [], held: [] }),
    resolve: async () => {},
  };
}

test('cron rejects missing or incorrect bearer auth before doing work', async () => {
  let called = false;
  const run = async () => {
    called = true;
    return [];
  };
  for (const [header, secret] of [
    [null, 'secret'],
    ['Bearer wrong', 'secret'],
    ['Bearer undefined', undefined],
  ] as const) {
    const response = await handleTransferCron(
      new Request('https://mylo.example', { headers: header ? { authorization: header } : {} }),
      secret,
      run,
    );
    assert.equal(response.status, 401);
  }
  assert.equal(called, false);
  assert.equal(
    (
      await handleTransferCron(
        new Request('https://mylo.example', { headers: { authorization: 'Bearer secret' } }),
        'secret',
        run,
      )
    ).status,
    200,
  );
  assert.equal(called, true);
});

test('cron reports delivery failure and handles storage failure without claiming success', async () => {
  const req = new Request('https://mylo.example', { headers: { authorization: 'Bearer secret' } });
  assert.equal(
    (
      await handleTransferCron(req, 'secret', async () => [
        { sourceProgramId: 'amex_dach', checkId: id, outcome: 'held', changeCount: 1, mailError: 'Fehler' },
      ])
    ).status,
    502,
  );
  assert.equal(
    (
      await handleTransferCron(req, 'secret', async () => {
        throw new Error('db');
      })
    ).status,
    500,
  );
});

test('admin read and write deny non-admins without reading or mutating data', async () => {
  const deps = {
    ...dependencies(),
    isAdmin: async () => false,
    loadDashboard: async () => assert.fail('unauthorized read'),
    resolve: async () => assert.fail('unauthorized mutation'),
  };
  assert.equal((await handleTransferAdminGet(deps)).status, 403);
  assert.equal((await handleTransferAdminPost(request({ checkId: id, resolution: 'approved' }), deps)).status, 403);
});

test('admin resolution validates ID and decision and derives the actor from the session', async () => {
  const calls: unknown[][] = [];
  const deps = {
    ...dependencies(),
    resolve: async (...args: [string, 'approved' | 'rejected', string]) => {
      calls.push(args);
    },
  };
  for (const body of [
    { checkId: 'bad', resolution: 'approved' },
    { checkId: id, resolution: 'invalid' },
    { checkId: id, resolution: 'approved', adminUserId: 'forged' },
  ]) {
    assert.equal((await handleTransferAdminPost(request(body), deps)).status, 400);
  }
  assert.equal((await handleTransferAdminPost(request({ checkId: id, resolution: 'approved' }), deps)).status, 200);
  assert.deepEqual(calls, [[id, 'approved', 'authenticated-admin']]);
  assert.equal(
    (
      await handleTransferAdminPost(request({ checkId: id, resolution: 'approved' }), {
        ...deps,
        getUserId: async () => null,
      })
    ).status,
    403,
  );
});

test('admin API exposes drift conflict and returns no internal error details', async () => {
  const deps = dependencies();
  deps.resolve = async () => {
    throw new TransferConflictError('Werte inzwischen geändert.');
  };
  const response = await handleTransferAdminPost(request({ checkId: id, resolution: 'approved' }), deps);
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /inzwischen geändert/);
  deps.resolve = async () => {
    throw new Error('secret connection info');
  };
  const failed = await handleTransferAdminPost(request({ checkId: id, resolution: 'approved' }), deps);
  assert.equal(failed.status, 500);
  assert.ok(!(await failed.text()).includes('secret'));
  deps.loadDashboard = async () => {
    throw new Error('database');
  };
  assert.equal((await handleTransferAdminGet(deps)).status, 500);
});

test('dashboard marks unknown additions as requiring seed metadata', async () => {
  const deps = dependencies();
  deps.loadDashboard = async () => ({
    latest: [],
    held: [
      {
        id,
        sourceProgramId: 'amex_dach',
        checkedAt: new Date(),
        outcome: 'held',
        error: null,
        resolution: null,
        resolvedAt: null,
        resolvedBy: null,
        changes: [
          {
            type: 'partner_added',
            observation: { sourceName: 'New', sourceCode: 'NEW', sourcePoints: 1, partnerUnits: 1, minTransfer: 100 },
          },
        ],
      },
    ],
  });
  const response = await handleTransferAdminGet(deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).held[0].canApprove, false);
});
