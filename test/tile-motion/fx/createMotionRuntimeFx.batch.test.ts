// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";

import { lifecycleDurationMs } from "~/tile-rendering/fx/runActorLifecycleFx";

import {
	createMotionHarness,
	createActorMap,
	createItemMap,
	originBoardLocation,
	firstBoardLocation,
	secondBoardLocation,
	createActor,
	readPoseAnimation,
	samplePoseAnimation,
	type TileActorItem,
	type TileMotionCue,
} from "./createMotionRuntimeFx.test/fixture";

describe("motion delivery batch", () => {
	it("uses one retained producer across a delivery batch and fades a spawn in", () => {
		const opener = createActor("runtime:producer-origin");
		opener.container.position.set(150, 170);
		const spawned = createActor("runtime:spawned");
		const secondSpawn = createActor("runtime:secondSpawn");
		secondSpawn.container.position.set(200, 40);
		const actors = createActorMap(opener, spawned, secondSpawn);
		const canonicalItems = createItemMap(opener.item, spawned.item, {
			...secondSpawn.item,
		});
		const boardActorLayer = new Container();
		let boardGeometry = {
			size: 80,
			stepX: 100,
			y: 40,
		};
		const readLocationPose = (location: TileActorItem["location"]) =>
			location.position.x === 0
				? null
				: {
						layer: boardActorLayer,
						size: boardGeometry.size,
						x: location.position.x * boardGeometry.stepX,
						y: boardGeometry.y,
					};
		const { animations, runtime } = createMotionHarness({
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
				originActorId: "runtime:producer-origin",
				originLocation: originBoardLocation,
				sequence: 7,
				staggerIndex: 0,
				targetLocation: firstBoardLocation,
			},
			{
				actorId: secondSpawn.item.id,
				eventIndex: 1,
				kind: "spawn",
				originActorId: "runtime:producer-origin",
				originLocation: originBoardLocation,
				sequence: 7,
				staggerIndex: 1,
				targetLocation: secondBoardLocation,
			},
		] satisfies TileMotionCue[];

		Effect.runSync(runtime.enqueueFx(cues));
		Effect.runSync(runtime.startFx);

		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.has(
				secondSpawn.item.id,
			),
		).toBe(true);
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

		Effect.runSync(runtime.closeFx);
		expect(spawned.container.destroyed).toBe(false);
	});
});
