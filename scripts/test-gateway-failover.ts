/**
 * Standalone failover smoke test for the Vercel AI Gateway integration.
 *
 * Hits the gateway with an intentionally invalid xAI model slug as primary
 * and Claude Opus 4.6 in `providerOptions.gateway.models`. If failover is
 * wired up correctly, Claude responds and `providerMetadata.gateway`
 * shows the model attempt chain.
 *
 * Run: pnpm tsx --env-file=.env.local scripts/test-gateway-failover.ts
 */

import { gateway } from '@ai-sdk/gateway';
import { generateText } from 'ai';
import { getStreamPolicy } from '../ai/failover';

const INVALID_PRIMARY = 'xai/grok-invalid-failover-smoke-test';
const FALLBACK_MODEL = 'anthropic/claude-opus-4.6';

async function main() {
  console.log('=== Gateway Failover Standalone Test ===');
  console.log(`Primary (intentionally invalid): ${INVALID_PRIMARY}`);
  console.log(`Expected fallback: ${FALLBACK_MODEL}`);
  console.log('');

  const policy = getStreamPolicy('chat');
  console.log(`StreamPolicy resolved: ${JSON.stringify(policy)}`);
  console.log('');

  try {
    const start = Date.now();
    const result = await generateText({
      model: gateway(INVALID_PRIMARY),
      prompt: 'Reply with exactly one short sentence: confirm you are Claude.',
      maxOutputTokens: 50,
      ...(policy && { providerOptions: { gateway: policy } }),
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    console.log(`--- RESULT (${elapsed}s) ---`);
    console.log(`text: ${result.text}`);
    console.log('');
    console.log('--- providerMetadata ---');
    console.log(JSON.stringify(result.providerMetadata, null, 2));
    console.log('');
    console.log('--- response.modelId ---');
    console.log(result.response?.modelId ?? '<no modelId on response>');
    console.log('');

    // Verdict: read the gateway routing metadata to confirm the failover
    // chain actually fired and Claude served the request. response.modelId
    // shows the ORIGINAL requested slug, not the resolved provider.
    const routing = (result.providerMetadata as { gateway?: { routing?: Record<string, unknown> } })
      ?.gateway?.routing;
    const finalProvider = routing?.finalProvider as string | undefined;
    const attemptCount = routing?.modelAttemptCount as number | undefined;
    const modelAttempts = (routing?.modelAttempts ?? []) as Array<{
      modelId: string;
      success: boolean;
    }>;

    const failedFirstAttempt = modelAttempts[0]?.success === false;
    const claudeServed =
      finalProvider === 'anthropic' &&
      modelAttempts.some((a) => a.modelId.includes('claude') && a.success);

    if (failedFirstAttempt && claudeServed && result.text.length > 0) {
      console.log(
        `✓ PASS — Failover chain fired: ${attemptCount} model attempts, finalProvider=${finalProvider}, Claude served the request.`,
      );
      process.exit(0);
    }
    console.log('✗ FAIL — got a response but failover chain did not look right.');
    console.log(`  failedFirstAttempt=${failedFirstAttempt} claudeServed=${claudeServed}`);
    process.exit(1);
  } catch (error) {
    console.log('--- ERROR ---');
    if (error instanceof Error) {
      console.log(`name: ${error.name}`);
      console.log(`message: ${error.message}`);
      if ('statusCode' in error) console.log(`statusCode: ${(error as { statusCode: unknown }).statusCode}`);
      if ('cause' in error && error.cause) {
        console.log(`cause: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`);
      }
    } else {
      console.log(String(error));
    }
    console.log('');
    console.log('✗ FAIL — failover did not catch the invalid primary.');
    process.exit(1);
  }
}

void main();
