import type { GlCaps } from './context';

export interface TextureOptions {
  float?: boolean;
  filter?: 'nearest' | 'linear';
}

interface ColorTypeDesc {
  internalFormat: number;
  format: number;
  type: number;
  linear: boolean;
}

function pickColorType(gl: WebGL2RenderingContext, caps: GlCaps, wantFloat: boolean): ColorTypeDesc {
  if (wantFloat && caps.floatColor) {
    return {
      internalFormat: gl.RGBA16F,
      format: gl.RGBA,
      type: gl.HALF_FLOAT,
      linear: caps.floatLinear
    };
  }
  return {
    internalFormat: gl.RGBA8,
    format: gl.RGBA,
    type: gl.UNSIGNED_BYTE,
    linear: true
  };
}

export function createTexture(
  gl: WebGL2RenderingContext,
  caps: GlCaps,
  width: number,
  height: number,
  options?: TextureOptions
): WebGLTexture {
  const opts = options ?? {};
  const desc = pickColorType(gl, caps, !!opts.float);
  const filter = opts.filter === 'nearest' || !desc.linear ? gl.NEAREST : gl.LINEAR;

  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Failed to create texture');
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    desc.internalFormat,
    width,
    height,
    0,
    desc.format,
    desc.type,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}
