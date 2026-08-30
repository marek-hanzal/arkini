// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createMotionHarness,
	createStackHarness,
	firstBoardLocation,
	secondBoardLocation,
	createActor,
	samplePoseAnimation,
	advanceInputRemainderFlash,
	advanceStackMergeVanish,
	type TileMotionCue,
} from "./createMotionRuntimeFx.test/fixture";

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

	it("keeps stack and input quantities hidden until their physical contacts", () => {
		const {
			actors,
			animations,
			canonicalItems,
			cue: stack,
			runtime,
			target: source,
		} = createStackHarness();
		const owner = createActor("runtime:input-owner");
		owner.container.position.set(100, 40);
		actors.set(owner.item.id, owner);
		canonicalItems.set(source.item.id, {
			...source.item,
			badgeCount: 4,
			quantity: 4,
		});
		const input = {
			canonicalItemId: source.item.itemId,
			eventIndex: 0,
			kind: "input",
			originActorId: source.item.id,
			originLocation: secondBoardLocation,
			previousQuantity: 6,
			resultingQuantity: 4,
			sequence: 31,
			sourceActorId: source.item.id,
			staggerIndex: 0,
			storedQuantity: 2,
			targetActorId: owner.item.id,
			targetLocation: firstBoardLocation,
		} satisfies TileMotionCue;
		const readQuantityPresentation = () =>
			Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId.get(
				source.item.id,
			);

		Effect.runSync(
			runtime.enqueueFx([
				stack,
				input,
			]),
		);
		Effect.runSync(runtime.syncPresentationFx);
		Effect.runSync(runtime.startFx);

		expect(readQuantityPresentation()).toEqual({
			kind: "exact",
			quantity: 5,
		});
		const stackTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (stackTravel?.channel !== "pose") throw new Error("Expected the stack contact.");
		samplePoseAnimation(stackTravel, 1);
		stackTravel.onComplete?.();
		advanceStackMergeVanish({
			actor: stackTravel.actor,
			animations,
		});

		expect(readQuantityPresentation()).toEqual({
			kind: "exact",
			quantity: 6,
		});
		const inputTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:31:0",
		);
		if (inputTravel?.channel !== "pose") throw new Error("Expected the input contact.");
		samplePoseAnimation(inputTravel, 1);
		inputTravel.onComplete?.();
		advanceInputRemainderFlash({
			actor: inputTravel.actor,
			animations,
			cueKey: "31:0",
		});

		expect(readQuantityPresentation()).toEqual({
			kind: "exact",
			quantity: 4,
		});
		Effect.runSync(runtime.closeFx);
	});
});
