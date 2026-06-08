import { CONFIG, PARTICLE_COLORS, TRAIL_LENGTH } from './game/config';
import { addShake, spawnParticles, updateFx } from './game/effects';
import { installInput } from './game/input';
import {
  generatePlatformsUntil,
  maintainPlatforms,
  updateMovingPlatforms
} from './game/platforms';
import {
  collideWithPlatforms,
  stepPlayer,
  updateCameraAndScore,
  wrapPlayer
} from './game/physics';
import { createFxState, createInitialState } from './game/state';
import { buildViewModel } from './game/viewModel';
import { NeonRenderer } from './render/renderer';
import type { GameOverMessage } from '../shared/protocol';
import type { FxState, GameState } from './types';

const vscode = acquireVsCodeApi();
const initialState = window.__INITIAL_STATE__ ?? { highScore: 0 };

const state: GameState = createInitialState(initialState.highScore);
const fx: FxState = createFxState();

let rendererReady = false;
let lastFrameTime = performance.now();

const canvas = document.getElementById('game') as HTMLCanvasElement;
const finalScoreEl = document.getElementById('final-score');
const finalBestEl = document.getElementById('final-best');
const resultEl = document.getElementById('result');
const messageEl = document.getElementById('message');
const overlayEl = document.getElementById('overlay');

canvas.focus();
canvas.addEventListener('click', () => canvas.focus());

function resetGame(): void {
  state.score = 0;
  state.cameraY = 0;
  state.highestY = CONFIG.height - 140;
  state.lastGeneratedRowY = CONFIG.height - 80;
  state.lastRowWasEmpty = false;
  state.player.x = CONFIG.width / 2 - CONFIG.playerWidth / 2;
  state.player.y = CONFIG.height - 140;
  state.player.previousY = state.player.y;
  state.player.vx = 0;
  state.player.vy = CONFIG.jumpVelocity;
  state.platforms = [
    {
      x: CONFIG.width / 2 - CONFIG.platformWidth / 2,
      y: CONFIG.height - 80,
      width: CONFIG.platformWidth,
      height: CONFIG.platformHeight,
      type: 'normal',
      hitsLeft: null
    }
  ];

  generatePlatformsUntil(state, -CONFIG.height * 2);

  fx.trail.length = 0;
  fx.particles.length = 0;
  fx.flash = 0;
  fx.shakeMag = 0;
  fx.squashImpulse = 0;
  fx.renderCameraY = state.cameraY;

  if (overlayEl) {
    overlayEl.dataset.mode = 'playing';
  }
  if (messageEl) {
    messageEl.textContent = '';
  }
}

function endGame(): void {
  state.mode = 'gameOver';
  const isRecord = state.score > state.highScore;
  state.highScore = Math.max(state.highScore, state.score);
  addShake(fx, 9);
  fx.flash = Math.min(1, fx.flash + 0.6);
  spawnParticles(
    fx,
    state.player.x + state.player.width / 2,
    state.player.y + state.player.height / 2,
    30,
    PARTICLE_COLORS.fragileBreak,
    { speedScale: 1.6, upwardBias: 0 }
  );

  if (finalScoreEl) {
    finalScoreEl.textContent = String(state.score).padStart(6, '0');
  }
  if (finalBestEl) {
    finalBestEl.textContent = String(state.highScore).padStart(6, '0');
  }
  if (resultEl) {
    resultEl.classList.toggle('record', isRecord);
  }

  if (overlayEl) {
    overlayEl.dataset.mode = 'gameOver';
  }
  if (messageEl) {
    messageEl.textContent = isRecord
      ? 'New best! Press Space to restart'
      : 'Press Space to restart';
  }

  const message: GameOverMessage = {
    type: 'gameOver',
    score: state.score
  };
  vscode.postMessage(message);
}

function update(timeScale: number): void {
  stepPlayer(state, timeScale);
  wrapPlayer(state);

  if (state.player.y + state.player.height - state.cameraY >= CONFIG.height) {
    endGame();
    return;
  }

  updateMovingPlatforms(state, timeScale);
  collideWithPlatforms(state, fx);
  updateCameraAndScore(state);
  maintainPlatforms(state);

  fx.trail.unshift({
    x: state.player.x,
    y: state.player.y,
    width: state.player.width,
    height: state.player.height,
    alpha: 0.5
  });
  if (fx.trail.length > TRAIL_LENGTH) {
    fx.trail.pop();
  }
}

function loop(timestamp: number): void {
  const frameDelta = Math.min(timestamp - lastFrameTime, CONFIG.maxFrameDeltaMs);
  lastFrameTime = timestamp;
  const timeScale = frameDelta / CONFIG.targetFrameMs;

  if (state.mode === 'playing') {
    update(timeScale);
  }

  updateFx(fx, timeScale);
  fx.renderCameraY +=
    (state.cameraY - fx.renderCameraY) * Math.min(1, 0.5 * timeScale);

  if (rendererReady) {
    NeonRenderer.renderFrame(buildViewModel(state, fx, timestamp / 1000));
  }

  requestAnimationFrame(loop);
}

function showFallback(): void {
  if (overlayEl) {
    overlayEl.dataset.mode = 'error';
  }
  if (messageEl) {
    messageEl.textContent = 'WebGL2 is required to play this game.';
  }
}

function boot(): void {
  rendererReady = NeonRenderer.init(canvas);

  if (!rendererReady) {
    showFallback();
    return;
  }

  if (overlayEl) {
    overlayEl.dataset.mode = 'ready';
  }
  requestAnimationFrame(loop);
}

installInput(state, () => {
  resetGame();
  state.mode = 'playing';
});

window.addEventListener('resize', () => {
  if (rendererReady) {
    NeonRenderer.resize();
  }
});

boot();
