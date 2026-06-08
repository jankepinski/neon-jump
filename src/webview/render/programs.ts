import { createProgram, getUniformLocations } from '../gl/program';
import { SHADERS } from '../shaders';

export interface Programs {
  scene: WebGLProgram;
  bg: WebGLProgram;
  bright: WebGLProgram;
  blur: WebGLProgram;
  composite: WebGLProgram;
}

export interface Uniforms {
  scene: Record<string, WebGLUniformLocation | null>;
  bg: Record<string, WebGLUniformLocation | null>;
  bright: Record<string, WebGLUniformLocation | null>;
  blur: Record<string, WebGLUniformLocation | null>;
  composite: Record<string, WebGLUniformLocation | null>;
}

export function buildPrograms(gl: WebGL2RenderingContext): { programs: Programs; uniforms: Uniforms } {
  const programs: Programs = {
    scene: createProgram(gl, SHADERS.sceneVS, SHADERS.sceneFS),
    bg: createProgram(gl, SHADERS.fullscreenVS, SHADERS.bgFS),
    bright: createProgram(gl, SHADERS.fullscreenVS, SHADERS.brightFS),
    blur: createProgram(gl, SHADERS.fullscreenVS, SHADERS.blurFS),
    composite: createProgram(gl, SHADERS.fullscreenVS, SHADERS.compositeFS)
  };

  const uniforms: Uniforms = {
    scene: getUniformLocations(gl, programs.scene, ['u_resolution', 'u_time', 'u_mode']),
    bg: getUniformLocations(gl, programs.bg, [
      'u_resolution',
      'u_time',
      'u_cameraY',
      'u_scoreTex',
      'u_scoreActive',
      'u_scoreHot'
    ]),
    bright: getUniformLocations(gl, programs.bright, ['u_scene', 'u_threshold']),
    blur: getUniformLocations(gl, programs.blur, ['u_tex', 'u_texel', 'u_dir']),
    composite: getUniformLocations(gl, programs.composite, [
      'u_scene',
      'u_bloom',
      'u_resolution',
      'u_time',
      'u_bloomStrength',
      'u_flash',
      'u_exposure',
      'u_vignette',
      'u_scanline',
      'u_aberration',
      'u_curvature'
    ])
  };

  return { programs, uniforms };
}
