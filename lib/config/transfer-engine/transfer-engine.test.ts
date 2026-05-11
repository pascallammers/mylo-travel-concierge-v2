import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAmexDachTransferOptions,
  findDachTransferPartner,
  TRANSFER_PARTNERS,
  calculatePartnerMiles,
  calculateRequiredAmexPoints,
  getDachPartnersByEffectiveRate,
  getDachAirlinePartners,
} from './index';

// ============================================
// formatAmexDachTransferOptions: behavior frozen via snapshot
// ============================================

describe('formatAmexDachTransferOptions (snapshot)', () => {
  it('produces stable DE output for 50,000 MR balance', () => {
    const expected = `
### Amex Transfer-Optionen (DACH-Region)
Bei 50.000 Membership Rewards Punkten:
- Flying Blue: 40.000 Meilen (5:4 Ratio)
- British Airways Executive Club: 40.000 Avios (5:4 Ratio)
- Iberia Plus: 40.000 Avios (5:4 Ratio)
- Cathay: 33.333 Miles (3:2 Ratio)
- Singapore Airlines KrisFlyer: 33.333 Meilen (3:2 Ratio)

**WICHTIG**: Diese Ratios gelten für Deutschland/Österreich/Schweiz. USA/UK haben oft bessere 1:1 Ratios.
Emirates (2:1) ist stark abgewertet und nicht empfehlenswert.`;
    assert.equal(formatAmexDachTransferOptions(50000, 'de'), expected);
  });

  it('produces stable EN output for 50,000 MR balance', () => {
    const expected = `
### Amex Transfer Options (DACH Region)
With 50,000 Membership Rewards points:
- Flying Blue: 40,000 Miles (5:4 Ratio)
- British Airways Executive Club: 40,000 Avios (5:4 Ratio)
- Iberia Plus: 40,000 Avios (5:4 Ratio)
- Cathay: 33,333 Miles (3:2 Ratio)
- Singapore Airlines KrisFlyer: 33,333 Miles (3:2 Ratio)

**IMPORTANT**: These ratios apply to Germany/Austria/Switzerland. US/UK often have better 1:1 ratios.
Emirates (2:1) is significantly devalued and not recommended.`;
    assert.equal(formatAmexDachTransferOptions(50000, 'en'), expected);
  });

  it('produces stable DE output for 100,000 MR balance', () => {
    const expected = `
### Amex Transfer-Optionen (DACH-Region)
Bei 100.000 Membership Rewards Punkten:
- Flying Blue: 80.000 Meilen (5:4 Ratio)
- British Airways Executive Club: 80.000 Avios (5:4 Ratio)
- Iberia Plus: 80.000 Avios (5:4 Ratio)
- Cathay: 66.666 Miles (3:2 Ratio)
- Singapore Airlines KrisFlyer: 66.666 Meilen (3:2 Ratio)

**WICHTIG**: Diese Ratios gelten für Deutschland/Österreich/Schweiz. USA/UK haben oft bessere 1:1 Ratios.
Emirates (2:1) ist stark abgewertet und nicht empfehlenswert.`;
    assert.equal(formatAmexDachTransferOptions(100000, 'de'), expected);
  });

  it('returns empty string for zero balance', () => {
    assert.equal(formatAmexDachTransferOptions(0, 'de'), '');
    assert.equal(formatAmexDachTransferOptions(0, 'en'), '');
  });

  it('returns empty string for negative balance', () => {
    assert.equal(formatAmexDachTransferOptions(-100, 'de'), '');
  });
});

// ============================================
// findDachTransferPartner: keyword matching contract
// ============================================

