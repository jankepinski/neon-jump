#version 300 es
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
    float a;
    if (kind < 2.5) {
      // platforms: a wide, soft dark pocket dims the sun (and its local bloom)
      // in a generous region around the body so the neon reads over it.
      float core = smoothstep(6.0 + aa, -aa, d);
      float halo = exp(-max(d, 0.0) * 0.07);
      a = max(core, halo * 0.85) * 0.72;
    } else if (kind > 2.5 && kind < 3.5) {
      // player: same idea, slightly tighter falloff.
      float core = smoothstep(6.0 + aa, -aa, d);
      float halo = exp(-max(d, 0.0) * 0.09);
      a = max(core, halo * 0.8) * 0.62;
    } else if (kind > 3.5) {
      // particles (4) / trail (5): fade with aux, lighter backing
      a = smoothstep(5.0 + aa, -aa, d) * 0.22 * aux;
    } else {
      a = smoothstep(5.0 + aa, -aa, d) * 0.42;
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

  if (kind < 0.5) {
    // normal platforms: brighter, more saturated fill plus a crisp cyan outline
    // so they punch through the residual sun behind them.
    e += col * body * 0.25;
    e += vec3(1.0) * edge * 0.3;
  } else if (kind > 0.5 && kind < 1.5) {
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
    // Player: a solid, crisply-outlined shape with only a tight contained glow.
    // Sharp silhouette = readable hitbox; full-brightness body stays visible over
    // the sun; no soft neon edge/aura, so it does not bloom like the platforms.
    float fill = smoothstep(aa, -aa, d);                  // crisp filled interior
    float ring = smoothstep(1.6 + aa, 1.6 - aa, abs(d));  // ~3px outline on the edge
    float glow = exp(-max(d, 0.0) * 0.28) * outside;      // tight, contained halo
    e = col * fill;                                       // solid full-brightness body
    e += col * 0.18 * smoothstep(0.0, -10.0, d);          // subtle inner brightening
    e += vec3(1.0) * ring * 0.85;                         // crisp white outline
    e += col * glow * 0.3;                                // small glow, low bloom
  } else if (kind > 3.5) {
    // particle (4) or trail (5): fade by aux
    e *= aux;
  }

  fragColor = vec4(e, 1.0);
}
