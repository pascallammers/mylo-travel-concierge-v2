# borski ↔ MYLO Cross-Check

**Date:** 2026-04-27
**borski commit:** `62356aa48a02695f8cf5649c5a0a7259b576a120` (`main` @ 2026-04-26)
**borski `transfer-partners.json` last_updated:** 2026-04-06
**MYLO Lane B (`lib/config/transfer-engine/`):** committed 2026-04-27 (post-Codex-fixes)

This document compares MYLO's transfer-engine ratios against borski's `data/transfer-partners.json`. Treat borski as a **Cross-Validator**, not as ground truth — borski is one independent source. Any discrepancy below is a **flag for re-verification**, not an automatic rollback signal.

Re-run with: `npx tsx lib/data/borski-toolkit-adapter/_scripts/cross-check.mts`

## DACH Region — out of scope for borski

borski has **no DACH-specific transfer ratios**. The `amex_mr` issuer in borski is **US Amex MR**, where the standard ratio is 1:1. DACH Amex MR (Germany) has fundamentally different ratios (5:4 for most airlines; 3:2 / 2:1 for several after the August 2025 devaluations). MYLO's `lib/config/transfer-engine/dach.ts` remains the sole source of truth for DACH.

**Decision:** No cross-validation possible for DACH. Schedule a manual quarterly re-verification against `americanexpress.com/de-de/rewards/membership-rewards/travel/all`.

## US Region — discrepancies

### US Amex MR — 2 diffs

| Partner | MYLO ratio | borski ratio | Severity | Action |
|---|---|---|---|---|
| **Aeromexico Club Premier** | 1.600 (5:8) | 1.000 (1:1) | 🔴 high | Re-verify. Lane B's Codex-fix changed this from 1:1 → 5:8 citing Points411 / AwardWallet. borski's source is `americanexpress.com/en-us/rewards/membership-rewards/transfer`. Either Codex over-corrected, or borski is stale. Check the live Amex transfer page directly. |
| **Emirates Skywards** | 1.000 (1:1) | 0.800 (5:4) | 🟡 medium | Re-verify. borski says US Amex transfers to Emirates at 5:4 (you lose 20%); MYLO has 1:1. Likely an Amex devaluation we missed — Emirates devalued globally in Aug 2025. Check live page. |

### US Chase UR — 0 diffs ✓

All 13 partners match borski exactly.

### US Bilt — 0 diffs ✓

All 25 partners match borski exactly. Confirms Lane B's Codex-fix on `minTransfer` (2,000 default) does not contradict borski's data, since borski doesn't model `minTransfer`.

### US Capital One — 2 diffs + 1 missing

| Partner | MYLO ratio | borski ratio | Severity | Action |
|---|---|---|---|---|
| **Emirates Skywards** | 1.000 | 0.750 (4:3) | 🟡 medium | Same Emirates pattern as Amex. Re-verify against `capitalone.com/credit-cards/benefits/travel-transfer-partners/`. |
| **I Prefer (Preferred Hotels)** | 2.000 (1:2) | 1.000 (1:1) | 🟡 medium | MYLO claims Capital One → I Prefer at 1:2 (1000 miles → 2000 points). borski says 1:1. Worth checking — 1:2 is an unusually generous ratio that should have a documentation trail. |
| **JetBlue TrueBlue** | — (missing) | 0.600 (5:3) | 🟢 low | borski lists JetBlue under Capital One at 5:3 ratio (you lose 40%). MYLO's `us-capital-one.ts` does not include JetBlue. Add if confirmed; not a blocker. |

### US Citi TY — 2 diffs

| Partner | MYLO ratio | borski ratio | Severity | Action |
|---|---|---|---|---|
| **Choice Privileges** | 1.500 (2:3) | 2.000 (1:2) | 🟡 medium | borski says Citi → Choice at 1:2 (every 1000 TY = 2000 Choice points). MYLO has 2:3 (less generous). Choice ran 1:2 promotional rates historically — confirm whether this is the standard or a promo. |
| **I Prefer Hotel Rewards** | 2.000 (1:2) | 4.000 (1:4) | 🟢 low | borski has Citi → I Prefer at 1:4 (extremely generous). MYLO at 1:2. Both unusually high; verify the live Citi transfer page. |

## Severity heuristic

- 🔴 **high** — directly contradicts a recent Lane B fix (Aeromexico). Could mean the fix was wrong, or borski is stale. Verify before next ship.
- 🟡 **medium** — non-trivial economic impact (>10% miles delta or matters at common transfer sizes). Verify within 2 weeks.
- 🟢 **low** — small economic impact or low transaction volume. Backlog.

