import { serverEnv } from '@/env/server';
import {
  resolveExaSearchType,
  resolveExaSearchTypeForQuality,
  toExaSdkSearchType,
  type ExaConfigSearchType,
  type ExaSdkSearchType,
} from './exa-search-type-utils';

export type { ExaConfigSearchType, ExaRuntimeSearchType, ExaSdkSearchType } from './exa-search-type-utils';

/**
 * Resolve configured Exa search type with support for the new `instant` mode.
 *
 * `exa-js` typings currently don't expose `instant` yet, so the cast is isolated
 * here and all call sites can stay type-safe.
 *
 * @param fallbackType Search type used when no explicit env value is set.
 * @returns A search type value compatible with existing SDK call signatures.
 */
export const getExaSearchType = (fallbackType: ExaConfigSearchType = 'instant'): ExaSdkSearchType => {
  return toExaSdkSearchType(resolveExaSearchType(serverEnv.EXA_SEARCH_TYPE as ExaConfigSearchType, fallbackType));
};

/**
 * Resolve Exa SDK search type from quality intent.
 *
 * @param quality Requested quality level.
 * @returns Exa SDK-compatible search type optimized for requested quality.
 */
export const getExaSearchTypeForQuality = (quality: 'default' | 'best'): ExaSdkSearchType => {
  return toExaSdkSearchType(resolveExaSearchTypeForQuality(quality, serverEnv.EXA_SEARCH_TYPE as ExaConfigSearchType));
};
