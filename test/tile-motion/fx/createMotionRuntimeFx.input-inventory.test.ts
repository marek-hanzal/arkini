// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import "./createMotionRuntimeFx.test/fixture";
import { lifecycleDurationMs } from "~/tile-rendering/fx/runActorLifecycleFx";
import { runInputMotionFx } from "~/tile-motion/fx/runInputMotionFx";

import {
	createActorMap,
	createActorStore,
	createApplication,
	createItemMap,
	createSurface,
	inventoryLocation,
	secondBoardLocation,
	palette,
	createItem,
	createActor,
	createRecordingAnimator,
	createRecordingMagneticField,
	samplePoseAnimation,
	advanceInputRemainderFlash,
	type TileMotionCue,
	type PixiTileActor,
	type ActorAnimation,
} from "./createMotionRuntimeFx.test/fixture";

describe("Inventory input travel", () => {
	it("spawns an Inventory autofill payload at its physical opener and uses ordinary input travel", () => {
		const opener = createActor("runtime:inventory-opener");
		const owner = createActor("runtime:inventory-input-owner");
		const sourceItem = {
			...createItem("runtime:inventory-source", inventoryLocation),
			quantity: 2,
		};
		opener.item = createItem(opener.item.id, {
			scope: "toolbar",
			position: {
				x: 0,
				y: 0,
			},
		});
		owner.item = createItem(owner.item.id, secondBoardLocation);
		opener.container.position.set(500, 24);
		owner.container.position.set(200, 40);
		const actors = createActorMap(opener, owner);
		const animations: ActorAnimation[] = [];
		const animator = createRecordingAnimator({
			animations,
		});
		const transientActorLayer = new Container();
		const openerPose = {
			layer: transientActorLayer,
			size: 64,
			x: 500,
			y: 24,
		};
		const targetPose = {
			layer: transientActorLayer,
			size: 80,
			x: 200,
			y: 40,
		};
		const completed = vi.fn();
		const transients: PixiTileActor[] = [];
		const cue = {
			canonicalItemId: sourceItem.itemId,
			eventIndex: 0,
			kind: "input",
			originActorId: opener.item.id,
			originLocation: opener.item.location,
			previousQuantity: 2,
			storedQuantity: 1,
			resultingQuantity: 1,
			sequence: 44,
			sourceActorId: sourceItem.id,
			sourceItem,
			staggerIndex: 0,
			targetActorId: owner.item.id,
			targetLocation: owner.item.location,
		} satisfies TileMotionCue;

		Effect.runSync(
			runInputMotionFx({
				actorStore: createActorStore({
					actors,
					canonicalItems: createItemMap(owner.item),
				}),
				animator,
				application: createApplication(),
				cue,
				cueKey: "44:0",
				delayMs: 0,
				magneticField: createRecordingMagneticField(),
				onComplete: completed,
				onRemainderRevealed: () => {},
				onPayloadCreated: (actor) => {
					transients.push(actor);
				},
				origin: openerPose,
				readPalette: () => palette,
				readSourceSurvives: () => true,
				surface: createSurface({
					readLocationPose: (location) =>
						location.scope === "toolbar" ? openerPose : targetPose,
					transientActorLayer,
				}),
				target: targetPose,
				textures: {} as never,
			}),
		);

		const transient = transients[0];
		if (transient === undefined) throw new Error("Expected Inventory input transient.");
		expect(transient.item).toMatchObject({
			badgeCount: 2,
			id: "motion:44:0",
			itemId: sourceItem.itemId,
			quantity: 2,
		});
		expect(transient.container).toMatchObject({
			x: openerPose.x,
			y: openerPose.y,
		});
		const delivery = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:44:0",
		);
		if (delivery?.channel !== "pose") throw new Error("Expected Inventory input delivery.");
		expect(delivery).toMatchObject({
			curve: {
				bounce: 0.1,
				kind: "spring",
			},
		});
		const deliveryTarget = samplePoseAnimation(delivery, 1);
		const deliveryOvershoot = samplePoseAnimation(delivery, 1.05);
		expect(deliveryOvershoot.x - deliveryTarget.x).toBeCloseTo(
			(deliveryTarget.x - openerPose.x) * 0.05,
		);
		expect(deliveryOvershoot.y - deliveryTarget.y).toBeCloseTo(
			(deliveryTarget.y - openerPose.y) * 0.05,
		);
		samplePoseAnimation(delivery, 1);
		delivery.onComplete?.();

		expect(transient.item.quantity).toBe(2);
		advanceInputRemainderFlash({
			actor: transient,
			animations,
			cueKey: "44:0",
		});
		expect(transient.item.badgeCount).toBeUndefined();
		const returned = animations
			.filter(
				(animation) =>
					animation.actor === transient &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:44:0",
			)
			.at(-1);
		if (returned?.channel !== "pose") throw new Error("Expected Inventory remainder return.");
		expect(returned).toMatchObject({
			curve: {
				bounce: 0.22,
				kind: "spring",
			},
			delayMs: 0,
		});
		expect(samplePoseAnimation(returned, 1)).toMatchObject({
			x: openerPose.x,
			y: openerPose.y,
		});
		opener.container.x = 560;
		const animationCountBeforeContinuation = animations.length;
		returned.onComplete?.();

		const continuation = animations
			.slice(animationCountBeforeContinuation)
			.find(
				(animation) =>
					animation.actor === transient &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:44:0",
			);
		if (continuation?.channel !== "pose") {
			throw new Error("Expected the retargeted Inventory remainder return.");
		}
		expect(continuation).toMatchObject({
			curve: {
				bounce: 0.22,
				kind: "spring",
			},
			delayMs: 0,
		});
		expect(samplePoseAnimation(continuation, 0)).toMatchObject({
			x: openerPose.x,
			y: openerPose.y,
		});
		expect(samplePoseAnimation(continuation, 1)).toMatchObject({
			x: opener.container.x,
			y: openerPose.y,
		});
		const animationCountBeforeVanish = animations.length;
		continuation.onComplete?.();

		expect(transient.container.destroyed).toBe(false);
		const vanishAnimations = animations.slice(animationCountBeforeVanish);
		const vanishScale = vanishAnimations.find(
			(animation) => animation.actor === transient && animation.channel === "lifecycle-scale",
		);
		if (vanishScale?.channel !== "lifecycle-scale") {
			throw new Error("Expected Inventory remainder scale-down.");
		}
		expect(vanishScale.durationMs).toBe(lifecycleDurationMs);
		expect(vanishScale.toScale).toBeLessThan(1);
		const vanishOpacity = vanishAnimations.find(
			(animation) =>
				animation.actor === transient &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		);
		if (vanishOpacity?.channel !== "lifecycle-opacity") {
			throw new Error("Expected Inventory remainder fade-out.");
		}
		expect(vanishOpacity.durationMs).toBe(lifecycleDurationMs);
		vanishOpacity.onCancel?.();

		expect(transient.container.destroyed).toBe(true);
		expect(completed).toHaveBeenCalledOnce();
		vanishOpacity.onComplete?.();
		expect(completed).toHaveBeenCalledOnce();
	});
});