## DACH Sweet-Spot Coverage

borski's `data/sweet-spots.json` ships **13 flight sweet spots**. Below: how relevant each is for MYLO's DACH-origin users.

| Sweet Spot | Tier | Program | Routes | DACH-Origin Use |
|---|---|---|---|---|
| ANA First via Virgin Atlantic | legendary | VA Flying Club | `europe_to_japan` | ✅ **direct** |
| ANA Business via Virgin Atlantic | excellent | VA Flying Club | `us_*_to_japan`, `hawaii_to_japan` | ⚠️ partial (no EU route in this entry) |
| ANA Business via Avianca LifeMiles | excellent | Avianca LM | `us_to_japan`, `japan_to_australia` | ❌ no EU route |
| Iberia Business to Madrid | excellent | Iberia Plus (Avios) | `us_east_to_madrid_*` | ❌ inverse (DACH→USA Iberia is a known cheap Avios route, not in borski) |
| Qatar Qsuites via Privilege Club | excellent | Qatar PC (Avios) | `us_to_qatar_*` | ❌ US-anchored, but Avios family is DACH-bookable for own routings |
| Turkish to Turkey | good | Turkish M&S | `us_to_turkey_*`, `us_to_europe_zone1/2` | ❌ US-origin |
| United Transcon Polaris via Turkish M&S | good | Turkish M&S | `us_transcon_*` | ❌ US domestic |
| Korean Air RT to Europe | good | Korean SKYPASS | `us_to_europe_*` | ❌ US-origin (SkyTeam) |
| Virgin Atlantic Economy to London | excellent | VA Flying Club | `us_east_to_london`, `us_west_to_london` | ❌ US-origin |
| Flying Blue Promo to Europe | good | AF-KLM Flying Blue | `us_to_europe_*` | ⚠️ Flying Blue Promo Awards are global — DACH users see different promos monthly. Useful as **mechanism reference**, not as static data. |
| Aeroplan Business to Europe | good | Aeroplan | `us_*_to_europe` | ❌ US-origin |
| Emirates Business via Skywards | good | Emirates Skywards | `us_to_europe_via_dxb` | ❌ US-origin |
| Emirates Partner Awards (March 2026 chart) | excellent | Emirates Skywards | `short/medium/long_haul_partner` | ✅ **direct** — partner chart is route-agnostic, applies from DACH |

**Verdict:** Of 13 sweet spots, only **2 are directly DACH-origin-actionable** (ANA F via VA, Emirates Partner Chart). 4 more are **mechanism references** (Avios family routings, Flying Blue promos). The rest are US-origin.

**Implication for Phase-0 Plan-Assignment-3:** The DACH-Sweet-Spots-Voice-Memo-Plan with the partner is **NOT obsolete**. borski covers maybe 15–20% of what a DACH-origin user needs. Sweet spots specifically missing in borski:

- LH First via Aeroplan (DACH→US, single most asked Mylo Sweet Spot)
- Eurowings BIZ Class via Miles & More (DACH-internal)
- Avios Short-Haul EU (DUS→LON, FRA→MAD with BA/Iberia)
- Flying Blue Promo to Europe-internal (FRA→AMS→ICN type routings)
- ANA First via Lufthansa M&M (different mileage cost than Virgin Atlantic route)
- Qatar Qsuites DACH→Asia (different points cost than US route in borski)

**Recommendation:** Keep the voice-memo plan; use borski's sweet-spots structure as schema reference, write own DACH-zentric data.

## Action items (do not auto-apply)

These should become TODOs or commits, **not** schema-driven auto-corrections:

1. **🔴 Verify US Amex MR → Aeromexico ratio** on live Amex transfer page. If borski (1:1) is correct, revert Lane B's Codex-fix; if MYLO (5:8) is correct, file an upstream issue at borski.
2. **🟡 Verify Emirates Skywards ratios** for US Amex MR, US Capital One. Likely a global Aug-2025 devaluation MYLO missed.
3. **🟡 Verify Capital One → I Prefer (1:2 vs 1:1)** and Citi → I Prefer (1:2 vs 1:4) discrepancies.
4. **🟡 Verify Citi → Choice (2:3 vs 1:2)** — could be a misread of a promo period.
5. **🟢 Add JetBlue to US Capital One** if Capital-One→JetBlue at 5:3 confirms.
6. **DACH-Sweet-Spots voice-memo** stays in scope. borski provides structural reference only.

## Maintenance

borski's `transfer-partners.json` has `last_updated: 2026-04-06`. Re-run this cross-check after every borski submodule update and after each Lane B data change. Diff against the previous report; new discrepancies likely indicate one side updated without the other catching up.
