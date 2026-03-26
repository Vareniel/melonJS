import { getSharedProgram, getSharedRenderTarget } from "./utils/noiseUtils";

const IDENTITY4 = new Float32Array([
	1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

export class NoiseTexture2D {
	constructor(renderer, noiseSettings) {
		this.renderer = renderer;
		this.width = noiseSettings.width ?? 512;
		this.height = noiseSettings.height ?? 512;
		this.repeat = noiseSettings.repeat ?? false;

		this.noiseParams = {
			scale: noiseSettings.scale ?? 1.0,
			octaves: noiseSettings.octaves ?? 4.0,
			persistence: noiseSettings.persistence ?? 0.5,
			seed: noiseSettings.seed ?? 0.0,
			seamless: !!noiseSettings.seamless,
			blendSkirt: noiseSettings.blendSkirt ?? 0.1,
			time: noiseSettings.time ?? 0.0,
		};

		this.renderTarget = getSharedRenderTarget(this.width, this.height);
		this.gl = this.renderTarget.context;
		this.program = getSharedProgram(this.gl);

		this.loc = {
			attrib: {
				aVertex: this.gl.getAttribLocation(this.program, "aVertex"),
				aRegion: this.gl.getAttribLocation(this.program, "aRegion"),
				aColor: this.gl.getAttribLocation(this.program, "aColor"),
			},
			uniform: {
				uProjectionMatrix: this.gl.getUniformLocation(
					this.program,
					"uProjectionMatrix",
				),
				u_time: this.gl.getUniformLocation(this.program, "u_time"),
				u_scale: this.gl.getUniformLocation(this.program, "u_scale"),
				u_octaves: this.gl.getUniformLocation(this.program, "u_octaves"),
				u_persistence: this.gl.getUniformLocation(
					this.program,
					"u_persistence",
				),
				u_seed: this.gl.getUniformLocation(this.program, "u_seed"),
				u_resolution: this.gl.getUniformLocation(this.program, "u_resolution"),
				u_seamless: this.gl.getUniformLocation(this.program, "u_seamless"),
				u_blendSkirt: this.gl.getUniformLocation(this.program, "u_blendSkirt"),
			},
		};

		this._initQuadBuffers();

		// PENTING: Render SEKALI, lalu simpan hasilnya
		this.render();

		// Simpan canvas snapshot (bukan referensi ke shared canvas!)
		this.cachedCanvas = this._captureCanvas();

		// JANGAN simpan referensi ke renderTarget/gl setelah ini
		this.renderTarget = null;
		this.gl = null;
	}

	_initQuadBuffers() {
		const gl = this.gl;
		const pos = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]);
		this.vboPos = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vboPos);
		gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);

		const uv = new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]);
		this.vboUV = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vboUV);
		gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);

		const col = new Float32Array([
			1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
		]);
		this.vboCol = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vboCol);
		gl.bufferData(gl.ARRAY_BUFFER, col, gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
	}

	_captureCanvas() {
		// Buat canvas baru dan copy pixel data
		const canvas = document.createElement("canvas");
		canvas.width = this.width;
		canvas.height = this.height;
		const ctx = canvas.getContext("2d");
		ctx.drawImage(this.renderTarget.canvas, 0, 0);
		return canvas;
	}

	setParams(params = {}) {
		Object.assign(this.noiseParams, params);
	}

	createTexture(renderer, repeat = true) {
		let gl = renderer.gl;
		this.texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture);

		// Gunakan cached canvas, BUKAN shared render target
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			this.cachedCanvas,
		);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(
			gl.TEXTURE_2D,
			gl.TEXTURE_WRAP_S,
			repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE,
		);
		gl.texParameteri(
			gl.TEXTURE_2D,
			gl.TEXTURE_WRAP_T,
			repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE,
		);

		function isPOT(v) {
			return (v & (v - 1)) === 0;
		}
		if (isPOT(this.cachedCanvas.width) && isPOT(this.cachedCanvas.height)) {
			gl.generateMipmap(gl.TEXTURE_2D);
		}

		gl.bindTexture(gl.TEXTURE_2D, null);
	}

	render() {
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, this.width, this.height);
		gl.disable(gl.DEPTH_TEST);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(this.program);

		gl.uniformMatrix4fv(this.loc.uniform.uProjectionMatrix, false, IDENTITY4);
		gl.uniform2f(this.loc.uniform.u_resolution, this.width, this.height);
		gl.uniform1f(this.loc.uniform.u_time, this.noiseParams.time);
		gl.uniform1f(this.loc.uniform.u_scale, this.noiseParams.scale);
		gl.uniform1f(this.loc.uniform.u_octaves, this.noiseParams.octaves);
		gl.uniform1f(this.loc.uniform.u_persistence, this.noiseParams.persistence);
		gl.uniform1f(this.loc.uniform.u_seed, this.noiseParams.seed);
		gl.uniform1i(
			this.loc.uniform.u_seamless,
			this.noiseParams.seamless ? 1 : 0,
		);
		gl.uniform1f(this.loc.uniform.u_blendSkirt, this.noiseParams.blendSkirt);

		function enableAttrib(gl, loc, buffer, size) {
			if (loc >= 0) {
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
				gl.enableVertexAttribArray(loc);
				gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
			}
		}

		enableAttrib(gl, this.loc.attrib.aVertex, this.vboPos, 2);
		enableAttrib(gl, this.loc.attrib.aRegion, this.vboUV, 2);
		enableAttrib(gl, this.loc.attrib.aColor, this.vboCol, 4);

		gl.drawArrays(gl.TRIANGLES, 0, 6);

		if (this.loc.attrib.aVertex >= 0) {
			gl.disableVertexAttribArray(this.loc.attrib.aVertex);
		}
		if (this.loc.attrib.aRegion >= 0) {
			gl.disableVertexAttribArray(this.loc.attrib.aRegion);
		}
		if (this.loc.attrib.aColor >= 0) {
			gl.disableVertexAttribArray(this.loc.attrib.aColor);
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.useProgram(null);
	}

	generateNewPattern() {
		// Re-render ke shared target
		this.renderTarget = getSharedRenderTarget(this.width, this.height);
		this.gl = this.renderTarget.context;

		this.noiseParams.seed = Math.random() * 100.0;
		this.render();

		// Update cached canvas
		this.cachedCanvas = this._captureCanvas();

		// Cleanup references
		this.renderTarget = null;
		this.gl = null;
	}

	getCanvas() {
		return this.cachedCanvas;
	}

	invalidate(renderer) {
		// Re-upload texture dari cached canvas
		if (this.texture) {
			const gl = renderer.gl;
			gl.bindTexture(gl.TEXTURE_2D, this.texture);
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				this.cachedCanvas,
			);
			gl.bindTexture(gl.TEXTURE_2D, null);
		}
	}

	async toImageBitmap() {
		return createImageBitmap(this.cachedCanvas);
	}

	destroy() {
		// VBO sudah di-share, jangan dihapus
		// Program juga shared, jangan dihapus
		if (this.texture && this.renderer) {
			this.renderer.gl.deleteTexture(this.texture);
		}
		this.cachedCanvas = null;
	}
}
