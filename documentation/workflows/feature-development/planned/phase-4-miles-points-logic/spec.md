# Phase 4: Miles & Points Logic

> ### 📍 Current Status: `PLANNED`
> **Location:** `/planned/phase-4-miles-points-logic/`
> **Last Updated:** 2025-01-29

**Priority:** 🟡 Medium-High
**Estimated Effort:** Large (4-6 days)
**Prerequisites:** 
- ✅ Phase 1, 2, 3 completed
- ⚠️  Loyalty Program Data (Redemption Charts)

## Overview
Implementierung der Kern-Logik für Meilen & Punkte Optimierung: Rechner für Redemption Values, Transfer Partner Empfehlungen, Sweet Spots Finder, und Best Practices für Award Buchungen. Dies ist das "Gehirn" des Travel Concierge.

**Hauptfeature:** Intelligent Miles & Points Optimization Engine

## Problem Statement
**User Pain Points:**
- "Welches Loyalty Program soll ich für diese Route nutzen?"
- "Ist es besser bar zu zahlen oder Meilen einzulösen?"
- "Wohin kann ich meine Credit Card Points transferieren?"
- "Was sind Sweet Spots für Business Class nach Asien?"
- "Lohnt sich ein Upgrade mit Meilen?"

**Current Situation:**
- User muss selbst recherchieren
- Komplexe Transfer Charts manuell prüfen
- Redemption Values schwer zu vergleichen
- Sweet Spots nur durch Community Wissen

**Desired State:**
- AI kalkuliert automatisch Redemption Values
- Empfiehlt beste Loyalty Programs für Route
- Identifiziert Transfer Opportunities
- Kennt Sweet Spots und gibt Tipps

## Technical Design

### Core Components

1. **Redemption Value Calculator**
   - Input: Cash price, Miles required, Taxes/Fees
   - Output: Cents per mile/point value
   - Benchmark gegen Standard Values (Economy ~1¢, Business ~1.5-2¢, First ~2+¢)

2. **Transfer Partner Optimizer**
   - Input: User's credit card points, Desired route
   - Output: Best transfer partners, Ratios, Total miles needed
   - Database: Transfer Partner relationships (Amex → Aeroplan, Chase → United, etc.)

3. **Sweet Spots Database**
   - Static data: Known good redemptions
   - Examples: "Aeroplan to Asia in Business = 75k one-way", "Avianca LifeMiles Europe = 63k"
   - Queryable by region, cabin class, program

4. **Routing Rules Engine**
   - Alliance rules (oneWorld, Star Alliance, SkyTeam)
   - Stopover rules
   - Open-jaw possibilities
   - Mixed-cabin strategies

### Architecture

```
User Query
    ↓
AI Context Understanding
    ↓
    ├─→ Redemption Calculator
    ├─→ Transfer Optimizer
    ├─→ Sweet Spots Lookup
    └─→ Routing Suggestions
    ↓
Combined Recommendation
    ↓
Display with Explanation
```

### File Structure

```
lib/
├── miles-points/
│   ├── calculator.ts           # Redemption value calculations
│   ├── transfer-partners.ts    # Transfer partner logic
│   ├── sweet-spots.ts          # Sweet spots database
│   ├── routing-rules.ts        # Alliance and routing logic
│   ├── data/
│   │   ├── loyalty-programs.json
│   │   ├── transfer-partners.json
│   │   ├── sweet-spots.json
│   │   └── redemption-charts.json
│   └── types.ts
│
├── tools/
│   ├── miles-calculator.ts     # Tool for calculations
│   ├── transfer-optimizer.ts   # Tool for transfers
│   └── sweet-spots-finder.ts   # Tool for sweet spots
│
components/
└── miles-analysis.tsx          # Display component
```

### Data Structures

#### Loyalty Programs Data

**File:** `lib/miles-points/data/loyalty-programs.json`

