/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { clamp } from "../math/math.js";
import state from "../state/state.js";
import {
	BOOT,
	eventEmitter,
	GAME_BEFORE_UPDATE,
	off,
	STATE_CHANGE,
	STATE_RESTART,
	STATE_RESUME,
} from "./event.js";

/**
 * a Timer class to manage timing related function (FPS, Game Tick, Time...)
 * @see {@link timer} the default global timer instance
 */
class Timer {
	tick: number;
	fps: number;
	maxfps: number;
	interpolation: boolean;
	framecount: number;
	framedelta: number;
	last: number;
	now: number;
	delta: number;
	step: number;
	minstep: number;
	timers: any[];
	timerId: number;
	isPaused: boolean;
	constructor() {
		/**
		 * Last game tick value. <br>
		 * Use this value to scale velocities during frame drops due to slow hardware or when setting an FPS limit.
		 * This feature is disabled by default (Enable interpolation to use it).
		 * @see interpolation
		 * @see maxfps
		 */
		this.tick = 1.0;

		/**
		 * Last measured fps rate.<br>
		 * This feature is disabled by default, unless the debugPanel is enabled/visible.
		 */
		this.fps = 0;

		/**
		 * Set the maximum target display frame per second
		 * @see tick
		 * @default 60
		 */
		this.maxfps = 60;

		/**
		 * Enable/disable frame interpolation
		 * @see tick
		 * @default false
		 */
		this.interpolation = false;

		//hold element to display fps
		this.framecount = 0;
		this.framedelta = 0;

		/* fps count stuff */
		this.last = 0;
		this.now = 0;
		this.delta = 0;
		// for timeout/interval update
		this.step = 0;
		this.minstep = 0;

		// list of defined timer function
		this.timers = [];
		this.timerId = 0;

		// Initialize timer on Boot event
		eventEmitter.addListenerOnce(BOOT, () => {
			// reset variables to initial state
			this.reset();
			this.now = this.last = 0;
			// register to the game before update event
			eventEmitter.addListener(GAME_BEFORE_UPDATE, (time) => {
				this.update(time);
			});
		});

		// reset timer
		eventEmitter.addListener(STATE_RESUME, () => {
			this.reset();
		});
		eventEmitter.addListener(STATE_RESTART, () => {
			this.reset();
		});
		eventEmitter.addListener(STATE_CHANGE, () => {
			this.reset();
		});
	}

	/**
	 * reset time (e.g. usefull in case of pause)
	 * @ignore
	 */
	reset() {
		// set to "now"
		this.last = this.now = globalThis.performance.now();
		this.delta = 0;
		// reset delta counting variables
		this.framedelta = 0;
		this.framecount = 0;
		this.step = Math.ceil(1000 / this.maxfps); // ROUND IT ?
		// define some step with some margin
		this.minstep = (1000 / this.maxfps) * 1.25; // IS IT NECESSARY?\
	}

	/**
	 * Calls a function once after a specified delay. See me.timer.setInterval to repeativly call a function.
	 * @param fn - the function you want to execute after delay milliseconds.
	 * @param delay - the number of milliseconds (thousandths of a second) that the function call should be delayed by.
	 * @param pausable - respects the pause state of the engine.
	 * @param args - optional parameters which are passed through to the function specified by fn once the timer expires.
	 * @returns a positive integer value which identifies the timer created by the call to setTimeout(), which can be used later with me.timer.clearTimeout().
	 * @example
	 * // set a timer to call "myFunction" after 1000ms
	 * me.timer.setTimeout(myFunction, 1000);
	 * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
	 * me.timer.setTimeout(myFunction, 1000, true, param1, param2);
	 */
	setTimeout(
		fn: (...args: any[]) => void,
		delay: number,
		pausable: boolean = true,
		...args: any[]
	) {
		let id: ReturnType<typeof globalThis.setTimeout>;
		const wrappedFn = () => {
			fn(...args);
			this.clearNativeTimer(id);
		};
		id = globalThis.setTimeout(wrappedFn, delay);
		this.timers.push({
			id,
			type: "timeout",
			native: true,
			fn,
			delay,
			args,
			pausable,
			isPersistent: false,
			startTime: performance.now(),
		});
		return id;
	}

	/**
	 * Calls a function continously at the specified interval.  See setTimeout to call function a single time.
	 * @param fn - the function to execute
	 * @param delay - the number of milliseconds (thousandths of a second) on how often to execute the function
	 * @param pausable - respects the pause state of the engine
	 * @param args - optional parameters which are passed through to the function specified by fn once the timer expires.
	 * @returns a numeric, non-zero value which identifies the timer created by the call to setInterval(), which can be used later with me.timer.clearInterval().
	 * @example
	 * // set a timer to call "myFunction" every 1000ms
	 * me.timer.setInterval(myFunction, 1000);
	 * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
	 * me.timer.setInterval(myFunction, 1000, true, param1, param2);
	 */
	setInterval(
		fn: (...args: any[]) => void,
		delay: number,
		pausable: boolean = true,
		...args: any[]
	) {
		const id = globalThis.setInterval(fn, delay, ...args);
		this.timers.push({
			id,
			type: "interval",
			native: true,
			fn,
			delay,
			args,
			pausable,
			isPersistent: false,
		});
		return id;
	}

	/**
	 * Cancels a timeout previously established by calling setTimeout().
	 * @param id - ID of the timeout to be cancelled (for native timers)
	 */
	clearTimeout(id: number) {
		clearTimeout(id);
		this.clearNativeTimer(id);
	}

	/**
	 * cancels the timed, repeating action which was previously established by a call to setInterval().
	 * @param id - ID of the interval to be cleared
	 */
	clearInterval(id: number) {
		clearInterval(id);
		this.clearNativeTimer(id);
	}

