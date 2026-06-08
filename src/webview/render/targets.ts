import type { GlCaps } from '../gl/context';
import { createFBO, type GlTarget } from '../gl/framebuffer';
import { settings } from './settings';

export interface RenderTargets {
  sceneTarget: GlTarget | null;
  bloomA: GlTarget | null;
  bloomB: GlTarget | null;
  bufferWidth: number;
  bufferHeight: number;
  resize(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, caps: GlCaps): void;
  destroy(gl: WebGL2RenderingContext): void;
}

export function createRenderTargets(): RenderTargets {
  let sceneTarget: GlTarget | null = null;
  let bloomA: GlTarget | null = null;
  let bloomB: GlTarget | null = null;
  let bufferWidth = 0;
  let bufferHeight = 0;

  function createTargets(gl: WebGL2RenderingContext, caps: GlCaps, width: number, height: number): void {
    sceneTarget = createFBO(gl, caps, width, height, { float: true });
    const bw = Math.max(1, Math.floor(width / 2));
    const bh = Math.max(1, Math.floor(height / 2));
    bloomA = createFBO(gl, caps, bw, bh, { float: true });
    bloomB = createFBO(gl, caps, bw, bh, { float: true });
  }

  function destroyTargets(gl: WebGL2RenderingContext): void {
    if (!sceneTarget) {
      return;
    }
    for (const target of [sceneTarget, bloomA, bloomB]) {
      if (target) {
        gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.fbo);
      }
    }
    sceneTarget = null;
    bloomA = null;
    bloomB = null;
  }

  return {
    get sceneTarget() {
      return sceneTarget;
    },
    get bloomA() {
      return bloomA;
    },
    get bloomB() {
      return bloomB;
    },
    get bufferWidth() {
      return bufferWidth;
    },
    get bufferHeight() {
      return bufferHeight;
    },
    resize(canvas, gl, caps) {
      const dpr = Math.min(window.devicePixelRatio || 1, settings.maxDpr);
      const cssWidth = canvas.clientWidth || canvas.width;
      const cssHeight = canvas.clientHeight || canvas.height;
      const width = Math.max(1, Math.floor(cssWidth * dpr));
      const height = Math.max(1, Math.floor(cssHeight * dpr));

      if (width === bufferWidth && height === bufferHeight) {
        return;
      }

      canvas.width = width;
      canvas.height = height;
      bufferWidth = width;
      bufferHeight = height;

      destroyTargets(gl);
      createTargets(gl, caps, width, height);
    },
    destroy(gl) {
      destroyTargets(gl);
    }
  };
}
