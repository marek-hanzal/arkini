// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	firstBoardLocation,
	secondBoardLocation,
	readPoseAnimation,
	samplePoseAnimation,
	createSwapHarness,
	type TileMotionCue,
} from "./createMotionRuntimeFx.test/fixture";

const readOverflowingCuesFn = (cue: TileMotionCue) =>
	Array.from(
		{
			length: 256,
		},
		(_, index) => ({
			...cue,
			eventIndex: index + 1,
		}),
	);

describe("motion runtime lifecycle", () => {
	it("does not restart an active cue after more than 256 same-sequence cues", () => {
		const { animations, cue, runtime } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		expect(animations).toHaveLength(2);

		Effect.runSync(runtime.enqueueFx(readOverflowingCuesFn(cue)));
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		expect(animations).toHaveLength(2);
	});

	it("does not replay a completed cue after a larger same-sequence batch", () => {
		const { animations, cue, runtime } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		Effect.runSync(runtime.enqueueFx(readOverflowingCuesFn(cue)));
		animations[0]?.onCompleteFn?.();
		animations[1]?.onCompleteFn?.();
		Effect.runSync(runtime.cancelSpaceFx(firstBoardLocation.space));
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(0);

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(0);
	});

	it("deduplicates completed cues and ignores duplicate leg completion", () => {
		const { animations, cue, runtime, source, target } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		samplePoseAnimation(readPoseAnimation(animations, source), 1);
		samplePoseAnimation(readPoseAnimation(animations, target), 1);
		animations[0]?.onCompleteFn?.();
		animations[0]?.onCompleteFn?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(2);
		animations[1]?.onCompleteFn?.();
		animations[1]?.onCompleteFn?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(0);

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		expect(animations).toHaveLength(2);
	});

	it("keeps overlapping spawn and swap ownership blocked until landing", () => {
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
		).toBe("blocked");
	});

	it("clears claims on close and ignores late swap completion callbacks", () => {
		const { animations, canceledAnimationKeys, cue, runtime, source, target } =
			createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		samplePoseAnimation(readPoseAnimation(animations, target), 0.4);
		samplePoseAnimation(readPoseAnimation(animations, source), 0.4);

		Effect.runSync(runtime.closeFx);
		for (const animation of animations) animation.onCompleteFn?.();

		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		expect(canceledAnimationKeys).toContain(`motion:9:0:${cue.actorId}`);
		expect(canceledAnimationKeys).toContain(`motion:9:0:${cue.counterpartActorId}`);
		expect(animations).toHaveLength(2);
	});
});
