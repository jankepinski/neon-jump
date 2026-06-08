import { CONFIG } from './config';
import type { FxState, GameState } from '../types';

export function createInitialState(highScore: number): GameState {
  return {
    mode: 'ready',
    score: 0,
    highScore: Number(highScore) || 0,
    cameraY: 0,
    highestY: 0,
    lastGeneratedRowY: 0,
    lastRowWasEmpty: false,
    keys: {
      left: false,
      right: false
    },
    player: {
      x: CONFIG.width / 2 - CONFIG.playerWidth / 2,
      y: CONFIG.height - 140,
      previousY: CONFIG.height - 140,
      vx: 0,
      vy: 0,
      width: CONFIG.playerWidth,
      height: CONFIG.playerHeight
    },
    platforms: []
  };
}

export function createFxState(): FxState {
  return {
    trail: [],
    particles: [],
    flash: 0,
    shakeMag: 0,
    shakeX: 0,
    shakeY: 0,
    squashImpulse: 0,
    renderCameraY: 0
  };
}
