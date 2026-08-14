/**
 * Resolves Next.js `output` so Vercel adapter builds do not combine with standalone.
 *
 * Next 16.3 skips `next-server.js.nft.json` when an adapter is present
 * (`NEXT_ADAPTER_PATH`, injected by Vercel). `output: 'standalone'` still
 * reads that file and fails with ENOENT. Vercel ignores standalone anyway;
 * Docker/self-host still needs it.
 *
 * @see https://github.com/vercel/next.js/issues/96646
 * @param env - Process environment
 * @returns `standalone` off Vercel, otherwise undefined
 */
export function resolveNextOutput(
  env: NodeJS.ProcessEnv,
): 'standalone' | undefined {
  return env.VERCEL ? undefined : 'standalone';
}
