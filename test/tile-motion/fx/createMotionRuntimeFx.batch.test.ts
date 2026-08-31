// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";

import { lifecycleDurationMs } from "~/tile-rendering/fx/runActorLifecycleFx";
import { readTravelDurationMsFn } from "~/tile-rendering/fn/readTravelDurationMsFn";

import {
	createMotionHarness,
	createActorMap,
	createItemMap,
	inventoryLocation,
	firstBoardLocation,
	secondBoardLocation,
	createActor,
	readPoseAnimation,
	samplePoseAnimation,
	advanceStackMergeVanish,
	type TileActorItem,
	type TileMotionCue,
} from "./createMotionRuntimeFx.test/fixture";

describe("motion delivery batch", () => {
	it("uses one retained Inventory opener across a delivery batch and fades a spawn in", () => {
		const opener = createActor("runtime:inventory-origin");
		opener.container.position.set(150, 170);
		const spawned = createActor("runtime:spawned");
		const stacked = createActor("runtime:stacked");
		stacked.container.position.set(200, 40);
		const actors = createActorMap(opener, spawned, stacked);
		const canonicalItems = createItemMap(opener.item, spawned.item, {
			...stacked.item,
			quantity: 2,
		});
		const boardActorLayer = new Container();
		let boardGeometry = {
			size: 80,
			stepX: 100,
			y: 40,
		};
		const readLocationPose = (location: TileActorItem["location"]) =>
			location.scope === "inventory"
				? null
				: {
						layer: boardActorLayer,
						size: boardGeometry.size,
						x: location.position.x * boardGeometry.stepX,
						y: boardGeometry.y,
					};
		const { animations, magneticReleases, magneticUpdates, runtime, transientActorLayer } =
			createMotionHarness({
				actors,
				boundingRect: {
					left: 10,
					top: 20,
				},
				canonicalItems,
				readPose: readLocationPose,
			});
		const cues = [
			{
				actorId: spawned.item.id,
				eventIndex: 0,
				kind: "spawn",
				originActorId: "runtime:inventory-origin",
				originLocation: inventoryLocation,
				sequence: 7,
				staggerIndex: 0,
				targetLocation: firstBoardLocation,
			},
			{
				canonicalItemId: stacked.item.itemId,
				eventIndex: 1,
				kind: "stack",
				originActorId: "runtime:inventory-origin",
				originLocation: inventoryLocation,
				quantity: 1,
				sequence: 7,
				staggerIndex: 1,
				targetActorId: stacked.item.id,
				targetLocation: secondBoardLocation,
			},
		] satisfies TileMotionCue[];

		Effect.runSync(runtime.enqueueFx(cues));
		Effect.runSync(runtime.startFx);

		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.has(stacked.item.id),
		).toBe(false);
		expect(spawned.container.alpha).toBe(0);
		expect(spawned.lifecycleLayer.scale.x).toBeLessThan(1);
		expect(animations).toContainEqual(
			expect.objectContaining({
				actor: spawned,
				channel: "lifecycle-scale",
				durationMs: lifecycleDurationMs,
				toScale: 1,
			}),
		);
		expect(animations).toContainEqual(
			expect.objectContaining({
				actor: spawned,
				channel: "lifecycle-opacity",
				durationMs: lifecycleDurationMs,
				toAlpha: 1,
			}),
		);
		expect(spawned.container.x).toBe(150);
		expect(spawned.container.y).toBe(170);

		const spawnTravel = readPoseAnimation(animations, spawned);
		const beforeResize = samplePoseAnimation(spawnTravel, 0.4);
		boardGeometry = {
			size: 120,
			stepX: 160,
			y: 90,
		};
		const resizeFrame = samplePoseAnimation(spawnTravel, 0.4);
		expect(resizeFrame).toEqual(beforeResize);
		const afterResize = samplePoseAnimation(spawnTravel, 0.7);
		expect(afterResize.x).toBeGreaterThan(resizeFrame.x);
		expect(afterResize.y).toBeLessThan(resizeFrame.y);
		const destination = samplePoseAnimation(spawnTravel, 1);
		expect(destination).toEqual({
			scale: 1.5,
			x: 160,
			y: 90,
		});
		spawnTravel.onCompleteFn?.();
		expect(spawned.container).toMatchObject({
			x: destination.x,
			y: destination.y,
		});
		expect(spawned.container.alpha).toBe(0);

		const stackTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:7:1",
		);
		if (stackTravel?.channel !== "pose") {
			throw new Error("Expected stack payload travel.");
		}
		const stackTransient = stackTravel.actor;
		const stackBeforeTargetDrag = samplePoseAnimation(stackTravel, 0.8);
		stacked.dragging = true;
		const draggedStackSize = stacked.size;
		boardGeometry = {
			...boardGeometry,
			size: 160,
		};
		transientActorLayer.addChild(stacked.container);
		stacked.container.pivot.set(40);
		stacked.container.position.set(940, 440);
		const lateTargetMove = samplePoseAnimation(stackTravel, 0.95);
		expect(lateTargetMove.x).toBeGreaterThan(stackBeforeTargetDrag.x);
		expect(lateTargetMove.x).toBeLessThan(250);
		expect(lateTargetMove.y).toBeLessThan(stackBeforeTargetDrag.y);
		const firstEndpoint = samplePoseAnimation(stackTravel, 1);
		expect(firstEndpoint).toEqual({
			scale: 1.5,
			x: 900,
			y: 400,
		});
		stacked.container.position.set(1_240, 640);
		stackTravel.onCompleteFn?.();
		expect(stacked.item.quantity).toBe(1);

		const finalContact = animations
			.filter(
				(animation) => animation.actor === stackTransient && animation.channel === "pose",
			)
			.at(-1);
		if (finalContact?.channel !== "pose") {
			throw new Error("Expected final live-target contact segment.");
		}
		expect(finalContact.durationMs).toBe(
			readTravelDurationMsFn({
				fromX: 900,
				fromY: 400,
				tileSize: 120,
				toX: 1_200,
				toY: 600,
			}),
		);
		expect(samplePoseAnimation(finalContact, 1)).toEqual({
			scale: 1.5,
			x: 1_200,
			y: 600,
		});
		// Magnetic feedback is child-local presentation only. It must not move the physical
		// contact anchor or recursively extend the stack chase.
		stacked.offsetLayer.position.set(6, -4);
		const animationCountBeforeContact = animations.length;
		expect(
			animations.filter(
				(animation) =>
					animation.actor === stacked && animation.channel === "activity-particles",
			),
		).toHaveLength(0);
		expect(
			magneticReleases.filter((release) => release.sourceActorId === stackTransient.item.id),
		).toHaveLength(0);
		finalContact.onCompleteFn?.();
		expect(animations.length).toBeGreaterThanOrEqual(animationCountBeforeContact + 3);
		advanceStackMergeVanish({
			actor: stackTransient,
			animations,
		});
		expect(stacked.item.quantity).toBe(2);
		expect(stacked.size).toBe(draggedStackSize);
		expect(stacked.container.parent).toBe(transientActorLayer);
		expect(stackTransient.container.destroyed).toBe(true);
		expect(magneticUpdates.length).toBeGreaterThan(0);
		expect(magneticUpdates.at(-1)).toMatchObject({
			attractedActorId: stacked.item.id,
			sourceActorId: stackTransient.item.id,
			sourceKind: "motion",
		});
		expect(
			magneticReleases.filter((release) => release.sourceActorId === stackTransient.item.id),
		).toEqual([
			{
				sourceActorId: stackTransient.item.id,
				sourceKind: "motion",
			},
		]);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === stacked && animation.channel === "activity-particles",
			),
		).toHaveLength(1);
		Effect.runSync(runtime.closeFx);
		expect(spawned.container.destroyed).toBe(false);
	});
});
