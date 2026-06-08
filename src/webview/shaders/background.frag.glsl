#version 300 es
precision highp float;

in vec2 v_uv;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_cameraY;
uniform sampler2D u_scoreTex;
uniform float u_scoreActive; // 0/1
uniform float u_scoreHot;    // 0 = subtle, 1 = beating high score

out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;

  // Base vertical gradient: deep indigo at top, near-black at the bottom.
  vec3 top = vec3(0.05, 0.02, 0.13);
  vec3 bottom = vec3(0.01, 0.01, 0.04);
  vec3 col = mix(bottom, top, uv.y);

  float hy = 0.40; // horizon height

  // Horizon glow band (magenta to cyan).
  float band = exp(-abs(uv.y - hy) * 16.0);
  vec3 horizonCol = mix(vec3(1.0, 0.18, 0.62), vec3(0.2, 0.8, 1.0), uv.x);
  col += horizonCol * band * 0.5;

  // Neon sun above the horizon with scanline cuts.
  vec2 sunUV = (uv - vec2(0.5, hy + 0.17));
  sunUV.x *= aspect;
  float sunR = length(sunUV);
  float sunBody = smoothstep(0.2, 0.18, sunR);
  float cuts = smoothstep(0.0, 0.5, sin(uv.y * 150.0 + u_time * 3.0));
  float cutMask = smoothstep(hy + 0.17, hy + 0.0, uv.y);
  sunBody *= mix(1.0, cuts, cutMask);
  vec3 sunCol = mix(vec3(1.0, 0.85, 0.3), vec3(1.0, 0.2, 0.6), smoothstep(0.0, 0.36, sunR));
  col += sunCol * sunBody * 0.78;
  col += vec3(1.0, 0.4, 0.7) * exp(-sunR * 4.5) * 0.48;

  // Score baked into the sun: digits clipped to the sun body so they read as
  // part of it and inherit bloom + CRT post FX. Brightens when beating the best.
  if (u_scoreActive > 0.5) {
    vec2 dUV = sunUV / vec2(0.19); // square box ~= sun bounding square (tunable)
    dUV = dUV * 0.5 + 0.5;
    float inBox = step(0.0, dUV.x) * step(dUV.x, 1.0) * step(0.0, dUV.y) * step(dUV.y, 1.0);
    float digit = texture(u_scoreTex, vec2(dUV.x, 1.0 - dUV.y)).a * inBox * sunBody;
    vec3 hotCol = mix(vec3(1.0, 0.96, 0.85), vec3(0.55, 1.0, 1.0), u_scoreHot);
    col += hotCol * digit * mix(0.35, 1.0, u_scoreHot);
  }

  // Perspective synthwave grid below the horizon.
  if (uv.y < hy) {
    float gy = (hy - uv.y);
    float z = 1.0 / max(gy, 0.0008);
    // Camera-driven impulse on jumps (reversed direction), plus a slow constant
    // idle drift.
    float scroll = -u_cameraY * 0.016 + u_time * 0.425;
    float gridX = (uv.x - 0.5) * z;
    float gridZ = z * 0.5 + scroll;

    vec2 cell = vec2(gridX, gridZ);
    vec2 f = abs(fract(cell) - 0.5);
    vec2 fw = fwidth(cell);
    // Per-axis anti-aliased line, ~1.5px wide in screen space.
    vec2 aa = smoothstep(fw * 1.5, vec2(0.0), f);
    float gridLine = max(aa.x, aa.y);
    // Fade lines out where the pattern gets denser than ~1 line/pixel.
    gridLine *= clamp(1.0 / max(max(fw.x, fw.y) * 2.0, 1e-5), 0.0, 1.0);

    float depthFade = smoothstep(0.0, 0.18, gy) * smoothstep(1.0, 0.2, gy);
    vec3 gridCol = mix(vec3(0.1, 0.9, 1.0), vec3(0.9, 0.2, 0.8), clamp(gridX * 0.1 + 0.5, 0.0, 1.0));
    col += gridCol * gridLine * depthFade * 0.9;
  } else {
    // Twinkling stars above the horizon. Every blink cycle each cell re-rolls
    // whether it lights up and where inside the cell, so the overall
    // arrangement keeps reshuffling instead of pulsing in place.
    vec2 sp = uv * vec2(aspect, 1.0) * 22.0;
    sp.y += u_cameraY * 0.002;
    vec2 cellId = floor(sp);
    vec2 cellUV = fract(sp);

    float rnd = hash21(cellId);
    // Per-cell blink timing, desynchronised between cells.
    float period = 1.4 + rnd * 2.2;
    float phase = rnd * 13.0;
    float cyclePos = (u_time + phase) / period;
    float cycle = floor(cyclePos);
    float local = fract(cyclePos);

    // Fresh roll for this cell on this cycle.
    float present = hash21(cellId + cycle * 37.0 + 1.0);
    vec2 starPos = vec2(
      hash21(cellId + cycle * 17.0 + 3.0),
      hash21(cellId + cycle * 53.0 + 9.0)
    );
    starPos = 0.25 + 0.5 * starPos;

    float d = distance(cellUV, starPos);
    float dot = smoothstep(0.06, 0.0, d) * step(0.80, present);

    // Smooth fade in then out across the cycle.
    float blink = sin(local * 3.14159265);
    blink *= blink;

    col += vec3(0.7, 0.85, 1.0) * dot * blink * 0.7;
  }

  // Big translucent squares blinking across the whole screen. Each cell
  // re-rolls on every blink cycle so the arrangement keeps reshuffling.
  vec2 bp = uv * vec2(aspect, 1.0) * 9.0;
  vec2 bCell = floor(bp);
  vec2 bCellUV = fract(bp);

  float bRnd = hash21(bCell + 4.0);
  float bPeriod = 2.4 + bRnd * 2.8;
  float bPhase = bRnd * 9.0;
  float bCyclePos = (u_time + bPhase) / bPeriod;
  float bCycle = floor(bCyclePos);
  float bLocal = fract(bCyclePos);

  float bPresent = step(0.80, hash21(bCell + bCycle * 41.0 + 7.0));
  vec2 bEdge = smoothstep(0.0, 0.07, bCellUV) * smoothstep(1.0, 0.93, bCellUV);
  float bSquare = bEdge.x * bEdge.y;

  float bBlink = sin(bLocal * 3.14159265);
  bBlink *= bBlink;

  col += vec3(0.7, 0.85, 1.0) * bSquare * bBlink * bPresent * 0.15;

  fragColor = vec4(col, 1.0);
}
