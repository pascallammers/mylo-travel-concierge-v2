function clampAudioLevel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Converts raw time-domain microphone samples into a normalized visual level.
 *
 * @param samples - Byte time-domain data from a Web Audio analyser node.
 * @returns A clamped 0..1 level for subtle voice-reactive visuals.
 */
export function normalizeAudioLevel(samples: Uint8Array): number {
  if (samples.length === 0) {
    return 0;
  }

  let sumSquares = 0;

  for (const sample of samples) {
    const centered = (sample - 128) / 128;
    sumSquares += centered * centered;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  return clampAudioLevel(rms * 3.4);
}

/**
 * Smooths microphone level changes for calmer premium UI motion.
 *
 * @param previousLevel - The level currently shown in the UI.
 * @param nextLevel - The freshly measured microphone level.
 * @returns A smoothed 0..1 level using faster attack and slower release.
 */
export function smoothAudioLevel(previousLevel: number, nextLevel: number): number {
  const previous = clampAudioLevel(previousLevel);
  const next = clampAudioLevel(nextLevel);
  const factor = next > previous ? 0.42 : 0.18;

  return clampAudioLevel(previous + (next - previous) * factor);
}

/**
 * Creates four subtle bar scales for the recording waveform.
 *
 * @param level - Normalized microphone level in the 0..1 range.
 * @returns Scale multipliers for four waveform bars.
 */
export function createAudioLevelBarScales(level: number): [number, number, number, number] {
  const safeLevel = clampAudioLevel(level);

  return [
    0.52 + safeLevel * 0.28,
    0.64 + safeLevel * 0.62,
    0.58 + safeLevel * 0.46,
    0.5 + safeLevel * 0.24,
  ];
}
