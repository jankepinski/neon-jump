// GLSL ES 3.00 shader sources for the neon renderer.
// Exposed on window.SHADERS. Entity kinds:
// 0 normal, 1 fragile, 2 moving, 3 player, 4 particle, 5 trail.

(function () {
  'use strict';

  const fullscreenVS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

  // Instanced rounded-rect scene shader. The quad is expanded beyond the rect
  // so the glow can bleed outside the body. Local coordinates are in pixels
  // relative to the rect center.
  const sceneVS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_rect;   // x, y, w, h (screen px)
layout(location = 2) in vec4 a_color;  // rgb + glow intensity
layout(location = 3) in vec4 a_params; // radius, kind, seed, aux
layout(location = 4) in float a_white; // white-core amount

uniform vec2 u_resolution;

out vec2 v_local;
out vec2 v_half;
out vec4 v_color;
out vec4 v_params;
out float v_white;

void main() {
  float pad = 18.0 + a_color.w * 26.0;
  vec2 origin = a_rect.xy - pad;
  vec2 size = a_rect.zw + pad * 2.0;
  vec2 pos = origin + a_corner * size;

  vec2 center = a_rect.xy + a_rect.zw * 0.5;
  v_local = pos - center;
  v_half = a_rect.zw * 0.5;
  v_color = a_color;
  v_params = a_params;
  v_white = a_white;

  vec2 clip = vec2(
    (pos.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (pos.y / u_resolution.y) * 2.0
  );
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

  const sceneFS = `#version 300 es
precision highp float;

in vec2 v_local;
in vec2 v_half;
in vec4 v_color;
in vec4 v_params;
in float v_white;

uniform float u_time;
uniform float u_mode; // 0 = neon emission, 1 = dark backing for contrast outline

out vec4 fragColor;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void main() {
  float radius = v_params.x;
  float kind = v_params.y;
  float seed = v_params.z;
  float aux = v_params.w;

  float d = sdRoundBox(v_local, v_half, radius);
  // Screen-space anti-aliasing width (v_local is in pixels, so ~1px).
  float aa = max(fwidth(d), 0.0001);

  // --- Backing pass: a dark, soft box slightly larger than the body. Drawn
  // with alpha blending toward black so each entity carves a readable dark
  // outline out of whatever bright background sits behind it. ---
  if (u_mode > 0.5) {
    float backing = smoothstep(5.0 + aa, -aa, d);
    float a = backing * 0.42;
    if (kind > 3.5) {
      // particles (4) / trail (5): fade with aux, lighter backing
      a = backing * 0.22 * aux;
    }
    fragColor = vec4(0.0, 0.0, 0.0, a);
    return;
  }

  // --- Neon emission pass ---
  // Crisp, anti-aliased filled interior and outside-only halo so the body has
  // a defined boundary instead of a soft blob.
  float body = smoothstep(aa, -aa, d);          // 1 inside, AA across the edge
  float outside = smoothstep(-aa, aa, d);       // 1 outside the edge
  float edge = exp(-abs(d) * 0.9);              // thin bright neon edge line
  float outerHalo = exp(-max(d, 0.0) * 0.06);   // soft glow, outside only

  vec3 col = v_color.rgb;
  float I = v_color.w;

  vec3 e = vec3(0.0);
  e += col * body * 0.5;                  // readable filled interior
  e += col * edge * 1.5 * I;             // crisp neon edge (main bloom source)
  e += col * outerHalo * outside * 0.5 * I; // outer glow that no longer hazes interior

  // White-hot core; per-element amount (0 = colored center, 1 = white center).
  e += vec3(1.0) * smoothstep(1.0, -5.0, d) * v_white;

  if (kind > 0.5 && kind < 1.5) {
    // fragile: flicker more as damage rises, add crack noise
    float dmg = aux;
    float fl = 0.72 + 0.28 * sin(u_time * 30.0 + seed * 12.0);
    e *= mix(1.0, fl, dmg);
    float cracks = step(0.82, hash21(v_local * 0.25 + seed));
    e += col * cracks * body * dmg * 0.6;
  } else if (kind > 1.5 && kind < 2.5) {
    // moving: animated energy stripes inside
    float stripes = 0.5 + 0.5 * sin(v_local.x * 0.45 - u_time * 4.5);
    e += col * body * stripes * 0.3;
  } else if (kind > 2.5 && kind < 3.5) {
    // player: bright crisp white edge ring so its outline always reads
    e += vec3(1.0) * edge * 0.9;
  } else if (kind > 3.5) {
    // particle (4) or trail (5): fade by aux
    e *= aux;
  }

  fragColor = vec4(e, 1.0);
}`;

  const bgFS = `#version 300 es
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
}`;

  const brightFS = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_scene;
uniform float u_threshold;
out vec4 fragColor;

void main() {
  vec3 c = texture(u_scene, v_uv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float contrib = smoothstep(u_threshold, u_threshold + 0.45, l);
  fragColor = vec4(c * contrib, 1.0);
}`;

  const blurFS = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform vec2 u_dir;
out vec4 fragColor;

void main() {
  float w0 = 0.227027;
  float w1 = 0.1945946;
  float w2 = 0.1216216;
  float w3 = 0.054054;
  float w4 = 0.016216;

  vec2 off1 = u_texel * u_dir * 1.0;
  vec2 off2 = u_texel * u_dir * 2.0;
  vec2 off3 = u_texel * u_dir * 3.0;
  vec2 off4 = u_texel * u_dir * 4.0;

  vec3 sum = texture(u_tex, v_uv).rgb * w0;
  sum += texture(u_tex, v_uv + off1).rgb * w1;
  sum += texture(u_tex, v_uv - off1).rgb * w1;
  sum += texture(u_tex, v_uv + off2).rgb * w2;
  sum += texture(u_tex, v_uv - off2).rgb * w2;
  sum += texture(u_tex, v_uv + off3).rgb * w3;
  sum += texture(u_tex, v_uv - off3).rgb * w3;
  sum += texture(u_tex, v_uv + off4).rgb * w4;
  sum += texture(u_tex, v_uv - off4).rgb * w4;

  fragColor = vec4(sum, 1.0);
}`;

  const compositeFS = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bloomStrength;
uniform float u_flash;
uniform float u_exposure;
uniform float u_vignette;
uniform float u_scanline;
uniform float u_aberration;
uniform float u_curvature;
out vec4 fragColor;

vec3 sceneBloom(vec2 uv) {
  vec3 scene = texture(u_scene, uv).rgb;
  vec3 bloom = texture(u_bloom, uv).rgb;
  return scene + bloom * u_bloomStrength;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void main() {
  // Barrel/CRT curvature (strength tunable).
  vec2 cc = v_uv * 2.0 - 1.0;
  cc *= 1.0 + u_curvature * dot(cc, cc);
  vec2 uv = cc * 0.5 + 0.5;

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Chromatic aberration along the radial direction.
  float ca = (u_aberration + u_flash * 0.004);
  vec2 dir = normalize(cc + 1e-5) * ca;
  vec3 col;
  col.r = sceneBloom(uv + dir).r;
  col.g = sceneBloom(uv).g;
  col.b = sceneBloom(uv - dir).b;

  // Exposure lift, then filmic-ish tone mapping for HDR rolloff.
  col *= u_exposure;
  col = col / (col + vec3(0.85));
  col = pow(col, vec3(0.85));

  // Scanlines (strength tunable).
  float scanRaw = 0.92 + 0.08 * sin(uv.y * u_resolution.y * 1.4);
  col *= mix(1.0, scanRaw, u_scanline);

  // Vignette (strength tunable).
  float vigRaw = smoothstep(1.45, 0.45, length(cc));
  col *= mix(1.0, vigRaw, u_vignette);

  // Subtle film grain.
  float grain = hash21(uv * u_resolution.xy + u_time);
  col += (grain - 0.5) * 0.025;

  // Bounce flash lift.
  col += vec3(0.15, 0.35, 0.55) * u_flash * 0.25;

  fragColor = vec4(col, 1.0);
}`;

  window.SHADERS = {
    fullscreenVS,
    sceneVS,
    sceneFS,
    bgFS,
    brightFS,
    blurFS,
    compositeFS
  };
})();
