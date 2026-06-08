import { bindScreen } from '../gl/framebuffer';
import type { GlTarget } from '../gl/framebuffer';
import type { ViewModel } from '../types';
import type { RendererContext } from './context';

export function renderComposite(ctx: RendererContext, vm: ViewModel, bloomResult: GlTarget): void {
  const { gl, programs, uniforms, quad, targets, settings } = ctx;
  const sceneTarget = targets.sceneTarget;
  if (!sceneTarget) {
    return;
  }

  const bloomActive = settings.bloomEnabled && settings.bloomIterations > 0;

  bindScreen(gl, targets.bufferWidth, targets.bufferHeight);
  gl.useProgram(programs.composite);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sceneTarget.texture);
  gl.uniform1i(uniforms.composite.u_scene, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, bloomResult.texture);
  gl.uniform1i(uniforms.composite.u_bloom, 1);
  gl.uniform2f(uniforms.composite.u_resolution, targets.bufferWidth, targets.bufferHeight);
  gl.uniform1f(uniforms.composite.u_time, vm.time);
  gl.uniform1f(
    uniforms.composite.u_bloomStrength,
    bloomActive ? settings.bloomStrength : 0
  );
  gl.uniform1f(uniforms.composite.u_flash, vm.flash || 0);
  gl.uniform1f(uniforms.composite.u_exposure, settings.exposure);
  gl.uniform1f(uniforms.composite.u_vignette, settings.vignette);
  gl.uniform1f(uniforms.composite.u_scanline, settings.scanline);
  gl.uniform1f(uniforms.composite.u_aberration, settings.aberration);
  gl.uniform1f(uniforms.composite.u_curvature, settings.curvature);
  quad.draw();
}
