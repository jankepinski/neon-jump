import type { GlCaps } from './context';
import { createTexture, type TextureOptions } from './texture';

export interface GlTarget {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

export function createFBO(
  gl: WebGL2RenderingContext,
  caps: GlCaps,
  width: number,
  height: number,
  options?: TextureOptions
): GlTarget {
  const texture = createTexture(gl, caps, width, height, options);
  const fbo = gl.createFramebuffer();
  if (!fbo) {
    throw new Error('Failed to create framebuffer');
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { fbo, texture, width, height };
}

export function bindTarget(gl: WebGL2RenderingContext, target: GlTarget | null): void {
  if (target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.width, target.height);
  }
}

export function bindScreen(gl: WebGL2RenderingContext, width: number, height: number): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
}
