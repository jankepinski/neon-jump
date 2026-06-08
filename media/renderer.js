// Neon WebGL renderer: scene pass (synthwave background + additive SDF
// entities) -> HDR bloom (bright pass + separable blur ping-pong) ->
// composite with chromatic aberration, CRT curvature, scanlines, vignette and
// grain. Exposes window.NeonRenderer.

(function () {
  'use strict';

  const KIND = {
    normal: 0,
    fragile: 1,
    moving: 2,
    player: 3,
    particle: 4,
    trail: 5
  };

  const PALETTE = {
    normal: [0.15, 0.92, 1.0],
    movingTrack: [0.12, 0.7, 0.45],
    moving: [0.25, 1.0, 0.55],
    player: [1.0, 0.32, 0.72],
    fragile3: [0.76, 0.52, 1.0],
    fragile2: [0.99, 0.6, 0.26],
    fragile1: [0.96, 0.28, 0.32]
  };

  // Per-element neon glow intensity (fixed look, not exposed in the UI).
  const GLOW = {
    normal: 1.1,
    movingTrack: 0.6,
    moving: 1.3,
    player: 1.3,
    fragile3: 1.3,
    fragile2: 1.3,
    fragile1: 1.3
  };

  // Per-element white-core amount (0 = pure color center, 1 = white-hot center).
  const WHITE = {
    normal: 0,
    movingTrack: 0,
    moving: 0,
    player: 0.4,
    fragile3: 0,
    fragile2: 0,
    fragile1: 0
  };

  // Rendering settings (hardcoded; tuned for a clear neon look).
  const settings = {
    bloomEnabled: true,
    bloomIterations: 5,
    bloomThreshold: 0.66,
    bloomStrength: 1.33,
    exposure: 1.48,
    vignette: 0.65,
    scanline: 0.5,
    aberration: 0.001,
    curvature: 0.03,
    maxDpr: 2
  };

  let gl = null;
  let caps = null;
  let canvas = null;

  let programs = null;
  let uniforms = null;
  let quad = null;
  let batcher = null;

  let sceneTarget = null;
  let bloomA = null;
  let bloomB = null;

  let bufferWidth = 0;
  let bufferHeight = 0;

  // Offscreen score digits, rasterized to a 2D canvas and uploaded as a texture
  // so the background shader can bake them into the sun.
  let scoreCanvas = null;
  let scoreCtx = null;
  let scoreTexture = null;
  let lastScoreText = null;

  function buildPrograms() {
    const S = window.SHADERS;
    programs = {
      scene: window.GLCore.createProgram(gl, S.sceneVS, S.sceneFS),
      bg: window.GLCore.createProgram(gl, S.fullscreenVS, S.bgFS),
      bright: window.GLCore.createProgram(gl, S.fullscreenVS, S.brightFS),
      blur: window.GLCore.createProgram(gl, S.fullscreenVS, S.blurFS),
      composite: window.GLCore.createProgram(gl, S.fullscreenVS, S.compositeFS)
    };

    uniforms = {
      scene: window.GLCore.getUniformLocations(gl, programs.scene, [
        'u_resolution',
        'u_time',
        'u_mode'
      ]),
      bg: window.GLCore.getUniformLocations(gl, programs.bg, [
        'u_resolution',
        'u_time',
        'u_cameraY',
        'u_scoreTex',
        'u_scoreActive',
        'u_scoreHot'
      ]),
      bright: window.GLCore.getUniformLocations(gl, programs.bright, [
        'u_scene',
        'u_threshold'
      ]),
      blur: window.GLCore.getUniformLocations(gl, programs.blur, [
        'u_tex',
        'u_texel',
        'u_dir'
      ]),
      composite: window.GLCore.getUniformLocations(gl, programs.composite, [
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
  }

  function createTargets(width, height) {
    sceneTarget = window.GLCore.createFBO(gl, caps, width, height, { float: true });
    const bw = Math.max(1, Math.floor(width / 2));
    const bh = Math.max(1, Math.floor(height / 2));
    bloomA = window.GLCore.createFBO(gl, caps, bw, bh, { float: true });
    bloomB = window.GLCore.createFBO(gl, caps, bw, bh, { float: true });
  }

  function destroyTargets() {
    if (!sceneTarget) {
      return;
    }
    for (const target of [sceneTarget, bloomA, bloomB]) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.fbo);
    }
    sceneTarget = null;
    bloomA = null;
    bloomB = null;
  }

  function init(targetCanvas) {
    canvas = targetCanvas;
    const context = window.GLCore.init(canvas);
    if (!context) {
      return false;
    }

    gl = context.gl;
    caps = context.caps;

    buildPrograms();
    quad = window.GLCore.createFullscreenQuad(gl);
    batcher = window.GLCore.createQuadBatcher(gl, 4096);
    createScoreTexture();

    resize();
    return true;
  }

  function createScoreTexture() {
    scoreCanvas = document.createElement('canvas');
    scoreCanvas.width = 256;
    scoreCanvas.height = 256;
    scoreCtx = scoreCanvas.getContext('2d');

    scoreTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, scoreTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  // Re-rasterize the digits only when the text changes, then upload to the GPU.
  function updateScoreTexture(text) {
    if (text === lastScoreText) {
      return;
    }
    lastScoreText = text;

    const ctx = scoreCtx;
    const size = scoreCanvas.width; // square canvas
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Scale the font so the whole string spans 80% of the (square) canvas width,
    // which maps to 80% of the sun's width regardless of digit count.
    const FONT = (px) => `700 ${px}px ui-monospace, "Cascadia Code", Consolas, monospace`;
    const REF = 100;
    ctx.font = FONT(REF);
    const naturalW = ctx.measureText(text).width;
    const targetW = 0.8 * size;
    const fontSize = REF * (targetW / Math.max(naturalW, 1));
    ctx.font = FONT(fontSize);
    ctx.fillText(text, size / 2, size / 2);

    gl.bindTexture(gl.TEXTURE_2D, scoreTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scoreCanvas);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  function resize() {
    if (!gl) {
      return;
    }

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

    destroyTargets();
    createTargets(width, height);
  }

  function fragileColor(hitsLeft) {
    if (hitsLeft >= 3) {
      return PALETTE.fragile3;
    }
    if (hitsLeft === 2) {
      return PALETTE.fragile2;
    }
    return PALETTE.fragile1;
  }

  function fragileGlow(hitsLeft) {
    if (hitsLeft >= 3) {
      return GLOW.fragile3;
    }
    if (hitsLeft === 2) {
      return GLOW.fragile2;
    }
    return GLOW.fragile1;
  }

  function fragileWhite(hitsLeft) {
    if (hitsLeft >= 3) {
      return WHITE.fragile3;
    }
    if (hitsLeft === 2) {
      return WHITE.fragile2;
    }
    return WHITE.fragile1;
  }

  function pushPlatform(platform, scaleX, scaleY, cameraY, shakeX, shakeY, fragileHits) {
    const sx = platform.x * scaleX + shakeX;
    const sy = (platform.y - cameraY) * scaleY + shakeY;
    const sw = platform.width * scaleX;
    const sh = platform.height * scaleY;
    const radius = Math.min(sh * 0.5, 7 * scaleY);
    const seed = platform.x * 0.013 + platform.y * 0.017;

    if (platform.type === 'moving') {
      const c = PALETTE.moving;
      batcher.push(sx, sy, sw, sh, c[0], c[1], c[2], GLOW.moving, radius, KIND.moving, seed, 0, WHITE.moving);
      return;
    }

    if (platform.type === 'fragile') {
      const c = fragileColor(platform.hitsLeft);
      const damage = 1 - platform.hitsLeft / fragileHits;
      batcher.push(sx, sy, sw, sh, c[0], c[1], c[2], fragileGlow(platform.hitsLeft), radius, KIND.fragile, seed, damage, fragileWhite(platform.hitsLeft));
      return;
    }

    const c = PALETTE.normal;
    batcher.push(sx, sy, sw, sh, c[0], c[1], c[2], GLOW.normal, radius, KIND.normal, seed, 0, WHITE.normal);
  }

  function renderFrame(vm) {
    if (!gl) {
      return;
    }

    resize();

    const scaleX = bufferWidth / vm.logicalWidth;
    const scaleY = bufferHeight / vm.logicalHeight;
    const shakeX = (vm.shakeX || 0) * scaleX;
    const shakeY = (vm.shakeY || 0) * scaleY;
    const cameraY = vm.cameraY;

    // --- Scene pass ---
    window.GLCore.bindTarget(gl, sceneTarget);
    gl.disable(gl.BLEND);

    const scoreActive = vm.scoreActive ? 1 : 0;
    if (scoreActive) {
      updateScoreTexture(vm.score || '');
    }

    gl.useProgram(programs.bg);
    gl.uniform2f(uniforms.bg.u_resolution, bufferWidth, bufferHeight);
    gl.uniform1f(uniforms.bg.u_time, vm.time);
    gl.uniform1f(uniforms.bg.u_cameraY, cameraY);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scoreTexture);
    gl.uniform1i(uniforms.bg.u_scoreTex, 0);
    gl.uniform1f(uniforms.bg.u_scoreActive, scoreActive);
    gl.uniform1f(uniforms.bg.u_scoreHot, vm.record ? 1 : 0);
    quad.draw();

    gl.enable(gl.BLEND);

    gl.useProgram(programs.scene);
    gl.uniform2f(uniforms.scene.u_resolution, bufferWidth, bufferHeight);
    gl.uniform1f(uniforms.scene.u_time, vm.time);

    batcher.begin();

    for (const platform of vm.platforms) {
      pushPlatform(platform, scaleX, scaleY, cameraY, shakeX, shakeY, vm.fragileHits);
    }

    if (vm.trail) {
      for (const t of vm.trail) {
        const sx = t.x * scaleX + shakeX;
        const sy = (t.y - cameraY) * scaleY + shakeY;
        const sw = t.width * scaleX;
        const sh = t.height * scaleY;
        const radius = Math.min(sw, sh) * 0.5;
        const c = PALETTE.player;
        batcher.push(sx, sy, sw, sh, c[0], c[1], c[2], 1.0, radius, KIND.trail, 0, t.alpha, 0);
      }
    }

    if (vm.particles) {
      for (const p of vm.particles) {
        const sx = (p.x - p.size / 2) * scaleX + shakeX;
        const sy = (p.y - p.size / 2 - cameraY) * scaleY + shakeY;
        const s = p.size * scaleX;
        batcher.push(sx, sy, s, s, p.r, p.g, p.b, 1.4, s * 0.5, KIND.particle, 0, p.alpha, 0);
      }
    }

    if (vm.player) {
      const pl = vm.player;
      const sx = pl.x * scaleX + shakeX;
      const sy = (pl.y - cameraY) * scaleY + shakeY;
      const sw = pl.width * scaleX;
      const sh = pl.height * scaleY;
      const radius = Math.min(sw, sh) * 0.32;
      const c = PALETTE.player;
      batcher.push(sx, sy, sw, sh, c[0], c[1], c[2], GLOW.player, radius, KIND.player, 0, 0, WHITE.player);
    }

    batcher.upload();

    // Backing pass: dark soft boxes blended toward black, so each entity carves
    // a contrast outline out of the bright background behind it.
    gl.uniform1f(uniforms.scene.u_mode, 1);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    batcher.draw();

    // Neon pass: additive emission on top of the darkened backing.
    gl.uniform1f(uniforms.scene.u_mode, 0);
    gl.blendFunc(gl.ONE, gl.ONE);
    batcher.draw();

    gl.disable(gl.BLEND);

    const bloomActive = settings.bloomEnabled && settings.bloomIterations > 0;
    let bloomResult = bloomB;

    if (bloomActive) {
      // --- Bright pass ---
      window.GLCore.bindTarget(gl, bloomA);
      gl.useProgram(programs.bright);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTarget.texture);
      gl.uniform1i(uniforms.bright.u_scene, 0);
      gl.uniform1f(uniforms.bright.u_threshold, settings.bloomThreshold);
      quad.draw();

      // --- Blur ping-pong ---
      gl.useProgram(programs.blur);
      gl.uniform1i(uniforms.blur.u_tex, 0);
      const texelX = 1 / bloomA.width;
      const texelY = 1 / bloomA.height;

      let src = bloomA;
      let dst = bloomB;
      for (let i = 0; i < settings.bloomIterations; i += 1) {
        // Horizontal.
        window.GLCore.bindTarget(gl, dst);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src.texture);
        gl.uniform2f(uniforms.blur.u_texel, texelX, texelY);
        gl.uniform2f(uniforms.blur.u_dir, 1, 0);
        quad.draw();

        let tmp = src;
        src = dst;
        dst = tmp;

        // Vertical.
        window.GLCore.bindTarget(gl, dst);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src.texture);
        gl.uniform2f(uniforms.blur.u_texel, texelX, texelY);
        gl.uniform2f(uniforms.blur.u_dir, 0, 1);
        quad.draw();

        tmp = src;
        src = dst;
        dst = tmp;
      }

      bloomResult = src;
    }

    // --- Composite to screen ---
    window.GLCore.bindScreen(gl, bufferWidth, bufferHeight);
    gl.useProgram(programs.composite);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTarget.texture);
    gl.uniform1i(uniforms.composite.u_scene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloomResult.texture);
    gl.uniform1i(uniforms.composite.u_bloom, 1);
    gl.uniform2f(uniforms.composite.u_resolution, bufferWidth, bufferHeight);
    gl.uniform1f(uniforms.composite.u_time, vm.time);
    gl.uniform1f(uniforms.composite.u_bloomStrength, bloomActive ? settings.bloomStrength : 0);
    gl.uniform1f(uniforms.composite.u_flash, vm.flash || 0);
    gl.uniform1f(uniforms.composite.u_exposure, settings.exposure);
    gl.uniform1f(uniforms.composite.u_vignette, settings.vignette);
    gl.uniform1f(uniforms.composite.u_scanline, settings.scanline);
    gl.uniform1f(uniforms.composite.u_aberration, settings.aberration);
    gl.uniform1f(uniforms.composite.u_curvature, settings.curvature);
    quad.draw();
  }

  window.NeonRenderer = {
    init,
    resize,
    renderFrame,
    settings
  };
})();
