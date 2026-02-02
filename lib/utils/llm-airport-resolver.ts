/**
 * LLM-based airport code extraction using xAI/Grok
 * Handles natural language queries with contextual disambiguation
 */

import { generateText, Output, NoOutputGeneratedError } from 'ai';
import { languageModel } from '../../ai/providers';
import { z } from 'zod';

// Zod schema for structured output
const AirportExtractionSchema = z.object({
  originCode: z.string(),
  originName: z.string(),
  originCity: z.string(),
  originCountry: z.string(),
  originConfidence: z.enum(['high', 'medium', 'low', 'none']),
  destinationCode: z.string(),
  destinationName: z.string(),
  destinationCity: z.string(),
  destinationCountry: z.string(),
  destinationConfidence: z.enum(['high', 'medium', 'low', 'none']),
  reasoning: z.string().optional(),
});

export type AirportExtractionResult = z.infer<typeof AirportExtractionSchema>;
export { AirportExtractionSchema };

/**
 * Build the extraction prompt with disambiguation rules
 */
function buildAirportExtractionPrompt(query: string): string {
  return `You are an expert at extracting IATA airport codes from natural language travel queries.

TASK: Extract the origin and destination airports from the user's query.

CRITICAL DISAMBIGUATION RULES:
1. Use country/region context to disambiguate:
   - "liberia" + "costa rica" context = LIR (Daniel Oduber Quiros International Airport, Guanacaste)
   - "liberia" alone or + "africa" context = LIB (Roberts International Airport, Liberia)

2. Handle city name conflicts:
   - "san jose" + "costa rica" = SJO (Juan Santamaria International Airport)
   - "san jose" + "california" or alone in US context = SJC (San Jose Mineta International Airport)

3. Prefer major international airports for city names:
   - "new york" = JFK (not LGA or EWR unless specified)
   - "london" = LHR (not LGW, STN, LTN unless specified)
   - "frankfurt" = FRA (Frankfurt am Main Airport)

4. For ambiguous inputs WITHOUT clear context, set confidence to "low" and explain in reasoning field.

5. If origin or destination not mentioned, use "NONE" as code and confidence "none".

EXAMPLES:
Query: "Frankfurt nach costa rica liberia"
Response:
  originCode: "FRA"
  originName: "Frankfurt Airport"
  originCity: "Frankfurt"
  originCountry: "Germany"
  originConfidence: "high"
  destinationCode: "LIR"
  destinationName: "Daniel Oduber Quiros International Airport"
  destinationCity: "Liberia"
  destinationCountry: "Costa Rica"
  destinationConfidence: "high"
  reasoning: "costa rica context indicates LIR, not the country Liberia"

Query: "berlin to liberia"
Response:
  originCode: "BER"
  originName: "Berlin Brandenburg Airport"
  originCity: "Berlin"
  originCountry: "Germany"
  originConfidence: "high"
  destinationCode: "LIR"
  destinationName: "Daniel Oduber Quiros International Airport"
  destinationCity: "Liberia"
  destinationCountry: "Costa Rica"
  destinationConfidence: "low"
  reasoning: "liberia is ambiguous - could be LIR (Costa Rica) or LIB (Liberia country). Defaulting to LIR."

Query: "san jose costa rica"
Response:
  originCode: "NONE"
  originName: ""
  originCity: ""
  originCountry: ""
  originConfidence: "none"
  destinationCode: "SJO"
  destinationName: "Juan Santamaria International Airport"
  destinationCity: "San Jose"
  destinationCountry: "Costa Rica"
  destinationConfidence: "high"

Now extract from: "${query}"`;
}

/**
 * Extract airport codes from natural language query using LLM
 * @param query - Natural language travel query (e.g., "Frankfurt nach costa rica liberia")
 * @returns Typed airport extraction result with confidence levels
 */
export async function extractAirportCodes(query: string): Promise<AirportExtractionResult | { error: string }> {
  try {
    console.log('[LLM Airport] Extracting codes from:', query);

    // @ts-ignore - TypeScript has issues with deep zod schema inference in AI SDK
    const outputConfig = Output.object({
      schema: AirportExtractionSchema,
    });

    // @ts-ignore
    const result: any = await generateText({
      model: languageModel,
      prompt: buildAirportExtractionPrompt(query),
      experimental_output: outputConfig,
    });

    const extracted = result.experimental_output as AirportExtractionResult;

    console.log('[LLM Airport] Extraction successful:', extracted);
    return extracted;
  } catch (error) {
    if (NoOutputGeneratedError.isInstance(error)) {
      console.error('[LLM Airport] Extraction failed - no output generated:', error);
      return {
        error: 'extraction_failed',
      };
    }

    console.error('[LLM Airport] Unexpected error:', error);
    throw error;
  }
}