describe('findDachTransferPartner (keyword matching)', () => {
  it('matches Flying Blue variants', () => {
    assert.equal(findDachTransferPartner('Flying Blue')?.name, 'Flying Blue');
    assert.equal(findDachTransferPartner('FLYING BLUE')?.name, 'Flying Blue');
    assert.equal(findDachTransferPartner('flying blue rewards')?.name, 'Flying Blue');
  });

  it('matches Air France and KLM to Flying Blue', () => {
    assert.equal(findDachTransferPartner('Air France')?.name, 'Flying Blue');
    assert.equal(findDachTransferPartner('KLM Frequent Flyer')?.name, 'Flying Blue');
  });

  it('matches British Airways via "executive club" or "avios"', () => {
    assert.equal(findDachTransferPartner('British Airways')?.name, 'British Airways Executive Club');
    assert.equal(findDachTransferPartner('Executive Club')?.name, 'British Airways Executive Club');
    // 'avios' resolves to britishAirways (first matched in keyword order)
    assert.equal(findDachTransferPartner('Avios')?.name, 'British Airways Executive Club');
  });

  it('matches Iberia Plus', () => {
    assert.equal(findDachTransferPartner('Iberia')?.name, 'Iberia Plus');
    assert.equal(findDachTransferPartner('iberia plus')?.name, 'Iberia Plus');
  });

  it('matches SAS via "sas" or "eurobonus"', () => {
    assert.equal(findDachTransferPartner('SAS Eurobonus')?.name, 'SAS EuroBonus');
    assert.equal(findDachTransferPartner('Scandinavian SAS')?.name, 'SAS EuroBonus');
    assert.equal(findDachTransferPartner('eurobonus')?.name, 'SAS EuroBonus');
  });

  it('matches Cathay and Asia Miles', () => {
    assert.equal(findDachTransferPartner('Cathay Pacific')?.name, 'Cathay');
    assert.equal(findDachTransferPartner('Asia Miles')?.name, 'Cathay');
  });

  it('matches Singapore and Krisflyer', () => {
    assert.equal(findDachTransferPartner('Singapore Airlines')?.name, 'Singapore Airlines KrisFlyer');
    assert.equal(findDachTransferPartner('Krisflyer')?.name, 'Singapore Airlines KrisFlyer');
  });

  it('matches Qatar via name or "privilege club"', () => {
    assert.equal(findDachTransferPartner('Qatar Airways')?.name, 'Qatar Airways Privilege Club');
    assert.equal(findDachTransferPartner('privilege club')?.name, 'Qatar Airways Privilege Club');
  });

  it('matches Etihad', () => {
    assert.equal(findDachTransferPartner('Etihad Guest')?.name, 'Etihad Guest');
  });

  it('matches Delta via name or skymiles', () => {
    assert.equal(findDachTransferPartner('Delta Air Lines')?.name, 'Delta SkyMiles');
    assert.equal(findDachTransferPartner('SkyMiles')?.name, 'Delta SkyMiles');
  });

  it('matches Emirates and Skywards', () => {
    assert.equal(findDachTransferPartner('Emirates')?.name, 'Emirates Skywards');
    assert.equal(findDachTransferPartner('Skywards')?.name, 'Emirates Skywards');
  });

  it('matches Hilton and Marriott and Radisson', () => {
    assert.equal(findDachTransferPartner('Hilton Honors')?.name, 'Hilton Honors');
    assert.equal(findDachTransferPartner('Marriott Bonvoy')?.name, 'Marriott Bonvoy');
    assert.equal(findDachTransferPartner('Bonvoy')?.name, 'Marriott Bonvoy');
    assert.equal(findDachTransferPartner('Radisson Rewards')?.name, 'Radisson Rewards');
  });

  it('returns null for unknown providers', () => {
    assert.equal(findDachTransferPartner('United MileagePlus'), null);
    assert.equal(findDachTransferPartner(''), null);
    assert.equal(findDachTransferPartner('xyz unknown program'), null);
  });
});

// ============================================
// TRANSFER_PARTNERS shape contract
// ============================================

