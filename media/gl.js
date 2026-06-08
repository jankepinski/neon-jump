// WebGL2 core helpers for the neon renderer.
// Exposes a small toolkit on window.GLCore: context init, shader/program
// compilation, textures, framebuffers, a fullscreen quad and an instanced
// rounded-rect batcher. No external dependencies.

(function () {
  'use strict';

  function init(canvas) {
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

    const caps = {
      floatColor: !!gl.getExtension('EXT_color_buffer_float'),
      floatLinear: !!gl.getExtension('OES_texture_float_linear')
    };

    return { gl, caps };
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile error: ' + log + '\n' + source);
    }

    return shader;
  }

  function createProgram(gl, vsSource, fsSource) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('Program link error: ' + log);
    }

    return program;
  }

  function getUniformLocations(gl, program, names) {
    const map = {};
    for (const name of names) {
      map[name] = gl.getUniformLocation(program, name);
    }
    return map;
  }

  function pickColorType(gl, caps, wantFloat) {
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

  function createTexture(gl, caps, width, height, options) {
    const opts = options || {};
    const desc = pickColorType(gl, caps, opts.float);
    const filter = opts.filter === 'nearest' || !desc.linear ? gl.NEAREST : gl.LINEAR;

    const texture = gl.createTexture();
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

  function createFBO(gl, caps, width, height, options) {
    const texture = createTexture(gl, caps, width, height, options);
    const fbo = gl.createFramebuffer();
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

  function bindTarget(gl, target) {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.width, target.height);
    }
  }

  function bindScreen(gl, width, height) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
  }

  // Fullscreen triangle covering clip space; UVs derived in the shader.
  function createFullscreenQuad(gl) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // Two triangles covering the screen, with position in clip space.
    const verts = new Float32Array([
      -1, -1,
      3, -1,
      -1, 3
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return {
      draw() {
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      }
    };
  }

  // Instanced rounded-rect batcher.
  // Per-instance layout (floats): rect(4), color+glow(4), params(4) = 12.
  const FLOATS_PER_INSTANCE = 13;

  function createQuadBatcher(gl, maxInstances) {
    const capacity = maxInstances || 2048;
    const data = new Float32Array(capacity * FLOATS_PER_INSTANCE);
    let count = 0;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Unit quad corners for a triangle strip.
    const cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);

    const stride = FLOATS_PER_INSTANCE * 4;
    // a_rect (loc 1)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    // a_color (loc 2): rgb + glow
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    // a_params (loc 3): radius, kind, seed, aux
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 32);
    gl.vertexAttribDivisor(3, 1);
    // a_white (loc 4): white-core amount
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 48);
    gl.vertexAttribDivisor(4, 1);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return {
      begin() {
        count = 0;
      },
      push(x, y, w, h, r, g, b, glow, radius, kind, seed, aux, white) {
        if (count >= capacity) {
          return;
        }
        const o = count * FLOATS_PER_INSTANCE;
        data[o] = x;
        data[o + 1] = y;
        data[o + 2] = w;
        data[o + 3] = h;
        data[o + 4] = r;
        data[o + 5] = g;
        data[o + 6] = b;
        data[o + 7] = glow;
        data[o + 8] = radius;
        data[o + 9] = kind;
        data[o + 10] = seed;
        data[o + 11] = aux;
        data[o + 12] = white || 0;
        count += 1;
      },
      get count() {
        return count;
      },
      // Upload the current instance data to the GPU once.
      upload() {
        if (count === 0) {
          return;
        }
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count * FLOATS_PER_INSTANCE));
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      },
      // Draw the already-uploaded instances; can be called multiple times per
      // frame (e.g. a dark backing pass then an additive neon pass).
      draw() {
        if (count === 0) {
          return;
        }
        gl.bindVertexArray(vao);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
        gl.bindVertexArray(null);
      },
      flush() {
        this.upload();
        this.draw();
      }
    };
  }

  window.GLCore = {
    init,
    createProgram,
    getUniformLocations,
    createTexture,
    createFBO,
    bindTarget,
    bindScreen,
    createFullscreenQuad,
    createQuadBatcher,
    FLOATS_PER_INSTANCE
  };
})();