```json
{
  "programs": [
    {
      "id": "aeroplan",
      "name": "Aeroplan",
      "airline": "Air Canada",
      "alliance": "Star Alliance",
      "currency": "Aeroplan Points",
      "expirationPolicy": "18 months of inactivity",
      "transferPartners": [
        {
          "name": "American Express Membership Rewards",
          "ratio": "1:1",
          "transferTime": "instant"
        },
        {
          "name": "Chase Ultimate Rewards",
          "ratio": "1:1",
          "transferTime": "instant"
        }
      ],
      "redemptionChart": {
        "type": "dynamic",
        "baseRates": {
          "northAmerica": {
            "shortHaul": { "economy": 6000, "business": 12500, "first": null },
            "longHaul": { "economy": 12500, "business": 25000, "first": null }
          },
          "transatlantic": {
            "economy": 60000,
            "premiumEconomy": 70000,
            "business": 75000,
            "first": null
          },
          "transpacific": {
            "economy": 75000,
            "premiumEconomy": 90000,
            "business": 90000,
            "first": 120000
          }
        }
      }
    },
    {
      "id": "avianca-lifemiles",
      "name": "Avianca LifeMiles",
      "airline": "Avianca",
      "alliance": "Star Alliance",
      "currency": "LifeMiles",
      "transferPartners": [
        {
          "name": "Citi ThankYou Points",
          "ratio": "1:1",
          "transferTime": "immediate"
        }
      ],
      "redemptionChart": {
        "type": "fixed",
        "rates": {
          "northAmerica-europe": {
            "business": 63000,
            "first": 87000
          },
          "northAmerica-asia": {
            "business": 78000,
            "first": 110000
          }
        },
        "notes": "No fuel surcharges on most partners"
      }
    }
  ]
}
```

#### Transfer Partners Data

**File:** `lib/miles-points/data/transfer-partners.json`

```json
{
  "creditCards": [
    {
      "id": "amex-mr",
      "name": "American Express Membership Rewards",
      "partners": [
        { "program": "aeroplan", "ratio": "1:1", "bonuses": [] },
        { "program": "avianca-lifemiles", "ratio": "1:1", "bonuses": ["Occasional 20% bonus"] },
        { "program": "flying-blue", "ratio": "1:1", "bonuses": ["Occasional 25% bonus"] },
        { "program": "virgin-atlantic", "ratio": "1:1", "bonuses": ["Occasional 30% bonus"] }
      ]
    },
    {
      "id": "chase-ur",
      "name": "Chase Ultimate Rewards",
      "partners": [
        { "program": "united-mileageplus", "ratio": "1:1", "bonuses": [] },
        { "program": "southwest-rapid-rewards", "ratio": "1:1", "bonuses": [] },
        { "program": "virgin-atlantic", "ratio": "1:1", "bonuses": [] },
        { "program": "air-france-klm", "ratio": "1:1", "bonuses": [] }
      ]
    }
  ]
}
```

#### Sweet Spots Data

**File:** `lib/miles-points/data/sweet-spots.json`

```json
{
  "sweetSpots": [
    {
      "id": "aeroplan-asia-biz",
      "program": "aeroplan",
      "route": {
        "from": "North America",
        "to": "Asia",
        "regions": ["NorthAmerica", "Asia"]
      },
      "cabin": "business",
      "milesRequired": 75000,
      "direction": "one-way",
      "value": "excellent",
      "notes": "Great for long-haul Asia trips. Works on ANA, EVA, Asiana.",
      "highlights": [
        "75k one-way vs 90k+ on other programs",
        "1 stopover allowed",
        "Low carrier surcharges on most partners"
      ],
      "bestAirlines": ["ANA", "EVA Air", "Asiana"],
      "exampleRoutes": ["YYZ-NRT", "YVR-TPE", "ORD-ICN"]
    },
    {
      "id": "lifemiles-europe-biz",
      "program": "avianca-lifemiles",
      "route": {
        "from": "North America",
        "to": "Europe"
      },
      "cabin": "business",
      "milesRequired": 63000,
      "direction": "one-way",
      "value": "excellent",
      "notes": "Best deal for Transatlantic business class",
      "highlights": [
        "63k one-way vs 75k+ elsewhere",
        "No fuel surcharges on most Star Alliance partners",
        "Frequent transfer bonuses from Amex"
      ],
      "bestAirlines": ["Lufthansa", "Swiss", "Austrian", "Brussels Airlines"],
      "exampleRoutes": ["JFK-FRA", "EWR-ZRH", "ORD-MUC"]
    }
  ]
}
```

