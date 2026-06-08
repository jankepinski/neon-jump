#version 300 es
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
}
