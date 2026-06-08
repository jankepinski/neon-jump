#version 300 es
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
}
