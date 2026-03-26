precision highp float;
attribute vec2 aVertex;
attribute vec2 aRegion;
attribute vec4 aColor;
varying vec2 vRegion;
varying vec4 vColor;
uniform mat4 uProjectionMatrix; // Make sure this is defined in JavaScript and passed

void main() {
    gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);
    vColor = vec4(aColor.bgr * aColor.a, aColor.a);
    vRegion = aRegion;   
}