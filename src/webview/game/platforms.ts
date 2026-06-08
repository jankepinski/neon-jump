import { CONFIG, getPlatformRowGap } from './config';
import { randomBetween } from './math';
import type { GameState, Platform, PlatformType } from '../types';

export function getPlatformType(forceNormal = false): PlatformType {
  if (forceNormal) {
    return 'normal';
  }

  const roll = Math.random();
  if (roll < 0.5) {
    return 'normal';
  }
  if (roll < 0.75) {
    return 'fragile';
  }
  return 'moving';
}

export function createMovingPlatformState(x: number, width: number) {
  const maxTravel = randomBetween(CONFIG.movingPlatformRangeMin, CONFIG.movingPlatformRangeMax);
  const minX = Math.max(16, x - maxTravel / 2);
  const maxX = Math.min(CONFIG.width - width - 16, x + maxTravel / 2);
  const direction = Math.random() < 0.5 ? -1 : 1;

  return {
    vx: CONFIG.movingPlatformSpeed * direction,
    minX,
    maxX
  };
}

export interface CreatePlatformOptions {
  width?: number;
  type?: PlatformType;
  x?: number;
  forceNormal?: boolean;
}

export function createPlatformAtRow(y: number, options: CreatePlatformOptions = {}): Platform {
  const width = options.width ?? CONFIG.platformWidth;
  const type = options.type ?? getPlatformType(options.forceNormal);
  const x = options.x ?? randomBetween(16, CONFIG.width - width - 16);

  const platform: Platform = {
    x,
    y,
    width,
    height: CONFIG.platformHeight,
    type,
    hitsLeft: type === 'fragile' ? CONFIG.fragileHits : null
  };

  if (type === 'moving') {
    const movingState = createMovingPlatformState(x, width);
    platform.vx = movingState.vx;
    platform.minX = movingState.minX;
    platform.maxX = movingState.maxX;
  }

  return platform;
}

export function platformsOverlap(
  first: { x: number; width: number },
  second: { x: number; width: number }
): boolean {
  return !(
    first.x + first.width + CONFIG.pairMinGap <= second.x ||
    second.x + second.width + CONFIG.pairMinGap <= first.x
  );
}

export function createPlatformPairAtRow(y: number, firstPlatform: Platform): Platform {
  const width = CONFIG.platformWidth;
  const firstCenter = firstPlatform.x + firstPlatform.width / 2;
  const preferRight = firstCenter < CONFIG.width / 2;

  let x = preferRight
    ? randomBetween(CONFIG.width / 2 + 20, CONFIG.width - width - 16)
    : randomBetween(16, CONFIG.width / 2 - width - 20);

  let attempts = 0;
  while (platformsOverlap({ x, width }, firstPlatform) && attempts < 12) {
    x = preferRight
      ? randomBetween(CONFIG.width / 2 + 20, CONFIG.width - width - 16)
      : randomBetween(16, CONFIG.width / 2 - width - 20);
    attempts += 1;
  }

  return createPlatformAtRow(y, { x, width });
}

export function shouldRowBeEmpty(state: GameState): boolean {
  if (state.lastRowWasEmpty) {
    return false;
  }

  return Math.random() < CONFIG.emptyRowChance;
}

export function spawnPlatformsAtRow(state: GameState, y: number): void {
  const platform = createPlatformAtRow(y);
  state.platforms.push(platform);

  if (Math.random() < CONFIG.pairChance) {
    const pairedPlatform = createPlatformPairAtRow(y, platform);
    if (!platformsOverlap(platform, pairedPlatform)) {
      state.platforms.push(pairedPlatform);
    }
  }
}

export function generatePlatformsUntil(state: GameState, targetY: number): void {
  while (state.lastGeneratedRowY > targetY) {
    state.lastGeneratedRowY -= getPlatformRowGap();

    if (shouldRowBeEmpty(state)) {
      state.lastRowWasEmpty = true;
      continue;
    }

    state.lastRowWasEmpty = false;
    spawnPlatformsAtRow(state, state.lastGeneratedRowY);
  }
}

export function updateMovingPlatforms(state: GameState, timeScale: number): void {
  for (const platform of state.platforms) {
    if (platform.type !== 'moving') {
      continue;
    }

    platform.x += platform.vx! * timeScale;

    if (platform.x <= platform.minX!) {
      platform.x = platform.minX!;
      platform.vx = Math.abs(platform.vx!);
    } else if (platform.x >= platform.maxX!) {
      platform.x = platform.maxX!;
      platform.vx = -Math.abs(platform.vx!);
    }
  }
}

export function maintainPlatforms(state: GameState): void {
  const bottomLimit = state.cameraY + CONFIG.height + 120;
  state.platforms = state.platforms.filter((platform) => platform.y < bottomLimit);

  const targetTop = state.cameraY - CONFIG.height;
  generatePlatformsUntil(state, targetTop);
}
