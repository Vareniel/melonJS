import CanvasRenderTarget from "../../renderTarget/canvasrendertarget.js";
import fragmentNoiseSource from "../shaders/noise.frag";
import vertexNoiseSource from "../shaders/noise.vert";

let sharedRenderTarget = null;
let sharedNoiseProgram = null;

export function createShader(gl, type, src) {
	const sh = gl.createShader(type);
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(sh);
		gl.deleteShader(sh);
		throw new Error("Shader compile error: " + log);
	}
	return sh;
}
export function createProgram(gl, vsSrc, fsSrc) {
	const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
	const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
	const prog = gl.createProgram();
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(prog);
		gl.deleteProgram(prog);
		throw new Error("Program link error: " + log);
	}
	gl.deleteShader(vs);
	gl.deleteShader(fs);
	return prog;
}

export function getSharedRenderTarget(width, height) {
	if (!sharedRenderTarget) {
		sharedRenderTarget = new CanvasRenderTarget(width, height, {
			context: "webgl",
			offscreenCanvas: typeof OffscreenCanvas !== "undefined",
			transparent: false,
			willReadFrequently: false,
			antiAlias: false,
		});
	} else {
		if (
			sharedRenderTarget.canvas.width !== width ||
			sharedRenderTarget.canvas.height !== height
		) {
			sharedRenderTarget.resize(width, height);
		}
	}
	return sharedRenderTarget;
}

export function getSharedProgram(gl) {
	if (!sharedNoiseProgram) {
		sharedNoiseProgram = createProgram(
			gl,
			vertexNoiseSource,
			fragmentNoiseSource,
		);
	}
	return sharedNoiseProgram;
}
