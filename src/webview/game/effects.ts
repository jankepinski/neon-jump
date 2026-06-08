import { colorForType, MAX_PARTICLES, PARTICLE_COLORS, RgbColor } from './config';
import { clamp, randomBetween } from './math';
import type { FxState, GameState, Platform } from '../types';

export interface SpawnParticleOptions {
  speedScale?: number;
  upwardBias?: number;
}

export function spawnParticles(
  fx: FxState,
  x: number,
  y: number,
  count: number,
  color: RgbColor,
  options: SpawnParticleOptions = {}
): void {
  const speedScale = options.speedScale || 1;
  const upwardBias = options.upwardBias ?? 1.6;

  for (let i = 0; i < count; i += 1) {
    if (fx.particles.length >= MAX_PARTICLES) {
      break;
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(1.2, 4.4) * speedScale;
    const life = randomBetween(18, 38);

    fx.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - upwardBias,
      life,
      maxLife: life,
      size: randomBetween(3, 7),
      alpha: 1,
      r: color[0],
      g: color[1],
      b: color[2]
    });
  }
}

export function addShake(fx: FxState, magnitude: number): void {
  fx.shakeMag = Math.max(fx.shakeMag, magnitude);
}

export function onBounce(state: GameState, fx: FxState, platform: Platform): void {
  fx.flash = Math.min(1, fx.flash + 0.8);
  addShake(fx, 4.5);
  fx.squashImpulse = 1;

  const centerX = state.player.x + state.player.width / 2;
  spawnParticles(fx, centerX, platform.y, 10, colorForType(platform), { speedScale: 0.9 });
}

export function handlePlatformBounce(state: GameState, fx: FxState, platform: Platform): void {
  if (platform.type !== 'fragile') {
    return;
  }

  platform.hitsLeft! -= 1;

  if (platform.hitsLeft! <= 0) {
    const centerX = platform.x + platform.width / 2;
    const centerY = platform.y + platform.height / 2;
    spawnParticles(fx, centerX, centerY, 24, PARTICLE_COLORS.fragileBreak, {
      speedScale: 1.5,
      upwardBias: 0
    });
    addShake(fx, 7);
    fx.flash = Math.min(1, fx.flash + 0.4);
    state.platforms = state.platforms.filter((candidate) => candidate !== platform);
  }
}

export function updateFx(fx: FxState, timeScale: number): void {
  fx.flash = Math.max(0, fx.flash - 0.05 * timeScale);
  fx.squashImpulse = Math.max(0, fx.squashImpulse - 0.08 * timeScale);

  fx.shakeMag *= Math.pow(0.85, timeScale);
  if (fx.shakeMag < 0.05) {
    fx.shakeMag = 0;
  }
  fx.shakeX = (Math.random() * 2 - 1) * fx.shakeMag;
  fx.shakeY = (Math.random() * 2 - 1) * fx.shakeMag;

  for (let i = 0; i < fx.trail.length; i += 1) {
    fx.trail[i].alpha *= Math.pow(0.86, timeScale);
  }

  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const p = fx.particles[i];
    p.x += p.vx * timeScale;
    p.y += p.vy * timeScale;
    p.vy += 0.12 * timeScale;
    p.life -= timeScale;

    if (p.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }

    p.alpha = clamp(p.life / p.maxLife, 0, 1);
  }
}
