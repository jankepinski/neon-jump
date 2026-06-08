#version 300 es
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
}
