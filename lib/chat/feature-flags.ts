// lib/chat/feature-flags.ts
//
// Pure, testable feature-flag accessors. Centralized so we can swap the
// backing store (env var, PostHog, LaunchDarkly, GrowthBook) without
// hunting call sites.
//
// Phase 1 tools = the seven points/miles + booking tools shipped in Lane C
// (cpp-calculator service) and Lane E (the seven AI SDK tool wrappers).
// They make live HTTP calls to four MCP servers (Skiplagged, Kiwi, Trivago,
// Ferryhopper), so we want a kill switch in case any provider goes flaky in
// production.

// Accept the looser shape (Record) so tests can pass plain object literals
// without satisfying NodeJS.ProcessEnv's required keys. process.env conforms
// to this shape at runtime.
export function isPhase1ToolsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const v = env.ENABLE_PHASE_1_TOOLS;
  return v === '1' || v === 'true';
}

export const PHASE_1_TOOL_NAMES = [
  'cpp_calculator',
  'transfer_partner_optimizer',
  'sweet_spot_lookup',
  'skiplagged_flight_search',
  'kiwi_flight_search',
  'trivago_hotel_search',
  'ferryhopper_search',
] as const;

export type Phase1ToolName = (typeof PHASE_1_TOOL_NAMES)[number];
