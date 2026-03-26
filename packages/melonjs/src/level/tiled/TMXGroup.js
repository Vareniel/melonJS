import { clamp } from "./../../math/math.ts";
import TMXLayer from "./TMXLayer.js";
import TMXObject from "./TMXObject.js";
import { applyTMXProperties } from "./TMXUtils.js";

/**
 * object group definition as defined in Tiled.
 * (group definition is translated into the virtual `me.game.world` using `me.Container`)
 * @ignore
 */
export default class TMXGroup {
	constructor(map, data = {}, z) {
		/**
		 * group name
		 * @type {string}
		 */
		this.name = data.name;

		/**
		 * group width
		 * @type {number}
		 */
		this.width = data.width || 0;

		/**
		 * group height
		 * @type {number}
		 */
		this.height = data.height || 0;

		/**
		 * tint color
		 * @type {string}
		 */
		this.tintcolor = data.tintcolor;

		/**
		 * the group class
		 * @type {string}
		 */
		this.class = data.class;

		/**
		 * container x position
		 * @type {number}
		 */
		this.x = data.x || 0;

		/**
		 * container y position
		 * @type {number}
		 */
		this.y = data.y || 0;

		/**
		 * group z order
		 * @type {number}
		 */
		this.z = z;

		/**
		 * Define the container opacity<br>
		 * Set to zero if you do not wish an object to be drawn
		 * @type {number}
		 * @default 1.0
		 */
		this.opacity = data.opacity ?? 1.0;

		/**
		 * group objects list definition
		 * @see {@link TMXObject}
		 * @type {object[]}
		 */
		this.objects = [];

		const visible = data.visible ?? true;
		this.opacity = visible === true ? clamp(+data.opacity || 1.0, 0.0, 1.0) : 0;
		this.type = data.type;

		// check if we have any user-defined properties
		try {
			applyTMXProperties(this, data);
		} catch (e) {
			console.error("Error applying TMX properties to group:", e);
		}

		// parse all child objects/layers
		if (Array.isArray(data.objects)) {
			const objects = data.objects;
			for (let i = 0, len = objects.length; i < len; i++) {
				try {
					let object = objects[i];
					// Validasi koordinat object sebelum membuat TMXObject baru
					const validatedObject = {
						...object,
						x: parseFloat(object.x) || 0,
						y: parseFloat(object.y) || 0,
						width: parseFloat(object.width) || 0,
						height: parseFloat(object.height) || 0,
						tintcolor: this.tintcolor,
					};
					const baseOrder = object?.inspectors?.z ?? 0; // base z order on editor level
					const finalOrder = Number(baseOrder) + z; // final z order
					objects[i].tintcolor = this.tintcolor;
					this.objects.push(new TMXObject(map, validatedObject, finalOrder));
				} catch (e) {
					console.error(
						"Error creating TMXObject:",
						e,
						objects[i].constructor.name,
						objects[i],
					);
				}
			}
		}

		if (Array.isArray(data.layers)) {
			const layers = data.layers;
			for (let i = 0, len = layers.length; i < len; i++) {
				try {
					let layer = new TMXLayer(
						map,
						layers[i],
						map.tilewidth,
						map.tileheight,
						map.orientation,
						map.tilesets,
						z++,
					);
					// set a renderer
					layer.setRenderer(map.getRenderer());
					// resize container accordingly
					this.width = Math.max(this.width, layer.width);
					this.height = Math.max(this.height, layer.height);
					this.objects.push(layer);
				} catch (e) {
					console.error(
						"Error creating TMXLayer:",
						e,
						layers[i].constructor.name,
						layers[i],
					);
				}
			}
		}
	}

	/**
	 * reset function
	 * @ignore
	 */
	destroy() {
		// clear all allocated objects
		this.objects = null;
	}

	/**
	 * return the object count
	 * @ignore
	 */
	getObjectCount() {
		return this.objects.length;
	}

	/**
	 * returns the object at the specified index
	 * @ignore
	 */
	getObjectByIndex(idx) {
		return this.objects[idx];
	}
}
