// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	firstBoardLocation,
	secondBoardLocation,
	readPoseAnimation,
	samplePoseAnimation,
	createSwapHarness,
} from "./createMotionRuntimeFx.test/fixture";

describe("motion runtime lifecycle", () => {
	it("deduplicates completed cues and ignores duplicate leg completion", () => {
		const { animations, cue, runtime } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		animations[0]?.onComplete?.();
		animations[0]?.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(2);
		animations[1]?.onComplete?.();
		animations[1]?.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(0);

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		expect(animations).toHaveLength(2);
	});

	it("keeps overlapping spawn and swap ownership explicitly handoff-capable", () => {
		const { cue, runtime, target } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
				{
					actorId: target.item.id,
					eventIndex: 1,
					kind: "spawn",
					originActorId: target.item.id,
					originLocation: secondBoardLocation,
					sequence: cue.sequence,
					staggerIndex: 0,
					targetLocation: firstBoardLocation,
				},
			]),
		);

		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.get(target.item.id),
		).toBe("handoff");
	});

	it("clears claims on close and ignores late swap completion callbacks", () => {
		const {
			animations,
			canceledAnimationKeys,
			cue,
			magneticReleases,
			runtime,
			source,
			target,
		} = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		samplePoseAnimation(readPoseAnimation(animations, target), 0.4);
		samplePoseAnimation(readPoseAnimation(animations, source), 0.4);

		Effect.runSync(runtime.closeFx);
		for (const animation of animations) animation.onComplete?.();

		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		expect(canceledAnimationKeys).toContain(`motion:9:0:${cue.actorId}`);
		expect(canceledAnimationKeys).toContain(`motion:9:0:${cue.counterpartActorId}`);
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
		expect(animations).toHaveLength(2);
	});
});
