import type { Platform } from '../types';

export const CONFIG = {
  width: 480,
  height: 720,
  targetFrameMs: 1000 / 60,
  maxFrameDeltaMs: 50,
  gravity: 0.38,
  jumpVelocity: -11.7,
  moveSpeed: 6.5,
  playerWidth: 34,
  playerHeight: 42,
  platformHeight: 14,
  // Every platform is the same width: 2.5x the player width.
  platformWidth: 34 * 2.5,
  rowGapJumpRatio: 0.45,
  emptyRowChance: 0.4,
  pairChance: 0.05,
  pairMinGap: 36,
  fragileHits: 3,
  movingPlatformSpeed: 1.5,
  movingPlatformRangeMin: 70,
  movingPlatformRangeMax: 150
} as const;

export const PARTICLE_COLORS = {
  normal: [0.2, 0.95, 1.0],
  moving: [0.25, 1.0, 0.55],
  fragile: [1.0, 0.4, 0.5],
  fragileBreak: [1.0, 0.28, 0.35]
} as const;

export const MAX_PARTICLES = 420;
export const TRAIL_LENGTH = 16;

export type RgbColor = readonly [number, number, number];

export function getMaxJumpHeight(): number {
  return (CONFIG.jumpVelocity * CONFIG.jumpVelocity) / (2 * CONFIG.gravity);
}

export function getPlatformRowGap(): number {
  return getMaxJumpHeight() * CONFIG.rowGapJumpRatio;
}

export function colorForType(platform: Platform): RgbColor {
  if (platform.type === 'moving') {
    return PARTICLE_COLORS.moving;
  }
  if (platform.type === 'fragile') {
    return PARTICLE_COLORS.fragile;
  }
  return PARTICLE_COLORS.normal;
}
