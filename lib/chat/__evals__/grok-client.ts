import { generateText, stepCountIs, type LanguageModel } from 'ai';
import { xai } from '@ai-sdk/xai';

export type RouteEvalResult = {
  toolCalls: Array<{ toolName: string }>;
  durationMs: number;
};

const DEFAULT_MODEL = 'grok-4-1-fast-non-reasoning';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

export function getEvalModel(): LanguageModel {
  return xai(process.env.EVAL_MODEL ?? DEFAULT_MODEL);
}

export async function runRoutingCall(args: {
  model: LanguageModel;
  system: string;
  userQuery: string;
  tools: Record<string, unknown>;
}): Promise<RouteEvalResult> {
  const start = Date.now();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await Promise.race([
        generateText({
          model: args.model,
          system: args.system,
          prompt: args.userQuery,
          // biome-ignore lint/suspicious/noExplicitAny: AI SDK tool type narrowing is intentionally loose here
          tools: args.tools as any,
          temperature: 0,
          stopWhen: stepCountIs(1),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('eval call timeout')), TIMEOUT_MS),
        ),
      ]);
      return {
        toolCalls: result.toolCalls?.map((tc) => ({ toolName: tc.toolName })) ?? [],
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'));
      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        const backoffMs = 1000 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('runRoutingCall: exhausted retries (unreachable)');
}
