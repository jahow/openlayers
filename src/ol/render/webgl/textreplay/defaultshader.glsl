//! MODULE=ol/render/webgl/textreplay/defaultshader


//! COMMON
varying vec2 v_texCoord;
varying float v_opacity;

//! VERTEX
attribute vec2 a_position;
attribute vec2 a_texCoord;
attribute vec2 a_offsets;
attribute float a_opacity;
attribute float a_rotateWithView;

uniform mat4 u_projectionMatrix;
uniform mat4 u_offsetScaleMatrix;
uniform mat4 u_offsetRotateMatrix;

void main(void) {
  mat4 offsetMatrix = u_offsetScaleMatrix;
  if (a_rotateWithView == 1.0) {
    offsetMatrix = u_offsetScaleMatrix * u_offsetRotateMatrix;
  }
  vec4 offsets = offsetMatrix * vec4(a_offsets, 0.0, 0.0);
  gl_Position = u_projectionMatrix * vec4(a_position, 0.0, 1.0) + offsets;
  v_texCoord = a_texCoord;
  v_opacity = a_opacity;
}


//! FRAGMENT
uniform float u_opacity;
uniform sampler2D u_image;

void main(void) {
  // vec4 texColor = texture2D(u_image, v_texCoord);
  // gl_FragColor.rgb = texColor.rgb;
  // float alpha = texColor.a * v_opacity * u_opacity;
  // if (alpha < 0.2) {
  //   discard;
  // }
  // if (alpha < 0.4) {
  //   gl_FragColor.rgb = vec3(0.0, 0.0, 0.0);
  // } else {
  //   gl_FragColor.rgb = vec3(1.0, 1.0, 1.0);
  // }
  // gl_FragColor.a = v_opacity * u_opacity;

  //taken from https://blog.mapbox.com/drawing-text-with-signed-distance-fields-in-mapbox-gl-b0933af6f817
  float dist = texture2D(u_image, v_texCoord).a;
  float alpha = smoothstep(0.10, 0.25, dist);
  float color = 0.15 + 0.85 * smoothstep(0.5, 0.8, dist);
  gl_FragColor.rgb = vec3(color, color, color);
  gl_FragColor.a = alpha * v_opacity * u_opacity;
}