describe('TRANSFER_PARTNERS top-level shape', () => {
  it('has dach and us regions', () => {
    assert.ok(TRANSFER_PARTNERS.dach);
    assert.ok(TRANSFER_PARTNERS.us);
  });

  it('dach contains amex source program with the 14 known partners', () => {
    const dachAmex = TRANSFER_PARTNERS.dach.amex;
    assert.ok(dachAmex);
    assert.equal(Object.keys(dachAmex).length, 14);
    assert.ok(dachAmex.flyingBlue);
    assert.ok(dachAmex.emiratesSkywards);
    assert.ok(dachAmex.payback);
  });

  it('us contains all 5 source programs', () => {
    const us = TRANSFER_PARTNERS.us;
    assert.ok(us.chase, 'us.chase missing');
    assert.ok(us.amex, 'us.amex missing');
    assert.ok(us.bilt, 'us.bilt missing');
    assert.ok(us.capitalOne, 'us.capitalOne missing');
    assert.ok(us.citi, 'us.citi missing');
  });

  it('us programs include core 1:1 airline partners (smoke)', () => {
    // Chase: United, Hyatt, Flying Blue
    assert.ok(TRANSFER_PARTNERS.us.chase.unitedMileagePlus);
    assert.ok(TRANSFER_PARTNERS.us.chase.hyatt);
    assert.ok(TRANSFER_PARTNERS.us.chase.flyingBlue);

    // Bilt: Alaska/Atmos, Hyatt, Hilton at 1:1
    assert.ok(TRANSFER_PARTNERS.us.bilt.atmos);
    assert.ok(TRANSFER_PARTNERS.us.bilt.hyatt);
    assert.ok(TRANSFER_PARTNERS.us.bilt.hilton);

    // Capital One: Avianca, Aeroplan, Wyndham
    assert.ok(TRANSFER_PARTNERS.us.capitalOne.aviancaLifeMiles);
    assert.ok(TRANSFER_PARTNERS.us.capitalOne.airCanadaAeroplan);
    assert.ok(TRANSFER_PARTNERS.us.capitalOne.wyndham);

    // Citi: American AAdvantage (Citi-exclusive), Cathay
    assert.ok(TRANSFER_PARTNERS.us.citi.americanAirlines);
    assert.ok(TRANSFER_PARTNERS.us.citi.cathay);
  });

  it('every us partner has consistent ratio math', () => {
    for (const [progKey, partners] of Object.entries(TRANSFER_PARTNERS.us)) {
      for (const [pid, p] of Object.entries(partners)) {
        const expected = (p.partnerMiles / p.amexPoints) * 100;
        assert.ok(
          Math.abs(p.effectiveRate - expected) < 0.1,
          `us.${progKey}.${pid}: effectiveRate ${p.effectiveRate} should match ${expected.toFixed(1)}%`
        );
      }
    }
  });

  it('every us partner has both de and en localized fields', () => {
    for (const [progKey, partners] of Object.entries(TRANSFER_PARTNERS.us)) {
      for (const [pid, p] of Object.entries(partners)) {
        assert.ok(p.transferDuration.de && p.transferDuration.en, `us.${progKey}.${pid}: missing localized duration`);
        assert.ok(p.currencyUnit.de && p.currencyUnit.en, `us.${progKey}.${pid}: missing localized currency`);
      }
    }
  });
});

// ============================================
// Backward compat: AMEX_TRANSFER_PARTNERS_DACH still works
// ============================================

describe('Backward compatibility re-exports', () => {
  it('calculatePartnerMiles still works for DACH amex partners', () => {
    assert.equal(calculatePartnerMiles('flyingBlue', 50000), 40000);
    assert.equal(calculatePartnerMiles('emiratesSkywards', 10000), 5000);
    assert.equal(calculatePartnerMiles('nonexistent', 1000), null);
  });

  it('calculateRequiredAmexPoints still works for DACH amex partners', () => {
    assert.equal(calculateRequiredAmexPoints('flyingBlue', 80000), 100000);
    assert.equal(calculateRequiredAmexPoints('nonexistent', 1000), null);
  });

  it('getDachPartnersByEffectiveRate sorted descending', () => {
    const sorted = getDachPartnersByEffectiveRate();
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i - 1].effectiveRate >= sorted[i].effectiveRate);
    }
  });

  it('getDachAirlinePartners returns only airlines', () => {
    const airlines = getDachAirlinePartners();
    for (const p of airlines) {
      assert.equal(p.type, 'airline');
    }
  });
});
