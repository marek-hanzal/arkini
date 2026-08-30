// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	readPoseAnimation,
	samplePoseAnimation,
	createSwapHarness,
} from "./createMotionRuntimeFx.test/fixture";

describe("swap travel", () => {
	it("animates both swap legs from their live poses and releases claims together", () => {
		const { animations, cue, magneticReleases, magneticUpdates, runtime, source, target } =
			createSwapHarness();

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		expect(animations).toHaveLength(2);
		expect(animations.find((animation) => animation.actor === target)).toMatchObject({
			channel: "pose",
			curve: {
				bounce: 0.14,
				kind: "spring",
			},
			ownerKey: `motion:9:0:${target.item.id}`,
		});
		expect(animations.find((animation) => animation.actor === source)).toMatchObject({
			channel: "pose",
			curve: {
				bounce: 0.14,
				kind: "spring",
			},
			ownerKey: `motion:9:0:${source.item.id}`,
		});
		expect(animations.every(({ durationMs }) => durationMs < 280)).toBe(true);
		expect(source.container.x).toBe(245);
		expect(source.container.y).toBe(47);
		const snapshot = Effect.runSync(runtime.readSnapshotFx);
		expect(snapshot.interactionClaimByActorId).toEqual(
			new Map([
				[
					target.item.id,
					"handoff",
				],
				[
					source.item.id,
					"handoff",
				],
			]),
		);
		expect(snapshot.retainedActorIds).toEqual(
			new Set([
				target.item.id,
				source.item.id,
			]),
		);

		const targetTravel = readPoseAnimation(animations, target);
		const sourceTravel = readPoseAnimation(animations, source);
		samplePoseAnimation(targetTravel, 1);
		samplePoseAnimation(sourceTravel, 1);
		expect(magneticUpdates).toHaveLength(2);
		expect(magneticUpdates[0]).toMatchObject({
			attractedActorId: null,
			sourceActorId: target.item.id,
			sourceDirection: {
				x: -1,
				y: 0,
			},
			sourceKind: "motion",
		});
		expect(Array.from(magneticUpdates[0]?.eligibleAttractionActorIds ?? [])).toEqual([
			source.item.id,
		]);
		expect(magneticUpdates[1]).toMatchObject({
			attractedActorId: null,
			sourceActorId: source.item.id,
			sourceKind: "motion",
		});
		expect(magneticUpdates[1]?.sourceDirection?.x).toBeCloseTo(-0.9881);
		expect(magneticUpdates[1]?.sourceDirection?.y).toBeCloseTo(-0.1537);
		expect(Array.from(magneticUpdates[1]?.eligibleAttractionActorIds ?? [])).toEqual([
			target.item.id,
		]);
		targetTravel.onComplete?.();
		expect(magneticReleases).toEqual([
			{
				sourceActorId: target.item.id,
				sourceKind: "motion",
			},
		]);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(2);
		sourceTravel.onComplete?.();

		expect(magneticReleases).toEqual([
			{
				sourceActorId: target.item.id,
				sourceKind: "motion",
			},
			{
				sourceActorId: source.item.id,
				sourceKind: "motion",
			},
		]);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		expect(target.container.x).toBe(100);
		expect(source.container.x).toBe(200);
	});

	it("animates and completes the available swap leg when its counterpart actor is missing", () => {
		const { animations, cue, magneticReleases, runtime, target } = createSwapHarness({
			includeSource: false,
		});

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		expect(animations).toHaveLength(1);
		expect(animations[0]?.actor).toBe(target);
		samplePoseAnimation(readPoseAnimation(animations, target), 0.5);
		target.container.destroyed = true;
		animations[0]?.onComplete?.();
		expect(magneticReleases).toEqual([
			{
				sourceActorId: target.item.id,
				sourceKind: "motion",
			},
		]);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
	});
});
