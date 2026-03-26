/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
import { input, Vector2d, video } from "../index";
import { releasePointerEvent } from "../input/pointerevent";
import { DRAGEND, DRAGSTART, off, POINTERMOVE } from "../system/event";
import Container from "./container";
import Sprite from "./sprite";

/**
 * Slider Object.
 */
export class Slider extends Container {
	constructor(x, y, settings = {}) {
		const defaults = {
			width: 200,
			height: 20,
			minValue: 0,
			maxValue: 100,
			value: 50,
			direction: "LeftToRight",
			wholeNumbers: true,
			backgroundColor: "#333333",
			fillColor: "#13ba13ff",
			shape: "RoundRect",
			radius: 10,

			knob: {
				width: 27,
				height: 27,
				color: "#ffffffff",
				shapeType: "circle",
			},
		};

		const config = Object.assign({}, defaults, settings);
		config.knob = Object.assign({}, defaults.knob, settings.knob);

		super(x, y, config.width, config.height);

		this.anchorPoint.set(0, 0);
		this.floating = true;

		this._width = config.width;
		this._height = config.height;
		this._direction = config.direction;
		this._minValue = config.minValue;
		this._maxValue = config.maxValue;
		this._wholeNumbers = config.wholeNumbers;
		this._value = config.value;
		this.bgColor = config.backgroundColor;
		this.fillColor = config.fillColor;
		this.shape = config.shape;
		this.radius = config.radius;

		this.bgPath = new Path2D();
		this.fillPath = new Path2D();

		if (settings.knob) {
			this.sliderButton = new SliderButton(0, 0, config.knob, this);
			this.addChild(this.sliderButton);
		}

		this.updatePaths();
		if (settings.knob) {
			this.updateKnobPosition();
		}
	}

	update(dt) {
		super.update(dt);
		return true;
	}

	updatePaths() {
		const w = this._width;
		const h = this._height;

		this.bgPath.beginPath();
		this._drawShapeToPath(this.bgPath, w, h);

		let range = this._maxValue - this._minValue;
		let pct = range === 0 ? 0 : (this._value - this._minValue) / range;
		pct = Math.max(0, Math.min(pct, 1));

		this.fillPath.beginPath();
		let fx = 0,
			fy = 0,
			fw = w,
			fh = h;

		if (this._direction === "LeftToRight") {
			fw = w * pct;
		} else if (this._direction === "RightToLeft") {
			fw = w * pct;
			fx = w - fw;
		} else if (this._direction === "BottomToTop") {
			fh = h * pct;
			fy = h - fh;
		} else if (this._direction === "TopToBottom") {
			fh = h * pct;
		}

		this.fillPath.rect(fx, fy, fw, fh);
	}

	updateKnobPosition() {
		let range = this._maxValue - this._minValue;
		let pct = range === 0 ? 0 : (this._value - this._minValue) / range;
		pct = Math.max(0, Math.min(pct, 1));

		let kx = 0;
		let ky = 0;

		const midY = this._height / 2;
		const midX = this._width / 2;

		if (this._direction === "LeftToRight") {
			kx = this._width * pct;
			ky = midY;
		} else if (this._direction === "RightToLeft") {
			kx = this._width * (1 - pct);
			ky = midY;
		} else if (this._direction === "TopToBottom") {
			kx = midX;
			ky = this._height * pct;
		} else if (this._direction === "BottomToTop") {
			kx = midX;
			ky = this._height * (1 - pct);
		}

		this.sliderButton.pos.set(kx, ky, this.sliderButton.pos.z);
	}

	_drawShapeToPath(path, w, h) {
		if (this.shape === "RoundRect") {
			const r = Math.min(Math.max(this.radius || 0, 0), Math.min(w, h) / 2);
			path.roundRect(0, 0, w, h, r);
		} else {
			path.rect(0, 0, w, h);
		}
	}

	draw(renderer) {
		if (this.bgPath.points.length === 0) {
			return;
		}
		renderer.save();

		const x = this.pos.x;
		const y = this.pos.y;

		renderer.setColor(this.bgColor);
		renderer.beginPath();
		this.bgPath.points.forEach((p) => {
			return renderer.lineTo(x + p.x, y + p.y);
		});
		renderer.fill();

		if (this.fillPath.points.length > 0) {
			renderer.beginPath();
			this.bgPath.points.forEach((p) => {
				return renderer.lineTo(x + p.x, y + p.y);
			});
			renderer.setMask();

			renderer.setColor(this.fillColor);
			renderer.beginPath();
			this.fillPath.points.forEach((p) => {
				return renderer.lineTo(x + p.x, y + p.y);
			});
			renderer.fill();

			renderer.clearMask();
		}

		renderer.restore();

		super.draw(renderer);
	}

	get value() {
		return this._value;
	}

	set value(val) {
		this.setValueInternal(val, true);
	}

