// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	readPoseAnimation,
	samplePoseAnimation,
	createSwapHarness,
} from "./createMotionRuntimeFx.test/fixture";

describe("swap geometry retargeting", () => {
	it("retargets both swap legs continuously when live surface geometry changes", () => {
		const { animations, cue, runtime, setGeometry, source, target } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const targetTravel = readPoseAnimation(animations, target);
		const sourceTravel = readPoseAnimation(animations, source);
		expect(samplePoseAnimation(sourceTravel, 0)).toEqual({
			scale: 1,
			x: 245,
			y: 47,
		});
		const targetBeforeResize = samplePoseAnimation(targetTravel, 0.4);
		const sourceBeforeResize = samplePoseAnimation(sourceTravel, 0.4);

		setGeometry({
			size: 120,
			stepX: 200,
			y: 80,
		});
		expect(samplePoseAnimation(targetTravel, 0.4)).toEqual(targetBeforeResize);
		expect(samplePoseAnimation(sourceTravel, 0.4)).toEqual(sourceBeforeResize);

		const targetAfterResize = samplePoseAnimation(targetTravel, 0.7);
		const sourceAfterResize = samplePoseAnimation(sourceTravel, 0.7);
		expect(targetAfterResize).toEqual({
			scale: 1.25,
			x: 180,
			y: 60,
		});
		expect(sourceAfterResize).toMatchObject({
			scale: 1.25,
			x: 313.5,
		});
		expect(sourceAfterResize.y).toBeCloseTo(62.1);

		setGeometry({
			size: 140,
			stepX: 260,
			y: 100,
		});
		const targetDuringSecondResize = samplePoseAnimation(targetTravel, 0.8);
		const sourceDuringSecondResize = samplePoseAnimation(sourceTravel, 0.8);
		expect(targetDuringSecondResize.x).toBeGreaterThan(targetAfterResize.x);
		expect(sourceDuringSecondResize.x).toBeGreaterThan(sourceAfterResize.x);
		expect(samplePoseAnimation(targetTravel, 0.8)).toEqual(targetDuringSecondResize);
		expect(samplePoseAnimation(sourceTravel, 0.8)).toEqual(sourceDuringSecondResize);

		setGeometry({
			size: 160,
			stepX: 320,
			y: 120,
		});
		const targetDuringThirdResize = samplePoseAnimation(targetTravel, 0.9);
		const sourceDuringThirdResize = samplePoseAnimation(sourceTravel, 0.9);
		expect(targetDuringThirdResize.x).toBeGreaterThan(targetDuringSecondResize.x);
		expect(sourceDuringThirdResize.x).toBeGreaterThan(sourceDuringSecondResize.x);

		setGeometry({
			size: 200,
			stepX: 500,
			y: 200,
		});
		const targetDestination = samplePoseAnimation(targetTravel, 1);
		const sourceDestination = samplePoseAnimation(sourceTravel, 1);
		// An exact-final-frame resize preserves the previous path endpoint without teleporting.
		expect(targetDestination).toEqual({
			scale: 2,
			x: 320,
			y: 120,
		});
		expect(sourceDestination).toEqual({
			scale: 2,
			x: 640,
			y: 120,
		});
		targetTravel.onCompleteFn?.();
		sourceTravel.onCompleteFn?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(2);

		const targetSettle = animations
			.filter((animation) => animation.actor === target && animation.channel === "pose")
			.at(-1);
		const sourceSettle = animations
			.filter((animation) => animation.actor === source && animation.channel === "pose")
			.at(-1);
		if (targetSettle?.channel !== "pose" || sourceSettle?.channel !== "pose") {
			throw new Error("Expected final-frame semantic settle animations.");
		}
		expect(samplePoseAnimation(targetSettle, 0)).toEqual(targetDestination);
		expect(samplePoseAnimation(sourceSettle, 0)).toEqual(sourceDestination);
		samplePoseAnimation(targetSettle, 0.9);
		samplePoseAnimation(sourceSettle, 0.9);
		setGeometry({
			size: 240,
			stepX: 700,
			y: 240,
		});
		const firstSettleDestination = samplePoseAnimation(targetSettle, 1);
		const firstSourceSettleDestination = samplePoseAnimation(sourceSettle, 1);
		expect(firstSettleDestination).toEqual({
			scale: 2.5,
			x: 500,
			y: 200,
		});
		expect(firstSourceSettleDestination).toEqual({
			scale: 2.5,
			x: 1_000,
			y: 200,
		});
		targetSettle.onCompleteFn?.();
		sourceSettle.onCompleteFn?.();
		const finalTargetSettle = animations
			.filter((animation) => animation.actor === target && animation.channel === "pose")
			.at(-1);
		const finalSourceSettle = animations
			.filter((animation) => animation.actor === source && animation.channel === "pose")
			.at(-1);
		if (finalTargetSettle?.channel !== "pose" || finalSourceSettle?.channel !== "pose") {
			throw new Error("Expected recursive final-frame semantic settles.");
		}
		expect(samplePoseAnimation(finalTargetSettle, 0)).toEqual(firstSettleDestination);
		expect(samplePoseAnimation(finalSourceSettle, 0)).toEqual(firstSourceSettleDestination);
		const latestTargetDestination = samplePoseAnimation(finalTargetSettle, 1);
		const latestSourceDestination = samplePoseAnimation(finalSourceSettle, 1);
		expect(latestTargetDestination).toEqual({
			scale: 3,
			x: 700,
			y: 240,
		});
		expect(latestSourceDestination).toEqual({
			scale: 3,
			x: 1_400,
			y: 240,
		});
		finalTargetSettle.onCompleteFn?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(2);
		finalSourceSettle.onCompleteFn?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		expect(target.container).toMatchObject({
			x: latestTargetDestination.x,
			y: latestTargetDestination.y,
		});
		expect(source.container).toMatchObject({
			x: latestSourceDestination.x,
			y: latestSourceDestination.y,
		});
	});
});
