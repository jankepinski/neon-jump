import fullscreenVS from './fullscreen.vert.glsl';
import sceneVS from './scene.vert.glsl';
import sceneFS from './scene.frag.glsl';
import bgFS from './background.frag.glsl';
import brightFS from './bright.frag.glsl';
import blurFS from './blur.frag.glsl';
import compositeFS from './composite.frag.glsl';

export const SHADERS = { fullscreenVS, sceneVS, sceneFS, bgFS, brightFS, blurFS, compositeFS };
