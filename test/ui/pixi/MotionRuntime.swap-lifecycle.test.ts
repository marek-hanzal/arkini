// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	lifecycleDurationMs,
	lifecycleReducedScale,
} from "~/ui/pixi/animation/runActorLifecycleFx";

import {
	firstBoardLocation,
	secondBoardLocation,
	createItem,
	createActor,
	readPoseAnimation,
	samplePoseAnimation,
	createSwapHarness,
	type TileMotionCue,
} from "~test/ui/pixi/MotionRuntime.test/fixture";

describe("detached swap lifecycle", () => {
	it("releases a detached swap counterpart when the motion runtime closes", () => {
		const { animations, cue, magneticReleases, runtime, source, target } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		samplePoseAnimation(readPoseAnimation(animations, target), 0.35);
		samplePoseAnimation(readPoseAnimation(animations, source), 0.35);

		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);
		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.get(source.item.id),
		).toBe("handoff");
		Effect.runSync(runtime.closeFx);

		expect(magneticReleases).toEqual(
			expect.arrayContaining([
				{
					sourceActorId: target.item.id,
					sourceKind: "motion",
				},
				{
					sourceActorId: source.item.id,
					sourceKind: "motion",
				},
			]),
		);
	});

	it("keeps pending work parked when an independent cue completes during detached swap ownership", () => {
		const { actors, animations, canonicalItems, cue, runtime, source, target } =
			createSwapHarness();
		const independent = createActor("runtime:independent-spawn");
		independent.item = createItem(independent.item.id, firstBoardLocation);
		actors.set(independent.item.id, independent);
		canonicalItems.set(independent.item.id, independent.item);
		const independentCue = {
			actorId: independent.item.id,
			eventIndex: 0,
			kind: "spawn",
			originActorId: "runtime:independent-origin",
			originLocation: secondBoardLocation,
			sequence: 10,
			staggerIndex: 0,
			targetLocation: firstBoardLocation,
		} satisfies TileMotionCue;
		const pendingDetachedCue = {
			actorId: source.item.id,
			eventIndex: 0,
			kind: "spawn",
			originActorId: "runtime:pending-origin",
			originLocation: firstBoardLocation,
			sequence: 12,
			staggerIndex: 0,
			targetLocation: secondBoardLocation,
		} satisfies TileMotionCue;
		Effect.runSync(
			runtime.enqueueFx([
				cue,
				independentCue,
				pendingDetachedCue,
			]),
		);
		Effect.runSync(runtime.startFx);
		expect(independent.container.alpha).toBe(0);
		expect(independent.lifecycleLayer.scale.x).toBe(lifecycleReducedScale);
		expect(animations).toContainEqual(
			expect.objectContaining({
				actor: independent,
				channel: "lifecycle-scale",
				durationMs: lifecycleDurationMs,
				toScale: 1,
			}),
		);
		expect(animations).toContainEqual(
			expect.objectContaining({
				actor: independent,
				channel: "lifecycle-opacity",
				durationMs: lifecycleDurationMs,
				toAlpha: 1,
			}),
		);
		const sourceTravel = readPoseAnimation(animations, source);
		const independentTravel = readPoseAnimation(animations, independent);

		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);
		samplePoseAnimation(independentTravel, 1);
		independentTravel.onComplete?.();

		expect(
			animations.some(
				(animation) => animation.channel === "pose" && animation.ownerKey === "motion:12:0",
			),
		).toBe(false);
		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.get(source.item.id),
		).toBe("handoff");

		samplePoseAnimation(sourceTravel, 1);
		sourceTravel.onComplete?.();

		expect(
			animations.some(
				(animation) => animation.channel === "pose" && animation.ownerKey === "motion:12:0",
			),
		).toBe(true);
	});

	it("finalizes a detached swap counterpart that loses its canonical item before settlement", () => {
		const { actors, animations, canonicalItems, cue, exitingActors, runtime, source, target } =
			createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		samplePoseAnimation(readPoseAnimation(animations, target), 0.4);
		const sourceTravel = readPoseAnimation(animations, source);
		samplePoseAnimation(sourceTravel, 0.4);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);
		canonicalItems.delete(source.item.id);

		samplePoseAnimation(sourceTravel, 1);
		sourceTravel.onComplete?.();

		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.has(source.item.id),
		).toBe(false);
		expect(actors.has(source.item.id)).toBe(false);
		expect(exitingActors.has(source)).toBe(true);
		expect(animations).toContainEqual(
			expect.objectContaining({
				actor: source,
				channel: "lifecycle-opacity",
				toAlpha: 0,
			}),
		);
	});

	it("finalizes an already-settled counterpart when the other swap leg is handed off", () => {
		const { actors, animations, canonicalItems, cue, exitingActors, runtime, source, target } =
			createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const sourceTravel = readPoseAnimation(animations, source);
		samplePoseAnimation(sourceTravel, 1);
		canonicalItems.delete(source.item.id);
		sourceTravel.onComplete?.();

		expect(actors.has(source.item.id)).toBe(true);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);
		expect(actors.has(source.item.id)).toBe(false);
		expect(exitingActors.has(source)).toBe(true);
	});
});
