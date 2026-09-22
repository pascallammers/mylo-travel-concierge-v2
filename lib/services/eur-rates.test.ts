import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { fetchEurRates } from './eur-rates';

describe('fetchEurRates', () => {
  it('konvertiert Fremdwaehrungen ueber die ECB-Tagesraten', async () => {
    const fetchImpl = mock.fn(async () =>
      new Response(JSON.stringify({ base: 'EUR', rates: { USD: 1.25 } }), {
        status: 200,
      }),
    );

    const rates = await fetchEurRates(fetchImpl as unknown as typeof fetch);

    assert.equal(fetchImpl.mock.calls.length, 1);
    assert.equal(rates.toEur(100, 'EUR'), 100);
    assert.equal(rates.toEur(125, 'USD'), 100);
    assert.equal(rates.toEur(100, 'JPY'), null);
  });

  it('faellt bei Fetch-Fehlern auf EUR-only zurueck', async () => {
    const warn = mock.method(console, 'warn', () => undefined);
    const fetchImpl = mock.fn(async () => {
      throw new Error('network down');
    });

    const rates = await fetchEurRates(fetchImpl as unknown as typeof fetch);

    assert.equal(rates.toEur(50, 'EUR'), 50);
    assert.equal(rates.toEur(50, 'USD'), null);
    assert.equal(warn.mock.calls.length, 1);
    warn.mock.restore();
  });

  it('faellt bei HTTP-Fehlern auf EUR-only zurueck', async () => {
    const warn = mock.method(console, 'warn', () => undefined);
    const fetchImpl = mock.fn(async () => new Response('nope', { status: 500 }));

    const rates = await fetchEurRates(fetchImpl as unknown as typeof fetch);

    assert.equal(rates.toEur(50, 'USD'), null);
    assert.equal(warn.mock.calls.length, 1);
    warn.mock.restore();
  });
});
