import type { GlCaps } from '../gl/context';
import type { FullscreenQuad } from '../gl/fullscreenQuad';
import type { QuadBatcher } from '../gl/quadBatcher';
import type { Programs, Uniforms } from './programs';
import type { RenderTargets } from './targets';
import type { ScoreTexture } from './scoreTexture';
import type { RenderSettings } from './settings';

export interface RendererContext {
  gl: WebGL2RenderingContext;
  caps: GlCaps;
  canvas: HTMLCanvasElement;
  programs: Programs;
  uniforms: Uniforms;
  quad: FullscreenQuad;
  batcher: QuadBatcher;
  targets: RenderTargets;
  scoreTexture: ScoreTexture;
  settings: RenderSettings;
}
