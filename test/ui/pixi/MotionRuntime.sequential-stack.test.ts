// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createMotionHarness,
	firstBoardLocation,
	secondBoardLocation,
	createActor,
	samplePoseAnimation,
	advanceStackMergeVanish,
	type TileMotionCue,
} from "~test/ui/pixi/MotionRuntime.test/fixture";

describe("sequential stack contact", () => {
	it("publishes sequential stack quantities and feedback only at each physical contact", () => {
		const stacked = createActor("runtime:sequential-stack");
		stacked.container.position.set(200, 40);
		const canonical = {
			...stacked.item,
			badgeCount: 3,
			quantity: 3,
		};
		const actors = new Map([
			[
				stacked.item.id,
				stacked,
			],
		]);
		const canonicalItems = new Map([
			[
				stacked.item.id,
				canonical,
			],
		]);
		const { animations, magneticReleases, runtime } = createMotionHarness({
			actors,
			canonicalItems,
		});
		const cues = [
			{
				canonicalItemId: stacked.item.itemId,
				eventIndex: 0,
				kind: "stack",
				originActorId: "runtime:producer",
				originLocation: firstBoardLocation,
				quantity: 1,
				sequence: 20,
				staggerIndex: 0,
				targetActorId: stacked.item.id,
				targetLocation: secondBoardLocation,
			},
			{
				canonicalItemId: stacked.item.itemId,
				eventIndex: 0,
				kind: "stack",
				originActorId: "runtime:producer",
				originLocation: firstBoardLocation,
				quantity: 1,
				sequence: 21,
				staggerIndex: 0,
				targetActorId: stacked.item.id,
				targetLocation: secondBoardLocation,
			},
		] satisfies TileMotionCue[];

		Effect.runSync(runtime.enqueueFx(cues));
		Effect.runSync(runtime.syncPresentationFx);
		Effect.runSync(runtime.startFx);

		expect(stacked.item.quantity).toBe(1);
		expect(stacked.item.badgeCount).toBeUndefined();
		expect(
			animations.filter(
				(animation) =>
					animation.actor === stacked && animation.channel === "activity-particles",
			),
		).toHaveLength(0);
		const firstTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:20:0",
		);
		if (firstTravel?.channel !== "pose") {
			throw new Error("Expected the first sequential stack payload.");
		}
		expect(
			animations.some(
				(animation) => animation.channel === "pose" && animation.ownerKey === "motion:21:0",
			),
		).toBe(false);
		const firstTransient = firstTravel.actor;
		samplePoseAnimation(firstTravel, 1);
		expect(stacked.item.quantity).toBe(1);
		expect(stacked.item.badgeCount).toBeUndefined();
		firstTravel.onComplete?.();
		advanceStackMergeVanish({
			actor: firstTransient,
			animations,
		});

		expect(firstTransient.container.destroyed).toBe(true);
		expect(stacked.item.quantity).toBe(2);
		expect(stacked.item.badgeCount).toBe(2);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === stacked && animation.channel === "activity-particles",
			),
		).toHaveLength(1);
		expect(
			magneticReleases.filter((release) => release.sourceActorId === firstTransient.item.id),
		).toHaveLength(1);
		const secondTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:21:0",
		);
		if (secondTravel?.channel !== "pose") {
			throw new Error("Expected the second sequential stack payload after first contact.");
		}
		const secondTransient = secondTravel.actor;
		samplePoseAnimation(secondTravel, 1);
		expect(stacked.item.quantity).toBe(2);
		expect(stacked.item.badgeCount).toBe(2);
		secondTravel.onComplete?.();
		advanceStackMergeVanish({
			actor: secondTransient,
			animations,
		});

		expect(secondTransient.container.destroyed).toBe(true);
		expect(stacked.item.quantity).toBe(3);
		expect(stacked.item.badgeCount).toBe(3);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === stacked && animation.channel === "activity-particles",
			),
		).toHaveLength(2);
		expect(
			magneticReleases.filter((release) => release.sourceActorId === secondTransient.item.id),
		).toHaveLength(1);
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId).toEqual(
			new Map(),
		);
		Effect.runSync(runtime.closeFx);
	});
});
