// lib/tools/cpp-calculator.ts
//
// AI SDK tool that wraps the cpp-calculator service. The agent calls this when
// a user asks "is X points for Y price a good deal?" or "how much value does
// this redemption give me?".
//
// Currency defaults to EUR for the DACH user base. The system prompt should
// override to USD when the user is communicating in English about US programs.

import { tool } from 'ai';
import { z } from 'zod';
import { loadPointsValuations } from '@/lib/data/borski-toolkit-adapter';
import {
  calculateCpp,
  CppCalculatorError,
  type CppResult,
} from '@/lib/services/cpp-calculator';

const inputSchema = z.object({
  programId: z
    .string()
    .min(1)
    .describe(
      'Borski program ID, e.g. "amex_membership_rewards", "chase_ultimate_rewards", "lufthansa", "marriott_bonvoy". Lowercase + underscores.',
    ),
  pointsRequired: z
    .number()
    .positive()
    .describe('Number of points/miles required to book the redemption.'),
  cashEquivalent: z
    .number()
    .positive()
    .describe(
      'Cash price of the same booking in the input currency (full units, not cents). Used as the comparison value.',
    ),
  currency: z
    .enum(['USD', 'EUR'])
    .optional()
    .default('EUR')
    .describe(
      'Currency of cashEquivalent. Defaults to EUR for DACH users. Set to USD when comparing US programs in USD.',
    ),
});

type CppToolSuccess = CppResult & { success: true; summary: string };
type CppToolError = { success: false; error: string };
type CppToolResult = CppToolSuccess | CppToolError;

export const cppCalculatorTool = tool({
  description:
    'Calculate cents-per-point (cpp) value of a points redemption against borski-toolkit valuation thresholds. Returns a tier (poor/fair/good/excellent) and human-readable summary. Use when the user asks whether a redemption is worth burning points, or wants to compare points-vs-cash for a specific booking.',
  inputSchema,
  execute: async (input): Promise<CppToolResult> => {
    try {
      const valuations = loadPointsValuations();
      const result = calculateCpp({
        programId: input.programId,
        pointsRequired: input.pointsRequired,
        cashEquivalent: input.cashEquivalent,
        currency: input.currency,
        valuations,
      });
      return {
        success: true,
        ...result,
        summary: buildSummary(result),
      };
    } catch (err) {
      if (err instanceof CppCalculatorError) {
        return { success: false, error: err.message };
      }
      throw err;
    }
  },
});

function buildSummary(r: CppResult): string {
  const cur = r.inputCurrency === 'EUR' ? 'EUR' : 'USD';
  const noteSuffix = r.source === 'mm-override' ? ' (M&M Star Alliance partner threshold)' : '';
  return `${r.tier.toUpperCase()} deal: ${r.cpp}¢ per point on ${r.programName} (${cur} input). Threshold ${r.threshold.floor}-${r.threshold.ceiling}¢${noteSuffix}.`;
}
