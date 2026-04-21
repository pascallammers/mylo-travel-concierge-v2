export type VoiceToolExecutionContext = {
  userId?: string;
  chatId?: string;
};

export type VoiceToolExecutor = (
  args: Record<string, unknown>,
  context: VoiceToolExecutionContext,
) => Promise<unknown>;

export type VoiceToolRegistry = Partial<Record<string, VoiceToolExecutor>>;

/**
 * Builds the local, dependency-free voice tool registry.
 *
 * @returns Pure utility tools that do not depend on app services.
 */
export function createLocalVoiceToolRegistry(): VoiceToolRegistry {
  return {
    get_current_datetime: async (args) => {
      const timezoneValue = typeof args.timezone === 'string' && args.timezone.trim().length > 0 ? args.timezone : 'UTC';
      const now = new Date();

      return {
        timezone: timezoneValue,
        timestamp: now.getTime(),
        iso: now.toISOString(),
        formatted: new Intl.DateTimeFormat('de-DE', {
          dateStyle: 'full',
          timeStyle: 'medium',
          timeZone: timezoneValue,
        }).format(now),
      };
    },
  };
}

/**
 * Executes a single voice tool call against the approved registry.
 *
 * @param request - Tool name, arguments, and user context.
 * @param registry - Optional registry override for tests or composition.
 * @returns The tool result payload.
 */
export async function executeVoiceToolCall(
  request: {
    toolName: string;
    args: Record<string, unknown>;
    context?: VoiceToolExecutionContext;
  },
  registry: VoiceToolRegistry = createLocalVoiceToolRegistry(),
): Promise<unknown> {
  const executor = registry[request.toolName];

  if (!executor) {
    throw new Error(`Tool "${request.toolName}" is not available in voice mode.`);
  }

  return executor(request.args, request.context ?? {});
}
