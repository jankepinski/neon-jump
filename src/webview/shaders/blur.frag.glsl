#version 300 es
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
}