### Implementation Details

#### 1. Redemption Calculator Tool

**File:** `lib/tools/miles-calculator.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const milesCalculatorTool = tool({
  description: `Calculate the value of a miles/points redemption.
  Use when user wants to know:
  - If an award redemption is worth it
  - Cents per mile/point value
  - Comparison against cash price
  
  Standard benchmarks:
  - Economy: 1-1.3¢ per mile = good
  - Premium Economy: 1.3-1.5¢ = good
  - Business: 1.5-2¢ = good
  - First: 2+¢ = good`,
  
  inputSchema: z.object({
    cashPrice: z.number().describe('Cash price of the ticket in USD'),
    milesRequired: z.number().describe('Miles/points needed for award ticket'),
    taxesAndFees: z.number().describe('Taxes and fees for award booking in USD'),
    cabin: z.enum(['economy', 'premium_economy', 'business', 'first']),
  }),
  
  execute: async ({ cashPrice, milesRequired, taxesAndFees, cabin }) => {
    // Calculate cents per mile
    const netValue = cashPrice - taxesAndFees;
    const centsPerMile = (netValue / milesRequired) * 100;
    
    // Benchmarks
    const benchmarks = {
      economy: { min: 1.0, good: 1.3 },
      premium_economy: { min: 1.3, good: 1.5 },
      business: { min: 1.5, good: 2.0 },
      first: { min: 2.0, good: 2.5 },
    };
    
    const benchmark = benchmarks[cabin];
    
    // Determine rating
    let rating: 'poor' | 'fair' | 'good' | 'excellent';
    let recommendation: string;
    
    if (centsPerMile < benchmark.min) {
      rating = 'poor';
      recommendation = '❌ Not worth it - consider paying cash';
    } else if (centsPerMile < benchmark.good) {
      rating = 'fair';
      recommendation = '⚠️  Acceptable but not great value';
    } else if (centsPerMile < benchmark.good * 1.5) {
      rating = 'good';
      recommendation = '✅ Good redemption - worth using miles';
    } else {
      rating = 'excellent';
      recommendation = '🌟 Excellent value - definitely use miles!';
    }
    
    // Calculate savings
    const savings = netValue;
    const effectiveDiscount = (savings / cashPrice) * 100;
    
    return {
      value: {
        centsPerMile: parseFloat(centsPerMile.toFixed(2)),
        rating,
        recommendation,
      },
      breakdown: {
        cashPrice,
        milesRequired,
        taxesAndFees,
        netValue,
        savings,
        effectiveDiscount: parseFloat(effectiveDiscount.toFixed(1)),
      },
      benchmark: {
        cabin,
        minValue: benchmark.min,
        goodValue: benchmark.good,
        yourValue: parseFloat(centsPerMile.toFixed(2)),
      },
      advice: generateAdvice(centsPerMile, cabin, benchmark),
    };
  },
});

function generateAdvice(cpp: number, cabin: string, benchmark: any): string[] {
  const advice: string[] = [];
  
  if (cpp < benchmark.min) {
    advice.push('Consider checking nearby dates for better availability');
    advice.push('Look for sweet spot redemptions on other programs');
    advice.push('Cash price might be better - earn miles instead');
  } else if (cpp >= benchmark.good) {
    advice.push('This is a strong redemption - book if dates work');
    advice.push('Premium cabins typically offer best value per mile');
    if (cabin === 'business' || cabin === 'first') {
      advice.push('Great use of miles for premium cabin experience');
    }
  }
  
  return advice;
}
```

