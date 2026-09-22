import { tool } from 'ai';
import { z } from 'zod';
import { getLoyaltyProgram } from '@/lib/loyalty/programs';
import { assessRedemption, CppCalculatorError, type RedemptionAssessment } from '@/lib/services/cpp-calculator';
import { VALUATION_SEEDS } from '@/lib/valuation/seeds';
import { readValuationTable } from '@/lib/valuation/runtime';
import { CABINS, type ValuationTable } from '@/lib/valuation/types';

const initialPrograms = VALUATION_SEEDS.filter((rate) => rate.anchor === 'travel' && rate.cabin === 'all')
  .map((rate) => `${rate.programId} = ${getLoyaltyProgram(rate.programId)?.name ?? rate.programId}`)
  .join(', ');
const inputSchema = z
  .object({
    programId: z
      .string({ required_error: 'Bitte ein Programm angeben.', invalid_type_error: 'Bitte eine Programm-ID angeben.' })
      .min(1, 'Bitte ein Programm angeben.')
      .describe(
        `Programm-ID aus lib/loyalty/programs.ts. Bewertbare Programme zum Start: ${initialPrograms}. Weitere Programme sind bewertbar, sobald ein aktueller Reisewert für alle Klassen hinterlegt ist.`,
      ),
    cabin: z
      .enum(CABINS, { errorMap: () => ({ message: 'Bitte eine gültige Reiseklasse angeben.' }) })
      .optional()
      .describe(
        'Optionale Reiseklasse: all, economy, premium_economy, business oder first. Ohne spezifischen Satz gilt der Reisewert für alle Klassen.',
      ),
    pointsRequired: z
      .number({
        required_error: 'Bitte die benötigte Punktezahl angeben.',
        invalid_type_error: 'Die Punktezahl muss eine Zahl sein.',
      })
      .finite('Die Punktezahl muss endlich sein.')
      .positive('Die Punktezahl muss größer als null sein.')
      .describe('Benötigte Punkte oder Meilen für die Einlösung.'),
    cashEur: z
      .number({
        required_error: 'Bitte den Vergleichspreis in EUR angeben.',
        invalid_type_error: 'Der Vergleichspreis muss eine Zahl sein.',
      })
      .finite('Der Vergleichspreis muss endlich sein.')
      .positive('Der Vergleichspreis muss größer als null sein.')
      .describe('Vergleichspreis derselben Buchung ausschließlich in EUR, als voller Euro-Betrag.'),
  })
  .strict('Bitte nur Programm, Klasse, Punktezahl und Vergleichspreis in EUR angeben.');

type CppToolResult = (RedemptionAssessment & { success: true }) | { success: false; error: string };

/**
 * Create the CPP tool with one injected valuation read per execution.
 * @param readTable - Load the current accepted valuation snapshot.
 * @returns Tool assessing EUR redemptions with dated travel/no-plan anchors.
 */
export function createCppCalculatorTool(readTable: () => Promise<ValuationTable>) {
  return tool({
    description:
      'Assess a points or miles redemption in EUR cents per point against the current DACH valuation table. Compares the cabin-dependent travel value (Reisewert) and, where documented, the no-plan value (Wert ohne Plan), and returns a German quality-seal summary with source and month. Use it when the user asks whether a specific redemption beats the cash price in EUR.',
    inputSchema,
    execute: async (input): Promise<CppToolResult> => {
      try {
        return { success: true, ...assessRedemption(input, await readTable()) };
      } catch (error) {
        // Only input errors are answers for the model; anything else must count as a failed tool call.
        if (error instanceof CppCalculatorError) return { success: false, error: error.message };
        throw error;
      }
    },
  });
}

export const cppCalculatorTool = createCppCalculatorTool(readValuationTable);
