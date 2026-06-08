import { bindTarget, type GlTarget } from '../gl/framebuffer';
import type { RendererContext } from './context';

export function renderBloom(ctx: RendererContext): GlTarget {
  const { gl, programs, uniforms, quad, targets, settings } = ctx;
  const sceneTarget = targets.sceneTarget;
  const bloomA = targets.bloomA;
  const bloomB = targets.bloomB;

  if (!sceneTarget || !bloomA || !bloomB) {
    return bloomB ?? bloomA!;
  }

  bindTarget(gl, bloomA);
  gl.useProgram(programs.bright);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sceneTarget.texture);
  gl.uniform1i(uniforms.bright.u_scene, 0);
  gl.uniform1f(uniforms.bright.u_threshold, settings.bloomThreshold);
  quad.draw();

  gl.useProgram(programs.blur);
  gl.uniform1i(uniforms.blur.u_tex, 0);
  const texelX = 1 / bloomA.width;
  const texelY = 1 / bloomA.height;

  let src: GlTarget = bloomA;
  let dst: GlTarget = bloomB;

  for (let i = 0; i < settings.bloomIterations; i += 1) {
    bindTarget(gl, dst);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.texture);
    gl.uniform2f(uniforms.blur.u_texel, texelX, texelY);
    gl.uniform2f(uniforms.blur.u_dir, 1, 0);
    quad.draw();

    let tmp = src;
    src = dst;
    dst = tmp;

    bindTarget(gl, dst);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.texture);
    gl.uniform2f(uniforms.blur.u_texel, texelX, texelY);
    gl.uniform2f(uniforms.blur.u_dir, 0, 1);
    quad.draw();

    tmp = src;
    src = dst;
    dst = tmp;
  }

  return src;
}
