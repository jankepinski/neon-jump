import { CONFIG } from './config';
import { clamp } from './math';
import type { FxState, GameState, ViewModel, VisualRect } from '../types';

export function buildVisualPlayer(state: GameState, fx: FxState): VisualRect {
  const p = state.player;
  const stretch = clamp(1 + -p.vy * 0.004, 0.86, 1.18);
  let sy = stretch;
  let sx = 1 / Math.sqrt(stretch);

  sx *= 1 + 0.28 * fx.squashImpulse;
  sy *= 1 - 0.22 * fx.squashImpulse;

  const width = p.width * sx;
  const height = p.height * sy;

  return {
    x: p.x + (p.width - width) / 2,
    y: p.y + (p.height - height),
    width,
    height
  };
}

export function buildViewModel(state: GameState, fx: FxState, timeSec: number): ViewModel {
  return {
    logicalWidth: CONFIG.width,
    logicalHeight: CONFIG.height,
    cameraY: fx.renderCameraY,
    time: timeSec,
    flash: fx.flash,
    shakeX: fx.shakeX,
    shakeY: fx.shakeY,
    fragileHits: CONFIG.fragileHits,
    score: String(state.score).padStart(Math.max(3, String(state.score).length), '0'),
    scoreActive: state.mode === 'playing',
    record: state.score > state.highScore,
    platforms: state.platforms,
    player: buildVisualPlayer(state, fx),
    trail: fx.trail,
    particles: fx.particles
  };
}