#### 2. Transfer Optimizer Tool

**File:** `lib/tools/transfer-optimizer.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import transferPartnersData from '@/lib/miles-points/data/transfer-partners.json';
import loyaltyProgramsData from '@/lib/miles-points/data/loyalty-programs.json';

export const transferOptimizerTool = tool({
  description: `Find the best way to transfer credit card points to loyalty programs.
  Use when user has:
  - Credit card points (Amex MR, Chase UR, Citi ThankYou)
  - Wants to book specific flight
  - Needs transfer recommendations`,
  
  inputSchema: z.object({
    points: z.object({
      amex: z.number().optional().describe('Amex Membership Rewards points'),
      chase: z.number().optional().describe('Chase Ultimate Rewards points'),
      citi: z.number().optional().describe('Citi ThankYou points'),
    }),
    targetProgram: z.string().optional().describe('Specific loyalty program desired'),
    route: z.object({
      from: z.string().describe('Origin region/airport'),
      to: z.string().describe('Destination region/airport'),
    }),
    cabin: z.enum(['economy', 'business', 'first']),
  }),
  
  execute: async ({ points, targetProgram, route, cabin }) => {
    const recommendations: any[] = [];
    
    // Find applicable loyalty programs
    const programs = loyaltyProgramsData.programs;
    
    // For each program, check if user can transfer points
    for (const program of programs) {
      // Check if this program serves the route
      const milesNeeded = estimateMilesNeeded(route, cabin, program);
      if (!milesNeeded) continue;
      
      // Check transfer options
      for (const [cardType, pointBalance] of Object.entries(points)) {
        if (!pointBalance) continue;
        
        const transferOption = findTransferOption(cardType, program.id);
        if (!transferOption) continue;
        
        const pointsNeeded = milesNeeded / parseFloat(transferOption.ratio.split(':')[1]);
        
        if (pointBalance >= pointsNeeded) {
          recommendations.push({
            program: program.name,
            programId: program.id,
            milesNeeded,
            transferFrom: cardType,
            pointsNeeded: Math.ceil(pointsNeeded),
            pointsRemaining: pointBalance - pointsNeeded,
            transferRatio: transferOption.ratio,
            transferTime: transferOption.transferTime,
            bonuses: transferOption.bonuses,
            ranking: calculateRanking(program, milesNeeded, cabin),
          });
        }
      }
    }
    
    // Sort by ranking
    recommendations.sort((a, b) => b.ranking - a.ranking);
    
    return {
      success: true,
      userPoints: points,
      route,
      cabin,
      recommendations: recommendations.slice(0, 5), // Top 5
      summary: generateTransferSummary(recommendations),
    };
  },
});

function estimateMilesNeeded(route: any, cabin: string, program: any): number | null {
  // Simplified - real implementation would use redemption charts
  // This would lookup from loyalty-programs.json redemption charts
  
  // Example logic:
  if (program.id === 'aeroplan') {
    if (route.from.includes('North') && route.to.includes('Asia')) {
      return cabin === 'business' ? 75000 : cabin === 'economy' ? 75000 : 120000;
    }
  }
  
  // Default estimates (to be replaced with actual chart lookup)
  const defaults = {
    economy: 60000,
    business: 80000,
    first: 120000,
  };
  
  return defaults[cabin as keyof typeof defaults];
}

function findTransferOption(cardType: string, programId: string): any {
  const cardMap: Record<string, string> = {
    amex: 'amex-mr',
    chase: 'chase-ur',
    citi: 'citi-thankyou',
  };
  
  const card = transferPartnersData.creditCards.find(c => c.id === cardMap[cardType]);
  return card?.partners.find(p => p.program === programId);
}

function calculateRanking(program: any, milesNeeded: number, cabin: string): number {
  let score = 100;
  
  // Lower miles needed = higher score
  score -= (milesNeeded / 1000) * 0.5;
  
  // Alliance bonus
  if (program.alliance === 'Star Alliance') score += 10;
  
  // Known good programs
  if (['aeroplan', 'avianca-lifemiles'].includes(program.id)) score += 15;
  
  return score;
}

function generateTransferSummary(recs: any[]): string {
  if (recs.length === 0) return 'No transfer options available';
  
  const best = recs[0];
  return `Best option: Transfer ${best.pointsNeeded.toLocaleString()} ${best.transferFrom} points to ${best.program} for ${best.milesNeeded.toLocaleString()} miles`;
}
```

