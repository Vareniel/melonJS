precision highp float;

uniform sampler2D spine_texture;
uniform sampler2D normal_texture;

uniform int  uLightCount;
uniform vec3 uLightPos[8];
uniform vec3 uLightColor[8];
uniform float uLightRadius[8];
uniform float uFacingRight;

uniform vec4 color;

varying vec4 vColor;
varying vec2 vRegion;
varying vec3 vWorldPos;
void main(void) {
 vec4 baseColor = texture2D(spine_texture, vRegion) * vColor;
 if (baseColor.a < 0.01) {
  gl_FragColor = baseColor;
  return;
 }
 vec3 normal = texture2D(normal_texture, vRegion).rgb;
 normal.y = 1.0 - normal.y;
 normal = normalize(normal * 2.0 - 1.0);

if (uFacingRight < 0.5) {
    normal.x = -normal.x;
}

 vec3 lighting = baseColor.rgb;

 for (int i = 0; i < 8; i++) {
  if (i >= uLightCount) break;

  vec3 lightVec = uLightPos[i] - vWorldPos;
  float dist = length(lightVec);
  vec3 lightDir = normalize(lightVec);

  float diff = max(dot(normal, lightDir), 0.0);

  vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);

  float atten = clamp(1.0 - dist / uLightRadius[i], 0.0, 1.0);

  lighting += uLightColor[i] * (diff + spec * 0.2) * atten;
 }

 gl_FragColor = vec4(lighting, baseColor.a);
}