	/**
	 * Internal setter untuk menghindari update posisi knob
	 * jika perubahan berasal dari drag knob itu sendiri.
	 */
	setValueInternal(val, updateKnob = true) {
		let clamped = Math.max(this._minValue, Math.min(val, this._maxValue));
		if (this._wholeNumbers) {
			clamped = Math.round(clamped);
		}

		if (this._value !== clamped) {
			this._value = clamped;
			this.updatePaths();
			if (this.sliderButton && updateKnob) {
				this.updateKnobPosition();
			}
		}
	}
}

export class SliderButton extends Sprite {
	/**
	 * @param {number} x - posisi x relatif terhadap slider
	 * @param {number} y - posisi y relatif terhadap slider
	 * @param {object} settings - setting untuk sprite/tombol
	 * @param {Slider} slider - referensi ke parent Slider
	 */
	constructor(x, y, settings, slider) {
		let isShapeMode = !settings.image;
		if (isShapeMode) {
			settings.image = video.renderer.getCanvas();
		}

		super(x, y, settings);

		this.slider = slider;
		this.isShapeMode = isShapeMode;

		this.color = settings.color || "#ffffff";
		this.strokeColor = settings.strokeColor || "#000000";
		this.width = settings.width || 20;
		this.height = settings.height || 20;
		this.shapeType = settings.shapeType || "circle";

		this.isKinematic = false;
		this.dragging = false;
		this.dragId = null;
		this.grabOffset = new Vector2d(0, 0);

		if (!isShapeMode) {
			this.scale(settings.scaleX, settings.scaleY);
		}
		this.initEvents();
	}

	/**
	 * Logic event listener (Copied & Modified from Draggable)
	 */
	initEvents() {
		input.registerPointerEvent("pointerdown", this, (e) => {
			return event.emit("me.game.dragstart", e, this);
		});
		window.addEventListener("pointerup", (e) => {
			return event.emit("me.game.dragend", e, this);
		});
		window.addEventListener("pointercancel", (e) => {
			return event.emit("me.game.dragend", e, this);
		});
		event.on("me.event.pointermove", (e) => {
			return this.dragMove(e);
		});
		event.on("me.game.dragstart", (e, draggable) => {
			if (draggable === this) {
				this.dragStart(e);
			}
		});
		event.on("me.game.dragend", (e, draggable) => {
			if (draggable === this) {
				this.dragEnd(e);
			}
		});
	}

	dragStart(e) {
		if (this.dragging === false) {
			this.dragging = true;
			this.grabOffset.set(e.gameX, e.gameY);
			this.grabOffset.sub(this.pos);
			return false;
		}
	}

	dragMove(e) {
		if (this.dragging === true) {
			let newX = e.gameX - this.grabOffset.x;
			let newY = e.gameY - this.grabOffset.y;

			const s = this.slider;

			let pct = 0;

			if (s._direction === "LeftToRight") {
				newY = this.ancestor.height / 2;
				newX = Math.max(0, Math.min(newX, s._width));
				pct = newX / s._width;
			} else if (s._direction === "RightToLeft") {
				newY = this.ancestor.height / 2;
				newX = Math.max(0, Math.min(newX, s._width));
				pct = 1 - newX / s._width;
			} else if (s._direction === "TopToBottom") {
				newX = this.ancestor.width / 2;
				newY = Math.max(0, Math.min(newY, s._height));
				pct = newY / s._height;
			} else if (s._direction === "BottomToTop") {
				newX = this.ancestor.width / 2;
				newY = Math.max(0, Math.min(newY, s._height));
				pct = 1 - newY / s._height;
			}

			this.pos.set(newX, newY, this.pos.z);

			let range = s._maxValue - s._minValue;
			let val = s._minValue + range * pct;

			s.setValueInternal(val, false);
		}
	}

	dragEnd() {
		if (this.dragging === true) {
			this.dragging = false;
			return false;
		}
	}

	update(dt) {
		return true;
	}

	draw(renderer) {
		if (this.isShapeMode) {
			renderer.save();

			const x = this.pos.x;
			const y = this.pos.y;
			const w = this.width;
			const h = this.height;

			// ===== FILL =====
			renderer.setColor(this.color);

			if (this.shapeType === "circle") {
				renderer.fillEllipse(x + w / 2, y + h / 2, w / 2, h / 2);
			} else {
				renderer.fillRect(x, y, w, h);
			}

			// ===== STROKE =====
			renderer.setColor(this.strokeColor);
			renderer.lineWidth = 2; // bisa kamu expose ke settings

			if (this.shapeType === "circle") {
				renderer.strokeEllipse(x + w / 2, y + h / 2, w / 2, h / 2);
			} else {
				renderer.strokeRect(x, y, w, h);
			}

			renderer.restore();
		} else {
			super.draw(renderer);
		}
	}

	destroy() {
		off(POINTERMOVE, this.dragMove);
		off(DRAGSTART, this.dragStart);
		off(DRAGEND, this.dragEnd);
		releasePointerEvent("pointerdown", this);
		releasePointerEvent("pointerup", this);
		releasePointerEvent("pointercancel", this);
		super.destroy();
	}
}
