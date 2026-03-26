attribute vec2 aVertex;
attribute vec2 aRegion;
attribute vec4 aColor;
uniform mat4 uProjectionMatrix;
varying vec2 vRegion;
varying vec4 vColor;
varying vec3 vWorldPos;
void main(void) {
    gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);
    
    vColor  = vec4(aColor.bgr * aColor.a, aColor.a);
    vRegion = aRegion;
	vWorldPos = vec3(aVertex, 0.0);
}