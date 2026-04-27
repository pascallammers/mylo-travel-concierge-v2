// Import tools from individual modules rather than the @/lib/tools barrel.
// The barrel re-exports stock-chart -> @/lib/subscription -> @/lib/auth ->
// @dodopayments/better-auth which has a broken transitive `buildCheckoutUrl`
// export at install time. Individual imports avoid pulling that chain in.
import { flightSearchTool } from '@/lib/tools/flight-search';
import { flightTrackerTool } from '@/lib/tools/flight-tracker';
import { knowledgeBaseTool } from '@/lib/tools/knowledge-base';
import { webSearchTool } from '@/lib/tools/web-search';
import { retrieveTool } from '@/lib/tools/retrieve';
import { textTranslateTool } from '@/lib/tools/text-translate';
import { nearbyPlacesSearchTool, findPlaceOnMapTool } from '@/lib/tools/map-tools';
import { movieTvSearchTool } from '@/lib/tools/movie-tv-search';
import { trendingMoviesTool } from '@/lib/tools/trending-movies';
import { trendingTvTool } from '@/lib/tools/trending-tv';
import { weatherTool } from '@/lib/tools/weather';
import { datetimeTool } from '@/lib/tools/datetime';
import { greetingTool } from '@/lib/tools/greeting';
import { codeInterpreterTool } from '@/lib/tools/code-interpreter';
import { getLoyaltyBalancesTool } from '@/lib/tools/loyalty-balances';

export const WEB_GROUP_TOOL_NAMES = [
  'web_search',
  'greeting',
  'code_interpreter',
  'get_weather_data',
  'retrieve',
  'text_translate',
  'nearby_places_search',
  'track_flight',
  'search_flights',
  'movie_or_tv_search',
  'trending_movies',
  'find_place_on_map',
  'trending_tv',
  'datetime',
  'knowledge_base',
  'get_loyalty_balances',
] as const;

export type WebGroupToolName = (typeof WEB_GROUP_TOOL_NAMES)[number];

const noopExecute = async () => ({ ok: true, mock: true });

function withNoop<T extends { execute?: unknown }>(t: T): T {
  return { ...t, execute: noopExecute } as T;
}

export function buildMockToolRegistry() {
  return {
    web_search: withNoop(webSearchTool(undefined, 'exa')),
    greeting: withNoop(greetingTool('UTC')),
    code_interpreter: withNoop(codeInterpreterTool),
    get_weather_data: withNoop(weatherTool),
    retrieve: withNoop(retrieveTool),
    text_translate: withNoop(textTranslateTool),
    nearby_places_search: withNoop(nearbyPlacesSearchTool),
    track_flight: withNoop(flightTrackerTool),
    search_flights: withNoop(flightSearchTool),
    movie_or_tv_search: withNoop(movieTvSearchTool),
    trending_movies: withNoop(trendingMoviesTool),
    find_place_on_map: withNoop(findPlaceOnMapTool),
    trending_tv: withNoop(trendingTvTool),
    datetime: withNoop(datetimeTool),
    knowledge_base: withNoop(knowledgeBaseTool),
    get_loyalty_balances: withNoop(getLoyaltyBalancesTool),
  };
}
