export type ExaConfigSearchType = 'instant' | 'auto' | 'fast' | 'hybrid' | 'neural' | 'keyword';
export type ExaRuntimeSearchType = ExaConfigSearchType;

export type ExaSdkSearchType = 'keyword' | 'neural' | 'auto' | 'hybrid' | 'fast';

/**
 * Resolve Exa search type from config value and fallback.
 *
 * @param configuredType Search type from environment/config.
 * @param fallbackType Search type used when no explicit config value is set.
 * @returns Resolved runtime search type.
 */
export const resolveExaSearchType = (
  configuredType: ExaConfigSearchType | undefined,
  fallbackType: ExaConfigSearchType = 'instant',
): ExaRuntimeSearchType => {
  return configuredType ?? fallbackType;
};

/**
 * Convert runtime search type to the current exa-js SDK search type union.
 *
 * @param searchType Runtime search type.
 * @returns Search type compatible with exa-js call signatures.
 */
export const toExaSdkSearchType = (searchType: ExaRuntimeSearchType): ExaSdkSearchType => {
  if (searchType === 'instant') {
    return 'instant' as unknown as ExaSdkSearchType;
  }

  return searchType;
};

/**
 * Resolve Exa runtime search type from quality intent.
 *
 * @param quality Requested quality level.
 * @param configuredType Search type from environment/config.
 * @returns Exa runtime search type optimized for requested quality.
 */
export const resolveExaSearchTypeForQuality = (
  quality: 'default' | 'best',
  configuredType: ExaConfigSearchType | undefined,
): ExaRuntimeSearchType => {
  if (quality === 'best') {
    return 'hybrid';
  }

  return resolveExaSearchType(configuredType, 'instant');
};
