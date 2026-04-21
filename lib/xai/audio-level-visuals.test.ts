import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudioLevelBarScales, normalizeAudioLevel, smoothAudioLevel } from './audio-level-visuals';

test('normalizeAudioLevel returns zero for silence samples', () => {
  const silence = new Uint8Array([128, 128, 128, 128]);

  assert.equal(normalizeAudioLevel(silence), 0);
});

test('normalizeAudioLevel returns a boosted but clamped value for speech-like samples', () => {
  const speechLike = new Uint8Array([90, 164, 96, 160, 102, 154, 110, 146]);
  const level = normalizeAudioLevel(speechLike);

  assert.ok(level > 0.5);
  assert.ok(level <= 1);
});

test('smoothAudioLevel uses a faster attack than release', () => {
  const attack = smoothAudioLevel(0.1, 0.9);
  const release = smoothAudioLevel(0.9, 0.1);

  assert.ok(attack > 0.3);
  assert.ok(release > 0.7);
  assert.ok(attack > 1 - release);
});

test('createAudioLevelBarScales keeps a subtle baseline and grows with level', () => {
  const idle = createAudioLevelBarScales(0);
  const active = createAudioLevelBarScales(0.8);

  assert.equal(idle.length, 4);
  assert.equal(active.length, 4);
  assert.ok(idle.every((value) => value >= 0.5));
  assert.ok(active[1] > idle[1]);
  assert.ok(active[2] > idle[2]);
});
