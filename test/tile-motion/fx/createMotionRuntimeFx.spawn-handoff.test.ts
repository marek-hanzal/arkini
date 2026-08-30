// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { lifecycleDurationMs } from "~/ui/pixi/animation/runActorLifecycleFx";

import {
	readPoseAnimation,
	samplePoseAnimation,
	createSpawnHarness,
} from "./createMotionRuntimeFx.test/fixture";

describe("spawn interaction handoff", () => {
	it("hands an active spawn to direct interaction at its exact live pose", () => {
		const {
			animations,
			canceledAnimationKeys,
			magneticReleases,
			magneticUpdates,
			runtime,
			spawnCue,
			spawned,
		} = createSpawnHarness();
		Effect.runSync(
			runtime.enqueueFx([
				spawnCue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const spawnTravel = readPoseAnimation(animations, spawned);
		const livePose = samplePoseAnimation(spawnTravel, 0.43);
		const fadeGeneration = spawned.lifecycleIntentGeneration;

		expect(Effect.runSync(runtime.beginInteractionHandoffFx(spawned.item.id))).toBe(true);

		expect(canceledAnimationKeys).toContain("motion:11:0");
		expect(magneticUpdates).toHaveLength(1);
		expect(magneticUpdates[0]).toMatchObject({
			attractedActorId: null,
			sourceActorId: spawned.item.id,
			sourceDirection: {
				x: -1,
				y: 0,
			},
			sourceKind: "motion",
		});
		expect(magneticUpdates[0]?.eligibleAttractionActorIds.size).toBe(0);
		expect(magneticReleases).toEqual([
			{
				sourceActorId: spawned.item.id,
				sourceKind: "motion",
			},
		]);
		expect(
			animations
				.filter((animation) => animation.actor === spawned)
				.map((animation) => animation.channel),
		).toEqual([
			"lifecycle-scale",
			"lifecycle-opacity",
			"pose",
		]);
		expect(spawned.lifecycleIntentGeneration).toBe(fadeGeneration);
		expect(spawned.container).toMatchObject({
			x: livePose.x,
			y: livePose.y,
		});
		const snapshot = Effect.runSync(runtime.readSnapshotFx);
		expect(snapshot.interactionClaimByActorId.has(spawned.item.id)).toBe(false);
		expect(snapshot.spawnCueByActorId.has(spawned.item.id)).toBe(false);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(spawned.item.id))).toBe(false);
	});

	it("releases a spawned magnetic source on natural settlement", () => {
		const { animations, magneticReleases, runtime, spawnCue, spawned } = createSpawnHarness();
		Effect.runSync(
			runtime.enqueueFx([
				spawnCue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const spawnTravel = readPoseAnimation(animations, spawned);
		samplePoseAnimation(spawnTravel, 1);
		spawnTravel.onComplete?.();

		expect(magneticReleases).toEqual([
			{
				sourceActorId: spawned.item.id,
				sourceKind: "motion",
			},
		]);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
	});

	it("starts the durable fade when a pending spawn is handed directly to interaction", () => {
		const {
			animations,
			blocker,
			blockerCue,
			canceledAnimationKeys,
			runtime,
			spawnCue,
			spawned,
		} = createSpawnHarness();
		const pendingPose = {
			x: spawned.container.x,
			y: spawned.container.y,
		};
		Effect.runSync(
			runtime.enqueueFx([
				blockerCue,
				spawnCue,
			]),
		);
		Effect.runSync(runtime.startFx);

		expect(animations.some((animation) => animation.actor === spawned)).toBe(false);
		expect(Effect.runSync(runtime.readSnapshotFx).spawnCueByActorId.has(spawned.item.id)).toBe(
			true,
		);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(spawned.item.id))).toBe(true);

		expect(canceledAnimationKeys).not.toContain("motion:11:0");
		expect(spawned.container).toMatchObject(pendingPose);
		expect(spawned.lifecycleIntentGeneration).toBe(1);
		expect(spawned.lifecycleTargetAlpha).toBe(1);
		expect(spawned.lifecycleTransitionStarted).toBe(true);
		const spawnedLifecycle = animations.filter((animation) => animation.actor === spawned);
		expect(spawnedLifecycle).toEqual([
			expect.objectContaining({
				channel: "lifecycle-scale",
				durationMs: lifecycleDurationMs,
				toScale: 1,
			}),
			expect.objectContaining({
				channel: "lifecycle-opacity",
				durationMs: lifecycleDurationMs,
				toAlpha: 1,
			}),
		]);
		const snapshot = Effect.runSync(runtime.readSnapshotFx);
		expect(snapshot.spawnCueByActorId.has(spawned.item.id)).toBe(false);
		expect(snapshot.interactionClaimByActorId.has(spawned.item.id)).toBe(false);
		expect(snapshot.interactionClaimByActorId.get(blocker.item.id)).toBe("handoff");

		const blockerTravel = readPoseAnimation(animations, blocker);
		blockerTravel.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
	});
});
