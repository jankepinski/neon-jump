export interface GlCaps {
  floatColor: boolean;
  floatLinear: boolean;
}

export interface GlContext {
  gl: WebGL2RenderingContext;
  caps: GlCaps;
}

export function init(canvas: HTMLCanvasElement): GlContext | null {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance'
  });

  if (!gl) {
    return null;
  }

  const caps: GlCaps = {
    floatColor: !!gl.getExtension('EXT_color_buffer_float'),
    floatLinear: !!gl.getExtension('OES_texture_float_linear')
  };

  return { gl, caps };
}