	clearNativeTimer(id: number | ReturnType<typeof setTimeout>) {
		this.timers = this.timers.filter(
			(timer) => !(timer.native && timer.id === id),
		);
	}

	/**
	 * Cancels a timer (timeout or interval) previously established by setTimeout() or setInterval().
	 * @param timerId - ID of the timer to be cancelled
	 */
	clearTimer(timerId: ReturnType<typeof globalThis.setTimeout>) {
		for (let i = 0, len = this.timers.length; i < len; i++) {
			if (this.timers[i].id === timerId) {
				const timer = this.timers[i];
				if (timer.type === "interval") {
					globalThis.clearInterval(timerId);
				} else {
					globalThis.clearTimeout(timerId);
				}
				this.timers.splice(i, 1);
				break;
			}
		}
	}

	pauseNative() {
		if (this.isPaused) return;
		this.isPaused = true;
		const now = performance.now();

		this.timers.forEach((timer) => {
			if (timer.native && timer.pausable) {
				// Hitung sudah berapa lama timer berjalan sebelum di-pause
				const elapsedSinceStart = now - timer.startTime;
				timer.remainingTime = timer.delay - (elapsedSinceStart % timer.delay);

				if (timer.type === "interval") {
					clearInterval(timer.id);
				} else if (timer.type === "timeout") {
					clearTimeout(timer.id);
				}
			}
		});
	}

	resumeNative() {
		if (!this.isPaused) return;
		this.isPaused = false;
		const now = performance.now();

		this.timers.forEach((timer) => {
			if (timer.native && timer.pausable) {
				if (timer.type === "timeout") {
					// Jalankan sisa waktu yang tertunda
					timer.id = setTimeout(() => {
						timer.fn(...timer.args);
						this.clearNativeTimer(timer.id);
					}, timer.remainingTime);

					// Update startTime agar jika di-pause lagi, perhitungannya benar
					timer.startTime = now - (timer.delay - timer.remainingTime);
				} else if (timer.type === "interval") {
					// KUNCI: Jalankan sisa waktu detak saat ini dulu
					timer.id = setTimeout(() => {
						timer.fn(...timer.args);

						// Setelah sisa waktu habis, baru mulai interval reguler
						const newIntervalId = setInterval(() => {
							timer.startTime = performance.now(); // Reset setiap detak
							timer.fn(...timer.args);
						}, timer.delay);

						timer.id = newIntervalId;
						timer.startTime = performance.now();
					}, timer.remainingTime);

					// Update startTime sementara untuk sisa waktu ini
					timer.startTime = now - (timer.delay - timer.remainingTime);
				}
			}
		});
	}

	/**
	 * Return the current timestamp in milliseconds <br>
	 * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
	 * @returns - the current timestamp in milliseconds
	 */
	getTime() {
		return this.now;
	}

	/**
	 * Return elapsed time in milliseconds since the last update
	 * @returns - elapsed time in milliseconds since the last update
	 */
	getDelta() {
		return this.delta;
	}

	/**
	 * compute the actual frame time and fps rate
	 * @ignore
	 */
	countFPS() {
		this.framecount++;
		this.framedelta += this.delta;
		if (this.framecount % 10 === 0) {
			this.fps = clamp(
				Math.round((1000 * this.framecount) / this.framedelta),
				0,
				this.maxfps,
			);
			this.framedelta = 0;
			this.framecount = 0;
		}
	}

	/**
	 * update
	 * @ignore
	 */
	update(time: number) {
		this.last = this.now;
		this.now = time;
		this.delta = this.now - this.last;

		// fix for negative timestamp returned by wechat or chrome on startup
		if (this.delta < 0) {
			this.delta = 0;
		}

		// get the game tick
		this.tick =
			this.delta > this.minstep && this.interpolation
				? this.delta / this.step
				: 1;

		this.updateTimers();
	}

	/**
	 * update timers
	 * @ignore
	 */
	updateTimers() {
		for (let i = 0, len = this.timers.length; i < len; i++) {
			const _timer = this.timers[i];
			if (!(_timer.pauseable && state.isPaused())) {
				_timer.elapsed += this.delta;
			}
			if (_timer.elapsed >= _timer.delay) {
				if (!_timer.processed) {
					_timer.processed = true;
					_timer.fn.apply(null, _timer.args);
				}
				if (_timer.repeat === true) {
					_timer.elapsed -= _timer.delay;
					_timer.processed = false;
				} else {
					this.clearTimeout(_timer.timerId);
				}
			}
		}
	}

	onDestroy() {
		for (const timer of this.timers) {
			if (!timer.isPersistent && timer.native) {
				if (timer.type === "timeout") {
					clearTimeout(timer.id);
				} else if (timer.type === "interval") {
					clearInterval(timer.id);
				}
			}
		}
		this.timers = this.timers.filter((timer) => timer.isPersistent);

		off(BOOT, this.reset);
		off(GAME_BEFORE_UPDATE, this.update);
		off(STATE_RESUME, this.reset);
		off(STATE_RESTART, this.reset);
		off(STATE_CHANGE, this.reset);
	}
}

const timer = new Timer();

/**
 * the default global Timer instance
 * @see Timer
 * @example
 * // set a timer to call "myFunction" after 1000ms
 * timer.setTimeout(myFunction, 1000);
 * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
 * timer.setTimeout(myFunction, 1000, true, param1, param2);
 * // set a timer to call "myFunction" every 1000ms
 * timer.setInterval(myFunction, 1000);
 * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
 * timer.setInterval(myFunction, 1000, true, param1, param2);
 */
export default timer;
