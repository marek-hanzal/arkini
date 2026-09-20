// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	readPoseAnimation,
	samplePoseAnimation,
	createSwapHarness,
	type TileMotionCue,
} from "./createMotionRuntimeFx.test/fixture";

describe("swap interaction handoff", () => {
	it("hands one live swap leg to direct interaction without canceling its counterpart", () => {
		const { animations, canceledAnimationKeys, cue, runtime, source, target } =
			createSwapHarness();
		const pendingCue = {
			...cue,
			eventIndex: 1,
		} satisfies TileMotionCue;
		Effect.runSync(
			runtime.enqueueFx([
				cue,
				pendingCue,
			]),
		);
		Effect.runSync(runtime.startFx);
		expect(animations).toHaveLength(2);
		const targetTravel = readPoseAnimation(animations, target);
		const sourceTravel = readPoseAnimation(animations, source);
		const liveTargetPose = samplePoseAnimation(targetTravel, 0.4);

		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);

		expect(canceledAnimationKeys).toContain(`motion:9:0:${target.item.id}`);
		expect(canceledAnimationKeys).not.toContain(`motion:9:0:${source.item.id}`);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(
			new Map([
				[
					source.item.id,
					"handoff",
				],
			]),
		);
		expect(animations).toHaveLength(2);
		expect(target.container).toMatchObject({
			x: liveTargetPose.x,
			y: liveTargetPose.y,
		});

		samplePoseAnimation(sourceTravel, 1);
		sourceTravel.onCompleteFn?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		expect(target.container).toMatchObject({
			x: liveTargetPose.x,
			y: liveTargetPose.y,
		});
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(false);
	});

	it("hands both swap legs over independently", () => {
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

		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(
			new Map([
				[
					source.item.id,
					"handoff",
				],
			]),
		);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(source.item.id))).toBe(true);

		expect(canceledAnimationKeys).toEqual(
			expect.arrayContaining([
				`motion:9:0:${target.item.id}`,
				`motion:9:0:${source.item.id}`,
			]),
		);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		Effect.runSync(runtime.closeFx);
	});
});
