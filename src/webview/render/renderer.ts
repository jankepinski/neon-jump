import { init } from '../gl/context';
import { createFullscreenQuad } from '../gl/fullscreenQuad';
import { createQuadBatcher } from '../gl/quadBatcher';
import type { ViewModel } from '../types';
import { renderBloom } from './bloomPass';
import { renderComposite } from './compositePass';
import type { RendererContext } from './context';
import { buildPrograms } from './programs';
import { renderScene } from './scenePass';
import { createScoreTexture } from './scoreTexture';
import { settings } from './settings';
import { createRenderTargets } from './targets';

let ctx: RendererContext | null = null;

function initRenderer(canvas: HTMLCanvasElement): boolean {
  const context = init(canvas);
  if (!context) {
    return false;
  }

  const { programs, uniforms } = buildPrograms(context.gl);
  const targets = createRenderTargets();
  const scoreTexture = createScoreTexture(context.gl);

  ctx = {
    gl: context.gl,
    caps: context.caps,
    canvas,
    programs,
    uniforms,
    quad: createFullscreenQuad(context.gl),
    batcher: createQuadBatcher(context.gl, 4096),
    targets,
    scoreTexture,
    settings
  };

  targets.resize(canvas, context.gl, context.caps);
  return true;
}

function resizeRenderer(): void {
  if (!ctx) {
    return;
  }
  ctx.targets.resize(ctx.canvas, ctx.gl, ctx.caps);
}

function renderFrame(vm: ViewModel): void {
  if (!ctx) {
    return;
  }

  ctx.targets.resize(ctx.canvas, ctx.gl, ctx.caps);

  renderScene(ctx, vm);

  const bloomActive = ctx.settings.bloomEnabled && ctx.settings.bloomIterations > 0;
  const bloomResult = bloomActive
    ? renderBloom(ctx)
    : (ctx.targets.bloomB ?? ctx.targets.bloomA!);

  renderComposite(ctx, vm, bloomResult);
}

export const NeonRenderer = {
  init: initRenderer,
  resize: resizeRenderer,
  renderFrame,
  settings
};
