export interface ScoreTexture {
  texture: WebGLTexture;
  update(text: string): void;
}

export function createScoreTexture(gl: WebGL2RenderingContext): ScoreTexture {
  const scoreCanvas = document.createElement('canvas');
  scoreCanvas.width = 256;
  scoreCanvas.height = 256;
  const scoreCtx = scoreCanvas.getContext('2d');
  if (!scoreCtx) {
    throw new Error('Failed to create 2D context for score texture');
  }

  const scoreTexture = gl.createTexture();
  if (!scoreTexture) {
    throw new Error('Failed to create score texture');
  }
  gl.bindTexture(gl.TEXTURE_2D, scoreTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  let lastScoreText: string | null = null;

  return {
    texture: scoreTexture,
    update(text: string) {
      if (text === lastScoreText) {
        return;
      }
      lastScoreText = text;

      const size = scoreCanvas.width;
      scoreCtx.clearRect(0, 0, size, size);
      scoreCtx.fillStyle = '#ffffff';
      scoreCtx.textAlign = 'center';
      scoreCtx.textBaseline = 'middle';

      const FONT = (px: number) =>
        `700 ${px}px ui-monospace, "Cascadia Code", Consolas, monospace`;
      const REF = 100;
      scoreCtx.font = FONT(REF);
      const naturalW = scoreCtx.measureText(text).width;
      const targetW = 0.8 * size;
      const fontSize = REF * (targetW / Math.max(naturalW, 1));
      scoreCtx.font = FONT(fontSize);
      scoreCtx.fillText(text, size / 2, size / 2);

      gl.bindTexture(gl.TEXTURE_2D, scoreTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scoreCanvas);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  };
}