#### 3. Sweet Spots Finder Tool

**File:** `lib/tools/sweet-spots-finder.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import sweetSpotsData from '@/lib/miles-points/data/sweet-spots.json';

export const sweetSpotsFinderTool = tool({
  description: `Find known "sweet spot" redemptions - routes/programs with exceptional value.
  Use when user wants:
  - Best programs for specific routes
  - Maximum value from their miles
  - Award travel inspiration`,
  
  inputSchema: z.object({
    route: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }).optional(),
    cabin: z.enum(['economy', 'business', 'first']).optional(),
    program: z.string().optional().describe('Specific loyalty program'),
    maxMiles: z.number().optional().describe('Maximum miles willing to use'),
  }),
  
  execute: async ({ route, cabin, program, maxMiles }) => {
    let results = sweetSpotsData.sweetSpots;
    
    // Filter by route
    if (route?.from) {
      results = results.filter(spot =>
        spot.route.from.toLowerCase().includes(route.from!.toLowerCase())
      );
    }
    if (route?.to) {
      results = results.filter(spot =>
        spot.route.to.toLowerCase().includes(route.to!.toLowerCase())
      );
    }
    
    // Filter by cabin
    if (cabin) {
      results = results.filter(spot => spot.cabin === cabin);
    }
    
    // Filter by program
    if (program) {
      results = results.filter(spot =>
        spot.program.toLowerCase().includes(program.toLowerCase())
      );
    }
    
    // Filter by max miles
    if (maxMiles) {
      results = results.filter(spot => spot.milesRequired <= maxMiles);
    }
    
    return {
      success: true,
      filters: { route, cabin, program, maxMiles },
      sweetSpots: results.map(spot => ({
        ...spot,
        valueRating: spot.value,
        summary: `${spot.milesRequired.toLocaleString()} ${spot.program} miles for ${spot.cabin} class from ${spot.route.from} to ${spot.route.to}`,
      })),
      totalFound: results.length,
    };
  },
});
```

#### 4. UI Component

**File:** `components/miles-analysis.tsx`

```typescript
'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Award, Zap } from 'lucide-react';

export function MilesAnalysis({ data }: { data: any }) {
  const { value, breakdown, benchmark, advice } = data;
  
  const ratingColors = {
    poor: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
    fair: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100',
    good: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100',
    excellent: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
  };
  
  return (
    <Card className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Redemption Value Analysis</h3>
          <p className="text-sm text-neutral-500">{benchmark.cabin} class</p>
        </div>
        <Badge className={ratingColors[value.rating]}>
          {value.rating.toUpperCase()}
        </Badge>
      </div>
      
      {/* Main Value */}
      <div className="text-center py-4 border-y">
        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
          {value.centsPerMile}¢
        </div>
        <p className="text-sm text-neutral-500 mt-1">per mile value</p>
        <p className="text-sm font-medium mt-2">{value.recommendation}</p>
      </div>
      
      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-neutral-500">Cash Price</p>
          <p className="font-semibold">${breakdown.cashPrice.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-neutral-500">Miles Required</p>
          <p className="font-semibold">{breakdown.milesRequired.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-neutral-500">Taxes & Fees</p>
          <p className="font-semibold">${breakdown.taxesAndFees}</p>
        </div>
        <div>
          <p className="text-neutral-500">Effective Discount</p>
          <p className="font-semibold">{breakdown.effectiveDiscount}%</p>
        </div>
      </div>
      
      {/* Benchmark Comparison */}
      <div className="pt-4 border-t">
        <p className="text-sm font-medium mb-2">Benchmark Comparison</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-500">Minimum Good Value:</span>
            <span>{benchmark.minValue}¢</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Strong Redemption:</span>
            <span>{benchmark.goodValue}¢</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Your Value:</span>
            <span className={value.centsPerMile >= benchmark.goodValue ? 'text-green-600' : ''}>
              {benchmark.yourValue}¢
            </span>
          </div>
        </div>
      </div>
      
      {/* Advice */}
      {advice.length > 0 && (
        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Tips
          </p>
          <ul className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            {advice.map((tip: string, i: number) => (
              <li key={i} className="flex gap-2">
                <span>•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
```

