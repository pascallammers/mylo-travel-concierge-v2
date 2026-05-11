// lib/chat/__evals__/run.ts
import { buildMyloWebSystemPrompt } from '@/lib/chat/mylo-system-prompt';
import { edgeCases } from './fixtures/edge-cases';
import { realChats } from './fixtures/real-chats';
import { buildMockToolRegistry } from './mock-tools';
import { extractFirstToolCall } from './tool-extractor';
import { getEvalModel, runRoutingCall } from './grok-client';
import { formatReport, type EvalRunResult } from './reporter';
import type { EvalFixture } from './fixtures/types';

async function main(): Promise<void> {
  if (!process.env.XAI_API_KEY) {
    console.error('ERROR: XAI_API_KEY env var is required.');
    console.error('Get a key from https://console.x.ai and run: XAI_API_KEY=xai-... pnpm eval');
    process.exit(2);
  }

  const fixtures: EvalFixture[] = [...realChats, ...edgeCases];
  const tools = buildMockToolRegistry();
  const model = getEvalModel();
  const modelName = process.env.EVAL_MODEL ?? 'grok-4-1-fast-non-reasoning';

  const results: EvalRunResult[] = [];

  for (const fx of fixtures) {
    const system = buildMyloWebSystemPrompt({ now: fx.now });
    try {
      const r = await runRoutingCall({
        model,
        system,
        userQuery: fx.userQuery,
        tools,
      });
      const actualTool = extractFirstToolCall(r);
      results.push({
        fixture: fx,
        actualTool,
        passed: actualTool === fx.expectedTool,
        durationMs: r.durationMs,
      });
    } catch (err) {
      results.push({
        fixture: fx,
        actualTool: null,
        passed: false,
        durationMs: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(formatReport(results, modelName));
  process.exit(results.every((r) => r.passed) ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
