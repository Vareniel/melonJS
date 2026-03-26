import { Vector2d } from "../math/vector2d.ts";
import Renderable from "./../renderable/renderable.js";
import Trigger from "../renderable/trigger.js";
import { ONCOLLISION_ENTER, ONCOLLISION_EXIT } from "../system/event.ts";
import { Bounds } from "./bounds.ts";
import ResponseObject from "./response.js";
import {
	testEllipseEllipse,
	testEllipsePolygon,
	testPolygonEllipse,
	testPolygonPolygon,
} from "./sat.js";

// pre-built lookup table for SAT collision tests to avoid string concatenation
const SAT_LOOKUP = {
	PolygonPolygon: testPolygonPolygon,
	PolygonEllipse: testPolygonEllipse,
	EllipsePolygon: testEllipsePolygon,
	EllipseEllipse: testEllipseEllipse,
};

/**
 * @import Entity from "./../renderable/entity/entity.js";
 * @import Container from "./../renderable/container.js";
 * @import Renderable from "./../renderable/renderable.js";
 * @import Sprite from "./../renderable/sprite.js";
 * @import NineSliceSprite from "./../renderable/nineslicesprite.js";
 * @import {Line} from "./../geometries/line.ts";
 */

// a dummy object when using Line for raycasting
const dummyObj = {
	pos: new Vector2d(0, 0),
	ancestor: {
		_absPos: new Vector2d(0, 0),
		getAbsolutePosition: function () {
			return this._absPos;
		},
	},
};

// some cache bounds object used for collision detection
const boundsA = new Bounds();
const boundsB = new Bounds();

/**
 * the Detector class contains methods for detecting collisions between bodies using a broadphase algorithm.
 */
class Detector {
	/**
	 * @param {Container} world - the physic world this detector is bind to
	 */
	constructor(world) {
		// @ignore
		this.world = world;

		/**
		 * the default response object used for collisions
		 * (will be automatically populated by the collides functions)
		 * @type {ResponseObject}
		 */
		this.response = new ResponseObject();
		this._lastFrameContacts = new Map();
		this._currentFrameContacts = new Map();
		this._processedPairs = new Set(); // Track processed pairs in current frame
	}

	/**
	 * determine if two objects should collide (based on both respective objects body collision mask and type).<br>
	 * you can redefine this function if you need any specific rules over what should collide with what.
	 * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} a - a reference to the object A.
	 * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} b - a reference to the object B.
	 * @returns {boolean} true if they should collide, false otherwise
	 */
	shouldCollide(a, b) {
		let bodyA = a.body,
			bodyB = b.body;
		return (
			typeof bodyA === "object" &&
			typeof bodyB === "object" &&
			a !== b &&
			a.isKinematic !== true &&
			b.isKinematic !== true &&
			bodyA.shapes.length > 0 &&
			bodyB.shapes.length > 0 &&
			!(bodyA.isStatic === true && bodyB.isStatic === true) &&
			(bodyA.collisionMask & bodyB.collisionType) !== 0 &&
			(bodyB.collisionMask & bodyA.collisionType) !== 0
		);
	}

	/**
	 * detect collision between two bodies.
	 * @param {Body} bodyA - a reference to body A.
	 * @param {Body} bodyB - a reference to body B.
	 * @returns {boolean} true if colliding
	 */
	collides(bodyA, bodyB, response = this.response) {
		// for each shape in body A
		for (
			let indexA = bodyA.shapes.length, shapeA;
			indexA--, (shapeA = bodyA.shapes[indexA]);
		) {
			// for each shape in body B
			for (
				let indexB = bodyB.shapes.length, shapeB;
				indexB--, (shapeB = bodyB.shapes[indexB]);
			) {
				// full SAT collision check
				if (
					SAT_LOOKUP[shapeA.type + shapeB.type].call(
						this,
						bodyA.ancestor, // a reference to the object A
						shapeA,
						bodyB.ancestor, // a reference to the object B
						shapeB,
						// clear response object before reusing
						response.clear(),
					) === true
				) {
					// set the shape index
					response.indexShapeA = indexA;
					response.indexShapeB = indexB;

					return true;
				}
			}
		}
		return false;
	}