## Functional Requirements
- [ ] Redemption value calculator funktioniert
- [ ] Transfer partner recommendations
- [ ] Sweet spots finder
- [ ] Benchmark comparisons
- [ ] Advice generation
- [ ] Support für major credit cards (Amex, Chase, Citi)
- [ ] Support für major alliances
- [ ] Data updates without code changes (JSON files)

## Non-Functional Requirements
- [ ] Calculations instant (< 100ms)
- [ ] Data structure erweiterbar
- [ ] Easy to add new programs/partners
- [ ] Mobile-friendly displays
- [ ] Accurate benchmarks

## Success Criteria
✅ **Core Calculations:**
```
User: "Is 75k miles for business to Tokyo worth it if cash price is $3000?"
→ Calculator shows 2.67¢/mile
→ Rating: Excellent
→ Recommendation: Definitely use miles
```

✅ **Transfer Optimization:**
```
User: "I have 100k Amex points, where should I transfer for Europe business class?"
→ Shows Avianca LifeMiles (63k), Aeroplan (75k), Flying Blue
→ Best value highlighted
→ Transfer ratios and bonuses shown
```

✅ **Sweet Spots:**
```
User: "What are the best uses of my miles for Asia?"
→ Lists known sweet spots
→ Aeroplan 75k business
→ ANA Round-The-World
→ etc.
```

## Testing Checklist
- [ ] Calculator with various prices/miles combinations
- [ ] Transfer optimizer with different point balances
- [ ] Sweet spots filtering by region/cabin
- [ ] Edge cases (very low/high cpp values)
- [ ] Data updates don't break functionality
- [ ] Mobile display of analysis
- [ ] Integration with search results

## Dependencies
- ✅ Phase 1, 2, 3 completed
- ⚠️  Redemption chart data research
- ⚠️  Transfer partner data validation

## Risks & Mitigation
- **Risk:** Data becomes outdated quickly
- **Mitigation:** JSON files easy to update, community contributions

- **Risk:** Program devaluations
- **Mitigation:** Date-stamp data, version control

- **Risk:** Complex dynamic pricing
- **Mitigation:** Use estimates, add disclaimers

## Timeline Estimate
- Data collection & structuring: 2 days
- Calculator implementation: 1 day
- Transfer optimizer: 1 day
- Sweet spots finder: 1 day
- UI components: 1 day
- Testing & refinement: 1 day
**Total: 4-6 days**

## Deliverables
1. ✅ JSON data files (programs, partners, sweet spots)
2. ✅ Miles calculator tool
3. ✅ Transfer optimizer tool
4. ✅ Sweet spots finder tool
5. ✅ UI components
6. ✅ Integration with search results
7. ✅ System prompts for context
8. ✅ Documentation

## Next Steps
Nach Completion:
→ **Phase 5:** UI/UX Polish & Branding
→ Community data contributions
→ Advanced features (price alerts, etc.)

## References
- [The Points Guy - Valuations](https://thepointsguy.com/guide/monthly-valuations/)
- [AwardHacker](https://www.awardhacker.com/)
- → Related: [Phase 2](../phase-2-seats-aero-integration/spec.md)
- → Related: [Phase 3](../phase-3-flight-search-enhancement/spec.md)
