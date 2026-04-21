import { datetimeTool, flightSearchTool, flightTrackerTool, getLoyaltyBalancesTool, weatherTool } from '../tools';
import { createLocalVoiceToolRegistry, type VoiceToolRegistry } from './voice-tools';

type ExecutableTool = {
  execute: (args: Record<string, unknown>, context?: { messages?: Array<Record<string, unknown>> }) => Promise<unknown>;
};

const executableWeatherTool = weatherTool as unknown as ExecutableTool;
const executableFlightTrackerTool = flightTrackerTool as unknown as ExecutableTool;
const executableFlightSearchTool = flightSearchTool as unknown as ExecutableTool;
const executableLoyaltyTool = getLoyaltyBalancesTool as unknown as ExecutableTool;
const executableDatetimeTool = datetimeTool as unknown as ExecutableTool;

/**
 * Builds the server-side registry for the approved realtime voice tools.
 *
 * @returns Voice tool executors backed by the existing Mylo server tools.
 */
export function createServerVoiceToolRegistry(): VoiceToolRegistry {
  const localRegistry = createLocalVoiceToolRegistry();

  return {
    ...localRegistry,
    get_current_datetime: async (args) => {
      const fallback = await executableDatetimeTool.execute({});
      const localResult = await localRegistry.get_current_datetime?.(args, {});

      return {
        ...(typeof fallback === 'object' && fallback !== null ? fallback : {}),
        ...(typeof localResult === 'object' && localResult !== null ? localResult : {}),
      };
    },
    get_weather_data: async (args) => executableWeatherTool.execute(args),
    track_flight: async (args) => executableFlightTrackerTool.execute(args),
    search_flights: async (args, context) =>
      executableFlightSearchTool.execute(args, {
        messages: [{ chatId: context.chatId, userId: context.userId }],
      }),
    get_loyalty_balances: async (args, context) =>
      executableLoyaltyTool.execute(args, {
        messages: [{ chatId: context.chatId, userId: context.userId }],
      }),
  };
}