	/**
	 * detect ALL collisions between two bodies and return collision data for each shape pair
	 * @param {Body} bodyA - a reference to body A.
	 * @param {Body} bodyB - a reference to body B.
	 * @returns {Array|false} array of collision data or false if no collisions
	 */
	collidesMultiple(bodyA, bodyB) {
		const collisions = [];
		const scaleAx = bodyA.ancestor._scaleX ?? 1;
		const scaleAy = bodyA.ancestor._scaleY ?? 1;
		const scaleBx = bodyB.ancestor._scaleX ?? 1;
		const scaleBy = bodyB.ancestor._scaleY ?? 1;
		const widthA = bodyA.ancestor.width ?? 1;
		const heightA = bodyA.ancestor.height ?? 1;
		const widthB = bodyB.ancestor.width ?? 1;
		const heightB = bodyB.ancestor.height ?? 1;

		// Iterate through each shape in body A
		for (
			let indexA = bodyA.shapes.length, shapeA;
			indexA--, (shapeA = bodyA.shapes[indexA]);
		) {
			// Skip if shape A is not active
			if (!shapeA.isActive) {
				continue;
			}

			// Iterate through each shape in body B
			for (
				let indexB = bodyB.shapes.length, shapeB;
				indexB--, (shapeB = bodyB.shapes[indexB]);
			) {
				// Skip if shape B is not active
				if (!shapeB.isActive) {
					continue;
				}

				// ===== CHECK COLLISION MASK PER SHAPE =====
				// Fallback to body mask if shape doesn't have its own mask
				const maskA = shapeA.collisionMask ?? bodyA.collisionMask;
				const typeA = shapeA.collisionType ?? bodyA.collisionType;
				const maskB = shapeB.collisionMask ?? bodyB.collisionMask;
				const typeB = shapeB.collisionType ?? bodyB.collisionType;

				// Check if this shape pair is allowed to collide
				if ((maskA & typeB) === 0 || (typeA & maskB) === 0) {
					continue;
				}
				// ==========================================

				// ===== APPLY SCALE TEMPORARILY TO SHAPES =====
				this._applyScaleToShape(shapeA, scaleAx, scaleAy, widthA, heightA);
				this._applyScaleToShape(shapeB, scaleBx, scaleBy, widthB, heightB);
				// ==========================================

				// Create a new response object for this collision test
				const tempResponse = new ResponseObject();

				const hit =
					SAT_LOOKUP[shapeA.type + shapeB.type].call(
						this,
						bodyA.ancestor,
						shapeA,
						bodyB.ancestor,
						shapeB,
						tempResponse.clear(),
					) === true;

				// ===== RESTORE SCALE SHAPES =====
				this._restoreScaleFromShape(shapeA, scaleAx, scaleAy);
				this._restoreScaleFromShape(shapeB, scaleBx, scaleBy);
				// ================================

				if (hit) {
					collisions.push({
						shapeAIndex: indexA,
						shapeBIndex: indexB,
						response: tempResponse,
						circleCircle:
							shapeA.shapeType === "Ellipse" && shapeB.shapeType === "Ellipse",
						shapeA: shapeA,
						shapeB: shapeB,
					});
				}
			}
		}

		return collisions.length > 0 ? collisions : false;
	}

	/**
	 * Temporarily apply scale transform to a shape's geometry
	 * @param {Shape} shape
	 * @param {number} sx - scale X
	 * @param {number} sy - scale Y
	 */
	_applyScaleToShape(shape, sx, sy, sw, sh) {
		shape._origPosX = shape.pos.x;
		shape._origPosY = shape.pos.y;

		if (sx !== 1) {
			const shapeOffsetX = shape.pos.x + sw / 2;
			shape.pos.x = shapeOffsetX - (sw * sx) / 2;
		}

		if (sy !== 1) {
			const shapeOffsetY = shape.pos.y + sh / 2;
			shape.pos.y = shapeOffsetY - (sh * sy) / 2;
		}
	}

	/**
	 * Restore shape geometry back to original (undo scale)
	 * @param {Shape} shape
	 * @param {number} sx - scale X
	 * @param {number} sy - scale Y
	 */
	_restoreScaleFromShape(shape, sx, sy) {
		if (sx !== 1) {
			shape.pos.x = shape._origPosX;
		}
		if (sy !== 1) {
			shape.pos.y = shape._origPosY;
		}
	}

	/**
	 * Generate unique pair key for two objects
	 * @param {Object} objA - First object
	 * @param {Object} objB - Second object
	 * @returns {string} Unique pair identifier
	 */
	_generatePairKey(objA, objB) {
		return `${Math.min(objA._id, objB._id)}-${Math.max(objA._id, objB._id)}`;
	}

