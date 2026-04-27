# borski-toolkit Adapter

Type-safe, zod-validated read access to the [`borski/travel-hacking-toolkit`](https://github.com/borski/travel-hacking-toolkit) data files.

The toolkit ships as a **git submodule** under `lib/data/borski-toolkit/`. This adapter exposes pure-function loaders that read, validate, and cache the JSON.

## Usage

```ts
import { loadTransferPartners, loadSweetSpots, loadPointsValuations } from '@/lib/data/borski-toolkit-adapter';

const transfers = loadTransferPartners();
const amexMr = transfers.amex_mr; // typed: BorskiTransferIssuer

const sweetSpots = loadSweetSpots();
for (const flight of sweetSpots.flights) {
  console.log(flight.name, flight.tier, flight.routes);
}

const valuations = loadPointsValuations();
const amex = valuations.credit_card_points.amex_membership_rewards;
console.log(amex.floor, amex.ceiling); // floor/ceiling cpp
```

All loaders cache the parsed result. Call `resetBorskiCaches()` to force a re-read.

## Available loaders

| Function | File | Purpose |
|---|---|---|
| `loadTransferPartners()` | `transfer-partners.json` | US issuer → airline/hotel transfer ratios |
| `loadSweetSpots()` | `sweet-spots.json` | High-CPP flight + hotel redemptions, booking windows, surcharge guide |
| `loadPointsValuations()` | `points-valuations.json` | Floor/ceiling cpp valuations across TPG, UpgradedPoints, OneMileAtATime, ViewFromTheWing |
| `loadAlliances()` | `alliances.json` | Star Alliance, Oneworld, SkyTeam membership lists |
| `loadPartnerAwards()` | `partner-awards.json` | Award programs and which airlines each can book |
| `loadHotelChains()` | `hotel-chains.json` | Hotel chain → loyalty program metadata, brand tiers |

## Quarterly sync

borski's data drifts with mileage program devaluations and chart changes. Pull upstream:

```bash
cd lib/data/borski-toolkit
git fetch origin
git checkout origin/main
cd ../../..

# Re-validate against schemas (catches structural drift)
npx tsx --test "lib/data/borski-toolkit-adapter/load-from-borski.test.ts"

# Re-run cross-check (catches data drift vs MYLO Lane B)
npx tsx lib/data/borski-toolkit-adapter/_scripts/cross-check.mts

# Update CROSS-CHECK.md with new findings, then commit
git add lib/data/borski-toolkit
git commit -m "chore(borski-toolkit): sync to upstream <hash>"
```

If schemas fail to validate, the upstream changed shape — update `schemas/*.ts` first.

## Files

```
borski-toolkit-adapter/
  index.ts                       Public barrel
  load-from-borski.ts            Cached loaders
  load-from-borski.test.ts       Drift-detector tests
  schemas/
    index.ts                     Schema barrel
    transfer-partners.ts
    sweet-spots.ts
    points-valuations.ts
    alliances.ts
    partner-awards.ts
    hotel-chains.ts
  _scripts/
    cross-check.mts              Run-once script for borski ↔ Lane B comparison
  CROSS-CHECK.md                 Output report with current discrepancies
  README.md                      This file
```

## Out of scope

- `chase-edit-properties.json`, `fhr-properties.json`, `thc-properties.json` — large hotel property lists, not needed for Phase 1. Add schemas + loaders when the hotel feature lands.
- borski's `skills/` and MCP servers — not redistributed. Selected MCPs may be wrapped as AI-SDK tools in Phase A2 (see `TODOS.md`).
- borski's browser-automation skills (Patchright/Docker) — not portable to MYLO's web architecture.

## Attribution

borski/travel-hacking-toolkit is MIT-licensed by Michael Borohovski. See the project root `LICENSE-THIRD-PARTY.md`.
