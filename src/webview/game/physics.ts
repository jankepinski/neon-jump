import { CONFIG } from './config';
import { handlePlatformBounce, onBounce } from './effects';
import type { FxState, GameState } from '../types';

export function stepPlayer(state: GameState, timeScale: number): void {
  const player = state.player;
  player.previousY = player.y;

  const direction = Number(state.keys.right) - Number(state.keys.left);
  player.vx = direction * CONFIG.moveSpeed;
  player.vy += CONFIG.gravity * timeScale;
  player.x += player.vx * timeScale;
  player.y += player.vy * timeScale;
}

export function wrapPlayer(state: GameState): void {
  const player = state.player;

  if (player.x + player.width < 0) {
    player.x = CONFIG.width;
  } else if (player.x > CONFIG.width) {
    player.x = -player.width;
  }
}

export function collideWithPlatforms(state: GameState, fx: FxState): void {
  const player = state.player;

  if (player.vy <= 0) {
    return;
  }

  const previousBottom = player.previousY + player.height;
  const currentBottom = player.y + player.height;

  for (const platform of state.platforms) {
    const overlapsX =
      player.x + player.width > platform.x &&
      player.x < platform.x + platform.width;

    const crossesTop =
      previousBottom <= platform.y &&
      currentBottom >= platform.y;

    if (overlapsX && crossesTop) {
      player.y = platform.y - player.height;
      player.vy = CONFIG.jumpVelocity;
      onBounce(state, fx, platform);
      handlePlatformBounce(state, fx, platform);
      return;
    }
  }
}

export function updateCameraAndScore(state: GameState): void {
  const player = state.player;
  const cameraThreshold = state.cameraY + CONFIG.height * 0.4;

  if (player.y < cameraThreshold) {
    state.cameraY = player.y - CONFIG.height * 0.4;
  }

  if (player.y < state.highestY) {
    state.highestY = player.y;
    state.score = Math.max(0, Math.floor((CONFIG.height - 140 - state.highestY) / 10));
  }
}