	/**
	 * Process collision start/end events for a pair of objects
	 * @param {Object} objA - First object
	 * @param {Object} objB - Second object
	 * @param {Array} collisionResults - Array of collision data
	 */
	_processCollisionStartEnd(objA, objB, collisionResults) {
		const pairKey = this._generatePairKey(objA, objB);
		if (this._processedPairs.has(pairKey)) {
			return;
		}
		this._processedPairs.add(pairKey);

		if (!collisionResults || collisionResults.length === 0) {
			return;
		}

		collisionResults.forEach((result) => {
			const contactId = ResponseObject.calculatePairHash(
				objA._id,
				objB._id,
				result.shapeAIndex,
				result.shapeBIndex,
			);

			const collisionInfo = {
				shapeA: result.shapeA,
				shapeB: result.shapeB,
				indexShapeA: result.shapeAIndex,
				indexShapeB: result.shapeBIndex,
			};

			this._currentFrameContacts.set(contactId, {
				a: objA,
				b: objB,
				response: result.response,
				collisionInfo,
			});

			// === COLLISION START ===
			if (!this._lastFrameContacts.has(contactId)) {
				objA.events.emit(ONCOLLISION_ENTER, objA, objB, collisionInfo);

				objB.events.emit(ONCOLLISION_ENTER, objB, objA, collisionInfo);

				if (objA instanceof Renderable) {
					objA.onCollisionStart(objA, objB, result.response, collisionInfo);
				}

				if (objB instanceof Renderable) {
					objB.onCollisionStart(objB, objA, result.response, collisionInfo);
				}
			}
		});
	}

	/**
	 * Process collision end events for contacts that are no longer active.
	 * This should be called once per frame after all collision checks.
	 */
	processCollisionEndEvents() {
		for (const [id, c] of this._lastFrameContacts) {
			if (!this._currentFrameContacts.has(id)) {
				const { a, b, response, collisionInfo } = c;

				a.events.emit(ONCOLLISION_EXIT, a, b, collisionInfo);
				b.events.emit(ONCOLLISION_EXIT, b, a, collisionInfo);

				if (a instanceof Renderable) {
					a.onCollisionEnd(a, b, response, collisionInfo);
				}

				if (b instanceof Renderable) {
					b.onCollisionEnd(b, a, response, collisionInfo);
				}
			}
		}
	}

	/**
	 * Prepare for next frame - should be called at the end of physics step
	 */
	prepareNextFrame() {
		// Process collision end events
		this.processCollisionEndEvents();

		// Swap frame contacts
		this._lastFrameContacts.clear();
		this._lastFrameContacts = new Map(this._currentFrameContacts);
		this._currentFrameContacts.clear();

		// Clear processed pairs for next frame
		this._processedPairs.clear();
	}

