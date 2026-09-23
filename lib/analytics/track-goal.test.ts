import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DATAFAST_QUEUE_SNIPPET, trackGoal, type DataFastHost } from './track-goal';

type QueuedHost = DataFastHost & { datafast?: DataFastHost['datafast'] & { q?: unknown[][] } };

function installQueue(host: QueuedHost): void {
  new Function('window', DATAFAST_QUEUE_SNIPPET)(host);
}

test('trackGoal calls the loaded DataFast script with goal and params', () => {
  const calls: unknown[][] = [];
  const host: DataFastHost = { datafast: (...args) => calls.push(args) };

  trackGoal('affiliate_click', { destination: 'BKK', source: 'travelpayouts', kind: 'cash' }, host);

  assert.deepEqual(calls, [['affiliate_click', { destination: 'BKK', source: 'travelpayouts', kind: 'cash' }]]);
});

test('trackGoal lands in the queue before the script has loaded', () => {
  const host: QueuedHost = {};
  installQueue(host);

  trackGoal('deal_view', { destination: 'LIS', source: 'seats_aero', kind: 'award' }, host);
  trackGoal('model_selected', { model: 'mylo-default' }, host);

  const queued = (host.datafast?.q ?? []).map((args) => Array.from(args));
  assert.deepEqual(queued, [
    ['deal_view', { destination: 'LIS', source: 'seats_aero', kind: 'award' }],
    ['model_selected', { model: 'mylo-default' }],
  ]);
});

test('queue snippet keeps an already loaded script', () => {
  const loaded: DataFastHost['datafast'] = () => undefined;
  const host: QueuedHost = { datafast: loaded };

  installQueue(host);

  assert.equal(host.datafast, loaded);
});

test('trackGoal is a no-op without script, queue or window', () => {
  assert.doesNotThrow(() => trackGoal('deal_expand', { destination: 'ATH', source: 'seats_aero', kind: 'award' }, {}));
  assert.doesNotThrow(() => trackGoal('deal_expand', { destination: 'ATH', source: 'seats_aero', kind: 'award' }));
});
