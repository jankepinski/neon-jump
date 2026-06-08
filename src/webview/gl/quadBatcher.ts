export interface QuadBatcher {
  begin(): void;
  push(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    glow: number,
    radius: number,
    kind: number,
    seed: number,
    aux: number,
    white?: number
  ): void;
  readonly count: number;
  upload(): void;
  draw(): void;
  flush(): void;
}

// Per-instance layout (floats): rect(4), color+glow(4), params(4), white(1) = 13.
export const FLOATS_PER_INSTANCE = 13;

export function createQuadBatcher(
  gl: WebGL2RenderingContext,
  maxInstances?: number
): QuadBatcher {
  const capacity = maxInstances ?? 2048;
  const data = new Float32Array(capacity * FLOATS_PER_INSTANCE);
  let count = 0;

  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error('Failed to create VAO');
  }
  gl.bindVertexArray(vao);

  const cornerBuffer = gl.createBuffer();
  if (!cornerBuffer) {
    throw new Error('Failed to create buffer');
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const instanceBuffer = gl.createBuffer();
  if (!instanceBuffer) {
    throw new Error('Failed to create buffer');
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);

  const stride = FLOATS_PER_INSTANCE * 4;
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
  gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 32);
  gl.vertexAttribDivisor(3, 1);
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
      data[o + 12] = white ?? 0;
      count += 1;
    },
    get count() {
      return count;
    },
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