	/**
	 * find all the collisions for the specified object using a broadphase algorithm
	 * This method now also handles collision start/end events efficiently
	 * @ignore
	 * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} objA - object to be tested for collision
	 * @returns {boolean} in case of collision, false otherwise
	 */
	collisions(objA) {
		let collisionCounter = 0;
		// retreive a list of potential colliding objects from the game world
		const candidates = this.world.broadphase.retrieve(objA);

		boundsA.addBounds(objA.getBounds(), true);
		boundsA.addBounds(objA.body.getBounds());

		candidates.forEach((objB) => {
			// check if both objects "should" collide
			if (this.shouldCollide(objA, objB)) {
				boundsB.addBounds(objB.getBounds(), true);
				boundsB.addBounds(objB.body.getBounds());

				// fast AABB check if both bounding boxes are overlaping
				if (boundsA.overlaps(boundsB)) {
					// Check for multiple collisions instead of just one
					const multipleCollisions = this.collidesMultiple(
						objA.body,
						objB.body,
					);

					// Process collision start/end events
					this._processCollisionStartEnd(objA, objB, multipleCollisions);

					if (multipleCollisions) {
						// we touched something !
						collisionCounter++;
						const isATrigger = objA instanceof Trigger;
						const isBTrigger = objB instanceof Trigger;

						// Process each collision separately for response
						multipleCollisions.forEach((collision) => {
							this.response = collision.response;
							this.response.indexShapeA = collision.shapeAIndex;
							this.response.indexShapeB = collision.shapeBIndex;

							const collisionInfo = {
								shapeA: collision.shapeA,
								shapeB: collision.shapeB,
								indexShapeA: collision.shapeAIndex,
								indexShapeB: collision.shapeBIndex,
							};

							if (
								objA.onCollision &&
								objA.onCollision(this.response, objB, collisionInfo) !==
									false &&
								objA.body?.isStatic === false &&
								!isBTrigger
							) {
								const shapeASolid = collision.shapeA.isTrigger !== true;
								const shapeBSolid = collision.shapeB.isTrigger !== true;
								if (shapeASolid && shapeBSolid) {
									objA.body.respondToCollision.call(
										objA.body,
										this.response,
										true,
									);
								}
							}

							if (
								objB.onCollision &&
								objB.onCollision(this.response, objA, collisionInfo) !==
									false &&
								objB.body?.isStatic === false &&
								!isATrigger
							) {
								const shapeASolid = collision.shapeA.isTrigger !== true;
								const shapeBSolid = collision.shapeB.isTrigger !== true;
								if (shapeASolid && shapeBSolid) {
									objB.body.respondToCollision.call(
										objB.body,
										this.response,
										false,
									);
								}
							}
						});

						// for multi-shape bodies (e.g. polylines), resolve remaining
						// overlaps at segment junctions
						if (objA.body.shapes.length > 1 || objB.body.shapes.length > 1) {
							let extraPasses = 3;
							while (extraPasses-- > 0 && this.collides(objA.body, objB.body)) {
								const overlap = this.response.overlapV;
								const overlapN = this.response.overlapN;

								// mass ratio for proportional response
								const bothDynamic = !objA.body.isStatic && !objB.body.isStatic;
								const totalMass = bothDynamic
									? objA.body.mass + objB.body.mass
									: 0;
								const ratioA = bothDynamic
									? totalMass > 0
										? objB.body.mass / totalMass
										: 0.5
									: 1;
								const ratioB = bothDynamic
									? totalMass > 0
										? objA.body.mass / totalMass
										: 0.5
									: 1;

								// correct position
								if (objA.body.isStatic === false) {
									objA.body.ancestor.pos.set(
										objA.body.ancestor.pos.x - overlap.x * ratioA,
										objA.body.ancestor.pos.y - overlap.y * ratioA,
										objA.body.ancestor.pos.z,
									);
									// cancel velocity into this surface (no bounce)
									const projVel =
										objA.body.vel.x * overlapN.x + objA.body.vel.y * overlapN.y;
									if (projVel > 0) {
										objA.body.vel.x -= projVel * ratioA * overlapN.x;
										objA.body.vel.y -= projVel * ratioA * overlapN.y;
									}
								}
								if (objB.body.isStatic === false) {
									objB.body.ancestor.pos.set(
										objB.body.ancestor.pos.x + overlap.x * ratioB,
										objB.body.ancestor.pos.y + overlap.y * ratioB,
										objB.body.ancestor.pos.z,
									);
									const projVel =
										objB.body.vel.x * overlapN.x + objB.body.vel.y * overlapN.y;
									if (projVel > 0) {
										objB.body.vel.x -= projVel * ratioB * overlapN.x;
										objB.body.vel.y -= projVel * ratioB * overlapN.y;
									}
								}
								// update bounds after position changed
								boundsA.addBounds(objA.getBounds(), true);
								boundsA.addBounds(objA.body.getBounds());
							}
						}
					}
				}
			}
		});

		// we could return the amount of objects we collided with ?
		return collisionCounter > 0;
	}

	/**
	 * Checks for object colliding with the given line
	 * @ignore
	 * @param {Line} line - line to be tested for collision
	 * @param {Array.<Renderable>} [result] - a user defined array that will be populated with intersecting physic objects.
	 * @returns {Array.<Renderable>} an array of intersecting physic objects
	 * @example
	 *    // define a line accross the viewport
	 *    let ray = new Line(
	 *        // absolute position of the line
	 *        0, 0, [
	 *        // starting point relative to the initial position
	 *        new Vector2d(0, 0),
	 *        // ending point
	 *        new Vector2d(me.game.viewport.width, me.game.viewport.height)
	 *    ]);
	 *
	 *    // check for collition
	 *    result = me.collision.rayCast(ray);
	 *
	 *    if (result.length > 0) {
	 *        // ...
	 *    }
	 */
	rayCast(line, result = []) {
		let collisionCounter = 0;

		// retrieve a list of potential colliding objects from the game world
		const candidates = this.world.broadphase.retrieve(line);

		for (let i = candidates.length, objB; i--, (objB = candidates[i]); ) {
			// fast AABB check if both bounding boxes are overlaping
			if (objB.body && line.getBounds().overlaps(objB.getBounds())) {
				// go trough all defined shapes in B (if any)
				const bLen = objB.body.shapes.length;
				if (objB.body.shapes.length === 0) {
					continue;
				}

				const shapeA = line;

				// go through all defined shapes in B
				let indexB = 0;
				do {
					const shapeB = objB.body.getShape(indexB);

					// full SAT collision check
					if (
						SAT_LOOKUP[shapeA.type + shapeB.type].call(
							this,
							dummyObj, // a reference to the object A
							shapeA,
							objB, // a reference to the object B
							shapeB,
						)
					) {
						// we touched something !
						result[collisionCounter] = objB;
						collisionCounter++;
					}
					indexB++;
				} while (indexB < bLen);
			}
		}

		// cap result in case it was not empty
		result.length = collisionCounter;

		// return the list of colliding objects
		return result;
	}
}
export default Detector;
