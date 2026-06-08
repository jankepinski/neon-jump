import { bindTarget } from '../gl/framebuffer';
import type { Platform, ViewModel } from '../types';
import type { RendererContext } from './context';
import {
  fragileColor,
  fragileGlow,
  fragileWhite,
  GLOW,
  KIND,
  PALETTE,
  WHITE
} from './palette';

function pushPlatform(
  ctx: RendererContext,
  platform: Platform,
  scaleX: number,
  scaleY: number,
  cameraY: number,
  shakeX: number,
  shakeY: number,
  fragileHits: number
): void {
  const { batcher } = ctx;
  const sx = platform.x * scaleX + shakeX;
  const sy = (platform.y - cameraY) * scaleY + shakeY;
  const sw = platform.width * scaleX;
  const sh = platform.height * scaleY;
  const radius = Math.min(sh * 0.5, 7 * scaleY);
  const seed = platform.x * 0.013 + platform.y * 0.017;

  if (platform.type === 'moving') {
    const c = PALETTE.moving;
    batcher.push(sx, sy, sw, sh, c[0], c[1], c[2], GLOW.moving, radius, KIND.moving, seed, 0, WHITE.moving);
    return;
  }

  if (platform.type === 'fragile' && platform.hitsLeft !== null) {
    const c = fragileColor(platform.hitsLeft);
    const damage = 1 - platform.hitsLeft / fragileHits;
    batcher.push(
      sx,
      sy,
      sw,
      sh,
      c[0],
      c[1],
      c[2],
      fragileGlow(platform.hitsLeft),
      radius,
      KIND.fragile,
      seed,
      damage,
      fragileWhite(platform.hitsLeft)
    );
    return;
  }

  const c = PALETTE.normal;
  batcher.push(sx, sy, sw, sh, c[0], c[1], c[2], GLOW.normal, radius, KIND.normal, seed, 0, WHITE.normal);
}

export function renderScene(ctx: RendererContext, vm: ViewModel): void {
  const { gl, programs, uniforms, quad, batcher, targets, scoreTexture } = ctx;
  const sceneTarget = targets.sceneTarget;
  if (!sceneTarget) {
    return;
  }

  const scaleX = targets.bufferWidth / vm.logicalWidth;
  const scaleY = targets.bufferHeight / vm.logicalHeight;
  const shakeX = (vm.shakeX || 0) * scaleX;
  const shakeY = (vm.shakeY || 0) * scaleY;
  const cameraY = vm.cameraY;

  bindTarget(gl, sceneTarget);
  gl.disable(gl.BLEND);

  const scoreActive = vm.scoreActive ? 1 : 0;
  if (scoreActive) {
    scoreTexture.update(vm.score || '');
  }

  gl.useProgram(programs.bg);
  gl.uniform2f(uniforms.bg.u_resolution, targets.bufferWidth, targets.bufferHeight);
  gl.uniform1f(uniforms.bg.u_time, vm.time);
  gl.uniform1f(uniforms.bg.u_cameraY, cameraY);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, scoreTexture.texture);
  gl.uniform1i(uniforms.bg.u_scoreTex, 0);
  gl.uniform1f(uniforms.bg.u_scoreActive, scoreActive);
  gl.uniform1f(uniforms.bg.u_scoreHot, vm.record ? 1 : 0);
  quad.draw();

  gl.enable(gl.BLEND);

  gl.useProgram(programs.scene);
  gl.uniform2f(uniforms.scene.u_resolution, targets.bufferWidth, targets.bufferHeight);
  gl.uniform1f(uniforms.scene.u_time, vm.time);

  batcher.begin();

  for (const platform of vm.platforms) {
    pushPlatform(ctx, platform, scaleX, scaleY, cameraY, shakeX, shakeY, vm.fragileHits);
  }

  if (vm.trail) {
    for (const t of vm.trail) {
      const sx = t.x * scaleX + shakeX;
      const sy = (t.y - cameraY) * scaleY + shakeY;
      const sw = t.width * scaleX;
      const sh = t.height * scaleY;
      const radius = Math.min(sw, sh) * 0.5;
      // Dimmed player color so the trail reads as a darker echo behind the player.
      const trailDim = 0.6;
      const c = PALETTE.player;
      batcher.push(sx, sy, sw, sh, c[0] * trailDim, c[1] * trailDim, c[2] * trailDim, 1.0, radius, KIND.trail, 0, t.alpha, 0);
    }
  }

  if (vm.particles) {
    for (const p of vm.particles) {
      const sx = (p.x - p.size / 2) * scaleX + shakeX;
      const sy = (p.y - p.size / 2 - cameraY) * scaleY + shakeY;
      const s = p.size * scaleX;
      batcher.push(sx, sy, s, s, p.r, p.g, p.b, 1.4, s * 0.5, KIND.particle, 0, p.alpha, 0);
    }
  }

  if (vm.player) {
    const pl = vm.player;
    const sx = pl.x * scaleX + shakeX;
    const sy = (pl.y - cameraY) * scaleY + shakeY;
    const sw = pl.width * scaleX;
    const sh = pl.height * scaleY;
    const radius = Math.min(sw, sh) * 0.32;
    const c = PALETTE.player;
    batcher.push(sx, sy, sw, sh, c[0], c[1], c[2], GLOW.player, radius, KIND.player, 0, 0, WHITE.player);
  }

  batcher.upload();

  gl.uniform1f(uniforms.scene.u_mode, 1);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  batcher.draw();

  gl.uniform1f(uniforms.scene.u_mode, 0);
  gl.blendFunc(gl.ONE, gl.ONE);
  batcher.draw();

  gl.disable(gl.BLEND);
}
